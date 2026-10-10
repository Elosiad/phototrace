const test=require('node:test');
const assert=require('node:assert/strict');
const {load,plain,MemoryStorage,feedback2Fixture}=require('./helpers.cjs');
const {C,R}=load();
const target=(d,name)=>d.tasks.find(t=>t.personId===d.people[0].id&&d.projects.find(p=>p.id===t.projectId).name===name);

test('direct retouch affects only the chosen shoot and can restore its exact prior stage',()=>{
  const d=feedback2Fixture(C),t=target(d,'1.2'),before=plain(d),result=C.changeTasks(d,[t.id],'retouch');
  assert.deepEqual(plain(C.personOverview(result.candidate,t.personId).stages.map(s=>s.tasks.length)),[1,2,1]);
  assert.equal(target(result.candidate,'1.3').retouched,false);
  assert.deepEqual(plain(C.undoTasks(result.candidate,result.undo).candidate),before);
  assert.deepEqual(plain(d),before);
});

test('direct publish updates progress, keeps links and restores the pending publish stage on undo',()=>{
  const d=feedback2Fixture(C),t=target(d,'2.3');t.links=['https://example.com/publication'];
  const result=C.changeTasks(d,[t.id],'publish'),p=result.candidate.projects.find(p=>p.id===t.projectId);
  assert.equal(C.summary(result.candidate,p).progress,100);
  assert.deepEqual(plain(C.undoTasks(result.candidate,result.undo).candidate),plain(d));
});

test('all visible shoots for one person advance atomically and one undo restores the entire set',()=>{
  const d=feedback2Fixture(C),ids=C.personOverview(d,d.people[0].id).stages[0].tasks.map(t=>t.id),result=C.changeTasks(d,ids,'retouch');
  assert.equal(result.undo.entries.length,2);
  assert.deepEqual(plain(C.personOverview(result.candidate,d.people[0].id).stages.map(s=>s.tasks.length)),[0,3,1]);
  assert.deepEqual(plain(C.undoTasks(result.candidate,result.undo).candidate),plain(d));
});

test('filtered card action changes only its listed task IDs and preserves hidden shoots',()=>{
  const d=feedback2Fixture(C),visible=C.visibleTasks(d).filter(t=>t.id===target(d,'1.2').id),group=C.groupPeople(d,visible)[0].people[0];
  const result=C.changeTasks(d,group.tasks.map(t=>t.id),'retouch');
  assert.equal(target(result.candidate,'1.3').retouched,false);assert.equal(target(result.candidate,'1.5').published,true);
  assert.equal(result.undo.entries.length,1);
});

test('undo restores only task flags and preserves later edits to links, notes, quantities and other people',()=>{
  const d=feedback2Fixture(C),t=target(d,'1.2'),result=C.changeTasks(d,[t.id],'retouch'),later=C.clone(result.candidate);
  later.tasks.find(task=>task.id===t.id).notes='之后补的备注';later.tasks.find(task=>task.id===t.id).links=['https://example.com/new'];
  later.projects.find(p=>p.id===t.projectId).quantities.exported=7;
  later.tasks.find(task=>task.personId===later.people[1].id).published=true;
  const out=C.undoTasks(later,result.undo).candidate;
  assert.equal(out.tasks.find(task=>task.id===t.id).retouched,false);
  assert.equal(out.tasks.find(task=>task.id===t.id).notes,'之后补的备注');
  assert.deepEqual(plain(out.tasks.find(task=>task.id===t.id).links),['https://example.com/new']);
  assert.equal(out.projects.find(p=>p.id===t.projectId).quantities.exported,7);
  assert.equal(out.tasks.find(task=>task.personId===out.people[1].id).published,true);
});

test('stale undo rejects the whole set when one task was changed again',()=>{
  const d=feedback2Fixture(C),ids=['1.2','1.3'].map(name=>target(d,name).id),result=C.changeTasks(d,ids,'retouch');
  const later=C.changeTasks(result.candidate,[ids[0]],'publish').candidate,before=plain(later);
  assert.throws(()=>C.undoTasks(later,result.undo),/状态已再次修改/);assert.deepEqual(plain(later),before);
});

test('undo is blocked during rescreening without losing achievements or publication links',()=>{
  const d=feedback2Fixture(C),t=target(d,'2.3'),result=C.changeTasks(d,[t.id],'publish'),paused=C.reopen(result.candidate,t.projectId).candidate;
  assert.throws(()=>C.undoTasks(paused,result.undo),/重新初筛/);assert.equal(paused.tasks.find(task=>task.id===t.id).published,true);
});

test('unretouch preserves the existing dependent-publication warning and undo restores both flags',()=>{
  const d=feedback2Fixture(C),t=target(d,'1.5'),result=C.changeTasks(d,[t.id],'unretouch');
  assert.equal(result.warnings.length,1);assert.match(result.warnings[0],/同步撤销发布/);
  assert.deepEqual(plain(result.candidate.tasks.find(task=>task.id===t.id).links),plain(t.links));
  assert.deepEqual(plain(C.undoTasks(result.candidate,result.undo).candidate),plain(d));
});

test('exclude and include remain reversible without erasing actual achievements',()=>{
  const d=feedback2Fixture(C),t=target(d,'1.5'),excluded=C.changeTasks(d,[t.id],'exclude');
  assert.equal(C.personOverview(excluded.candidate,t.personId).excluded.length,1);
  assert.deepEqual(plain(C.undoTasks(excluded.candidate,excluded.undo).candidate),plain(d));
  const included=C.changeTasks(excluded.candidate,[t.id],'include');
  assert.deepEqual(plain(C.undoTasks(included.candidate,included.undo).candidate),plain(excluded.candidate));
});

test('invalid undo records reject atomically and cannot overwrite unrelated task fields',()=>{
  const d=feedback2Fixture(C),t=target(d,'1.2'),result=C.changeTasks(d,[t.id],'retouch'),before=plain(result.candidate);
  for(const record of [null,{entries:[]},{entries:[result.undo.entries[0],result.undo.entries[0]]},{entries:[{...result.undo.entries[0],id:'missing'}]},{entries:[{...result.undo.entries[0],before:{retouched:'false'}}]}])assert.throws(()=>C.undoTasks(result.candidate,record));
  const record=C.clone(result.undo);record.entries[0].before.notes='恶意覆盖';
  const out=C.undoTasks(result.candidate,record).candidate;assert.equal(out.tasks.find(task=>task.id===t.id).notes,t.notes);
  assert.deepEqual(plain(result.candidate),before);
});

test('no-op actions have no undo entries and invalid multi-shoot publication is fully rejected',()=>{
  const d=feedback2Fixture(C),before=plain(d);
  assert.equal(C.changeTasks(d,[target(d,'2.3').id],'retouch').undo.entries.length,0);
  assert.throws(()=>C.changeTasks(d,[target(d,'2.3').id,target(d,'1.2').id],'publish'),/尚未完成修图/);
  assert.deepEqual(plain(d),before);
});

test('failed direct save keeps the original stages; retry commits the candidate and its undo still works',()=>{
  const d=feedback2Fixture(C),storage=new MemoryStorage(),repo=new R.Repository(storage);repo.commit(d);storage.failKey=R.KEY;
  const result=C.changeTasks(repo.data,[target(d,'2.3').id],'publish');assert.equal(repo.commit(result.candidate),false);
  assert.deepEqual(plain(repo.data),plain(d));assert.deepEqual(plain(new R.Repository(storage).load()),plain(d));
  storage.failKey=null;assert.equal(repo.commit(repo.pending),true);
  assert.equal(repo.commit(C.undoTasks(repo.data,result.undo).candidate),true);
  assert.deepEqual(plain(new R.Repository(storage).load()),plain(d));
});

test('failed undo keeps the completed stage and a later retry restores the original archive',()=>{
  const d=feedback2Fixture(C),storage=new MemoryStorage(),repo=new R.Repository(storage),result=C.changeTasks(d,[target(d,'1.2').id],'retouch');repo.commit(result.candidate);storage.failKey=R.KEY;
  assert.equal(repo.commit(C.undoTasks(repo.data,result.undo).candidate),false);assert.equal(target(repo.data,'1.2').retouched,true);
  storage.failKey=null;assert.equal(repo.commit(repo.pending),true);assert.deepEqual(plain(repo.data),plain(d));
  assert.equal(Object.hasOwn(C.archive(repo.data).data,'undo'),false);
});

test('actual card-completion export changes only the two intended flags and preserves all identities and links',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const original=C.parseArchive(fs.readFileSync(path.join(__dirname,'fixtures','feedback2.json'),'utf8'));
  const saved=C.parseArchive(fs.readFileSync(path.join(__dirname,'artifacts','feedback3-source.json'),'utf8'));
  for(const name of ['1.2','1.3'])target(original,name).retouched=true;
  assert.deepEqual(plain(saved),plain(original));
  assert.deepEqual(plain(C.personOverview(saved,saved.people[0].id).stages.map(s=>s.tasks.length)),[0,3,1]);
});

test('actual failed-action export contains the candidate; retry then undo restores the whole original archive',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const read=(folder,name)=>C.parseArchive(fs.readFileSync(path.join(__dirname,folder,name),'utf8'));
  const original=read('fixtures','feedback2.json'),unsaved=read('artifacts','feedback3-unsaved-task.json'),undone=read('artifacts','feedback3-after-retry-undo.json');
  assert.deepEqual(plain(undone),plain(original));target(original,'1.2').retouched=true;assert.deepEqual(plain(unsaved),plain(original));
  const evidence=JSON.parse(fs.readFileSync(path.join(__dirname,'artifacts','feedback3-browser-evidence.json'),'utf8'));
  const scoped=evidence.checks.find(c=>c.scenario==='筛选后全部发布只作用于列出的两项');
  assert.deepEqual(scoped.board[1].cards.find(p=>p.name==='富田').projects,['2.3']);
  assert.deepEqual(scoped.board[2].cards.find(p=>p.name==='富田').projects,['1.2','1.3','1.5']);
  assert.equal(evidence.checks.find(c=>c.scenario==='人物详情保存失败时详情内提供重试，重试成功后详情内撤销').passed,true);
});
