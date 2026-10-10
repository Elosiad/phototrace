const test=require('node:test');
const assert=require('node:assert/strict');
const {load,plain,MemoryStorage,feedback2Fixture}=require('./helpers.cjs');
const {C,R}=load();

test('user example groups the same person once per stage with all corresponding shoots',()=>{
  const d=feedback2Fixture(C),before=plain(d),stages=C.groupPeople(d),person=d.people.find(p=>p.name==='富田');
  const names=tasks=>tasks.map(t=>d.projects.find(p=>p.id===t.projectId).name).sort();
  assert.deepEqual(plain(stages.map(s=>s.people.length)),[1,2,1]);
  assert.deepEqual(plain(names(stages[0].people[0].tasks)),['1.2','1.3']);
  assert.deepEqual(plain(names(stages[1].people.find(p=>p.personId===person.id).tasks)),['2.3']);
  assert.deepEqual(plain(names(stages[2].people[0].tasks)),['1.5']);
  assert.deepEqual(plain(d),before);
});

test('person overview contains all stages regardless of the filtered card used to open it',()=>{
  const d=feedback2Fixture(C),id=d.people[0].id,filtered=C.groupPeople(d,C.visibleTasks(d).filter(t=>d.projects.find(p=>p.id===t.projectId).name==='1.2'));
  assert.equal(filtered[0].people[0].tasks.length,1);
  const overview=C.personOverview(d,id);assert.equal(overview.total,4);
  assert.deepEqual(plain(overview.stages.map(s=>s.tasks.length)),[2,1,1]);
  assert.throws(()=>C.personOverview(d,'missing'),/人物不存在/);
});

test('same-name identities are separate; rename does not change grouping or task relationships',()=>{
  const d=feedback2Fixture(C);d.people[1].name='富田';
  const tasks=d.tasks.map(t=>({id:t.id,personId:t.personId,projectId:t.projectId}));
  assert.equal(C.groupPeople(d)[1].people.length,2);
  d.people[0].name='富田新名';C.validate(d);
  assert.deepEqual(plain(d.tasks.map(t=>({id:t.id,personId:t.personId,projectId:t.projectId}))),plain(tasks));
  assert.equal(C.personOverview(d,d.people[0].id).total,4);
});

test('one project task advances between grouped stages without moving other projects for that person',()=>{
  const d=feedback2Fixture(C),task=d.tasks.find(t=>d.projects.find(p=>p.id===t.projectId).name==='1.2');
  const out=C.batch(d,[task.id],'retouch').candidate,overview=C.personOverview(out,d.people[0].id);
  assert.deepEqual(plain(overview.stages.map(s=>s.tasks.length)),[1,2,1]);
  assert.equal(out.tasks.find(t=>t.id===task.id).published,false);
  assert.equal(d.tasks.find(t=>t.id===task.id).retouched,false);
});

test('paused and excluded tasks remain in person detail but leave the active grouped board',()=>{
  const d=feedback2Fixture(C),p=d.projects.find(p=>p.name==='1.2'),id=d.people[0].id;
  const paused=C.reopen(d,p.id).candidate;
  assert.equal(C.personOverview(paused,id).paused.length,1);assert.equal(C.personOverview(paused,id).total,4);
  assert.equal(C.groupPeople(paused)[0].people[0].tasks.length,1);
  const published=d.tasks.find(t=>t.personId===id&&t.published),excluded=C.batch(paused,[published.id],'exclude').candidate;
  assert.equal(C.groupPeople(excluded)[2].people.length,0);
  const overview=C.personOverview(excluded,id);assert.equal(overview.excluded.length,1);assert.equal(overview.excluded[0].published,true);
  assert.deepEqual(plain(overview.excluded[0].links),plain(published.links));
});

test('typed group names create one group per project and reuse an existing local group ID',()=>{
  const d=C.empty(),p=C.project('人物团体');p.imported=true;p.selectionComplete=true;d.projects.push(p);d.people.push(C.person('甲'),C.person('乙'));
  const entries=d.people.map(person=>({personId:person.id,groupName:' 摄影社 '}));
  const first=C.saveRoster(d,p.id,entries).candidate;assert.equal(first.groups.length,1);assert.equal(new Set(first.tasks.map(t=>t.groupId)).size,1);
  const second=C.saveRoster(first,p.id,entries).candidate;
  assert.deepEqual(plain(second.groups),plain(first.groups));assert.deepEqual(plain(second.tasks),plain(first.tasks));assert.equal(d.groups.length,0);
});

test('global group suggestions preserve spelling while project ownership stays independent',()=>{
  const d=feedback2Fixture(C),p=C.project('其他项目');p.imported=true;p.selectionComplete=true;d.projects.push(p);
  const a=C.saveRoster(d,p.id,[{personId:d.people[0].id,groupName:'Photo Club'}]).candidate;
  const other=C.project('又一项目');other.imported=true;other.selectionComplete=true;a.projects.push(other);
  const b=C.saveRoster(a,other.id,[{personId:a.people[0].id,groupName:' photo club '}]).candidate;
  const local=b.groups.find(g=>g.projectId===other.id),original=b.groups.find(g=>g.projectId===p.id);
  assert.equal(local.name,'Photo Club');assert.notEqual(local.id,original.id);assert.equal(C.groupNames(b).filter(name=>name==='Photo Club').length,1);C.validate(b);
});

test('editing a person group preserves task IDs, achievements and links; blank means ungrouped',()=>{
  const d=feedback2Fixture(C),t=d.tasks.find(t=>t.published),before=plain(t);
  const changed=C.saveRoster(d,t.projectId,[{personId:t.personId,groupName:'新团体'}]).candidate,updated=changed.tasks.find(task=>task.id===t.id);
  assert.equal(updated.id,before.id);assert.equal(updated.published,true);assert.deepEqual(plain(updated.links),before.links);
  assert.notEqual(updated.groupId,before.groupId);
  const ungrouped=C.saveRoster(changed,t.projectId,[{personId:t.personId,groupName:''}]).candidate;
  assert.equal(ungrouped.tasks.find(task=>task.id===t.id).groupId,null);
  assert.ok(C.groupNames(ungrouped).includes('新团体'));
});

test('unchanged typed names preserve a referenced legacy group even when names are duplicated',()=>{
  const d=feedback2Fixture(C),t=d.tasks[0],g=d.groups.find(g=>g.id===t.groupId),duplicate={...g,id:'duplicate-legacy-group',rating:5};d.groups.push(duplicate);t.groupId=duplicate.id;
  const out=C.saveRoster(d,t.projectId,[{personId:t.personId,groupId:duplicate.id,groupName:duplicate.name}]).candidate;
  assert.equal(out.tasks.find(task=>task.id===t.id).groupId,duplicate.id);assert.equal(out.groups.find(group=>group.id===duplicate.id).rating,5);
});

test('invalid typed roster and mixed-stage publication reject atomically',()=>{
  const d=feedback2Fixture(C),before=plain(d),p=d.projects[0];
  assert.throws(()=>C.saveRoster(d,p.id,[{personId:d.people[0].id,groupName:'新团体'},{personId:d.people[0].id,groupName:'第二个'}]),/重复/);
  assert.throws(()=>C.saveRoster(d,p.id,[{personId:d.people[0].id,groupName:3}]),/文本/);
  assert.throws(()=>C.batch(d,[d.tasks[0].id,d.tasks.find(t=>t.published).id],'publish'),/尚未完成修图/);
  assert.deepEqual(plain(d),before);
});

test('grouped views remain derived and recompute after atomic archive save and reload',()=>{
  const d=feedback2Fixture(C),storage=new MemoryStorage(),repo=new R.Repository(storage);assert.equal(repo.commit(d),true);
  const restored=new R.Repository(storage).load();assert.deepEqual(plain(restored),plain(d));
  assert.deepEqual(plain(C.groupPeople(restored)),plain(C.groupPeople(d)));
  assert.deepEqual(plain(C.personOverview(restored,d.people[0].id)),plain(C.personOverview(d,d.people[0].id)));
  assert.ok(!Object.hasOwn(restored,'personCards'));
});

test('actual feedback2 file roundtrip retains stable identities, typed groups and derived person stages',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const read=name=>C.parseArchive(fs.readFileSync(path.join(__dirname,'artifacts',name),'utf8'));
  const source=read('feedback2-source.json'),restored=read('feedback2-restored.json');assert.deepEqual(plain(restored),plain(source));
  const original=C.parseArchive(fs.readFileSync(path.join(__dirname,'fixtures','feedback2.json'),'utf8'));
  assert.deepEqual(plain(source.people),plain(original.people));assert.equal(source.projects.length,4);assert.equal(source.groups.length,6);assert.equal(source.tasks.length,5);
  assert.deepEqual(plain(source.tasks.map(t=>({id:t.id,projectId:t.projectId,personId:t.personId,retouched:t.retouched,published:t.published,links:t.links}))),plain(original.tasks.map(t=>({id:t.id,projectId:t.projectId,personId:t.personId,retouched:t.retouched,published:t.published,links:t.links}))));
  assert.equal(source.projects.find(p=>p.name==='1.2').quantities.selected,5);
  assert.equal(source.groups.filter(g=>g.name==='新的社团').length,2);
  assert.deepEqual(plain(C.personOverview(source,source.people.find(p=>p.name==='富田').id).stages.map(s=>s.tasks.length)),[2,1,1]);
});

test('actual inline-save failure export retains 13 and successful retry writes latest 14',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const read=name=>C.parseArchive(fs.readFileSync(path.join(__dirname,'artifacts',name),'utf8'));
  const expected=C.parseArchive(fs.readFileSync(path.join(__dirname,'fixtures','acceptance.json'),'utf8'));
  const unsaved=read('feedback2-unsaved.json'),saved=read('feedback2-after-save.json');
  const target=expected.projects.find(p=>p.name==='校园秋日人像 · 四人');
  target.quantities.exported=13;assert.deepEqual(plain(unsaved),plain(expected));
  target.quantities.exported=14;assert.deepEqual(plain(saved),plain(expected));
  const evidence=JSON.parse(fs.readFileSync(path.join(__dirname,'artifacts','feedback2-browser-evidence.json'),'utf8'));
  assert.equal(evidence.checks.find(c=>c.scenario==='只选一个项目时合并卡片为部分勾选').ariaChecked,'mixed');
  const closed=evidence.checks.find(c=>c.scenario==='关闭详情后重试最新数量草稿');assert.equal(closed.value,'14');assert.equal(closed.draftVisible,false);
});
