const test = require('node:test');
const assert = require('node:assert/strict');
const {load, plain, MemoryStorage, fourPersonFixture} = require('./helpers.cjs');
const {C, R} = load();
const unknownSelected = count => ({original:null, remaining:null, selected:count, exported:null});

test('selected-only setup derives 60%, keeps unknown counts and waits for people', () => {
  const d=C.empty(),p=C.project('已筛完的旧拍摄');d.projects.push(p);
  const before=plain(d),out=C.editQuantities(d,p.id,unknownSelected(120),false,'auto').candidate;
  const saved=out.projects[0],s=C.summary(out,saved);
  assert.deepEqual(plain(d),before);
  assert.deepEqual(plain(saved.quantities),unknownSelected(120));
  assert.equal(saved.imported,true);assert.equal(saved.selectionComplete,true);assert.equal(saved.peopleConfirmed,false);
  assert.equal(s.progress,60);assert.equal(s.status,'selected');assert.equal(s.reason,null);
  assert.equal(s.stages.retouched,0);assert.equal(s.stages.published,0);
});

test('known zero selected count is distinct from unknown and can complete screening', () => {
  const d=C.empty(),p=C.project('零入选');d.projects.push(p);
  const out=C.editQuantities(d,p.id,unknownSelected(0),false,'auto').candidate;
  assert.equal(C.summary(out,out.projects[0]).progress,60);
  assert.equal(out.projects[0].quantities.selected,0);
  const blank=C.editQuantities(d,p.id,unknownSelected(null),false,'auto').candidate;
  assert.equal(C.summary(blank,blank.projects[0]).progress,0);
});

test('automatic setup calculates ongoing screening and permits explicit override', () => {
  const d=C.empty(),p=C.project('正在筛图');d.projects.push(p);
  const q={original:2300,remaining:1380,selected:50,exported:null};
  const ongoing=C.editQuantities(d,p.id,q,false,'auto').candidate;
  assert.equal(C.summary(ongoing,ongoing.projects[0]).progress,42);
  assert.equal(ongoing.projects[0].selectionComplete,false);
  const manual=C.editQuantities(d,p.id,unknownSelected(50),false,'screening').candidate;
  assert.equal(C.summary(manual,manual.projects[0]).progress,30);
  assert.equal(manual.projects[0].selectionComplete,false);
  assert.throws(()=>C.editQuantities(d,p.id,q,false,'selected'),/待筛选数须为 0/);
});

test('preparing people before screening saves stable membership with no postproduction credit', () => {
  const d=C.empty(),p=C.project('提前建名单'),person=C.person('小林');d.projects.push(p);d.people.push(person);
  const out=C.saveRoster(d,p.id,[{personId:person.id,groupId:null}]).candidate;
  C.validate(out);assert.equal(out.tasks.length,1);assert.equal(out.projects[0].rosterPrepared,true);
  assert.equal(out.projects[0].peopleConfirmed,false);assert.equal(out.projects[0].selectionComplete,false);
  assert.equal(C.summary(out,out.projects[0]).progress,0);assert.equal(C.visibleTasks(out).length,0);
  assert.equal(d.tasks.length,0);
  assert.throws(()=>C.batch(out,[out.tasks[0].id],'retouch'),/暂停/);
});

test('one-click completion reuses prepared people and groups without duplicate identities', () => {
  const d=C.empty(),p=C.project('无需重复填写'),person=C.person('小林');d.projects.push(p);d.people.push(person);
  d.groups.push({id:'group-feedback',projectId:p.id,name:'摄影社',rating:3});
  const prepared=C.saveRoster(d,p.id,[{personId:person.id,groupId:'group-feedback'}]).candidate;
  const out=C.finishSelection(prepared,p.id).candidate;
  assert.deepEqual(plain(out.tasks),plain(prepared.tasks));assert.deepEqual(plain(out.people),plain(prepared.people));
  assert.equal(out.projects[0].peopleConfirmed,true);assert.equal(C.visibleTasks(out).length,1);
  assert.equal(C.summary(out,out.projects[0]).progress,60);
  const edited=C.batch(out,[out.tasks[0].id],'retouch').candidate;
  assert.equal(C.summary(edited,edited.projects[0]).progress,90);
});

test('adding people to an already screened project immediately activates their work', () => {
  const d=C.empty(),p=C.project('已有初筛数字'),person=C.person('小林');d.projects.push(p);d.people.push(person);
  const screened=C.editQuantities(d,p.id,unknownSelected(80),false,'auto').candidate;
  const out=C.saveRoster(screened,p.id,[{personId:person.id,groupId:null}]).candidate;
  assert.equal(C.visibleTasks(out).length,1);assert.equal(C.summary(out,out.projects[0]).progress,60);
  assert.equal(out.projects[0].selectionComplete,true);assert.equal(out.projects[0].peopleConfirmed,true);
});

test('empty roster never implicitly completes postproduction but explicit confirmation does', () => {
  const d=C.empty(),p=C.project('名单未知');d.projects.push(p);
  const screened=C.finishSelection(d,p.id).candidate;
  assert.equal(C.summary(screened,screened.projects[0]).progress,60);
  const confirmed=C.finishSelection(screened,p.id,true);
  assert.equal(confirmed.warnings.length,1);assert.equal(C.summary(confirmed.candidate,confirmed.candidate.projects[0]).progress,100);
  assert.equal(C.summary(confirmed.candidate,confirmed.candidate.projects[0]).actualPublished,0);
  const prepared=C.saveRoster(d,p.id,[]);
  assert.equal(prepared.warnings.length,1);
  const completed=C.finishSelection(prepared.candidate,p.id).candidate;
  assert.equal(C.summary(completed,completed.projects[0]).reason,'无需后续处理');
  const occupied=fourPersonFixture(C);
  assert.throws(()=>C.finishSelection(occupied,occupied.projects[0].id,true),/当前已有需要处理的人物/);
});

test('re-screening and one-click finish preserve existing work, links, exclusions and task IDs', () => {
  const d=fourPersonFixture(C),p=d.projects[0];d.tasks[3].excluded=true;
  const reopened=C.reopen(d,p.id).candidate;
  const out=C.finishSelection(reopened,p.id).candidate;
  assert.deepEqual(plain(out.tasks),plain(d.tasks));assert.deepEqual(plain(out.people),plain(d.people));
  assert.equal(C.summary(out,out.projects[0]).progress,C.summary(d,p).progress);
  assert.equal(C.visibleTasks(out).length,3);
});

test('re-screening default explicitly keeps historical selected counts without auto-completing', () => {
  const d=fourPersonFixture(C),p=d.projects[0];
  const reopened=C.reopen(d,p.id).candidate;
  const out=C.editQuantities(reopened,p.id,unknownSelected(20),true,'screening').candidate;
  assert.equal(out.projects[0].selectionComplete,false);assert.equal(C.visibleTasks(out).length,0);
  assert.deepEqual(plain(out.tasks),plain(d.tasks));
});

test('tag dictionary reuses spelling, deduplicates and persists labels after removal', () => {
  const d=C.empty(),p=C.project('标签 A'),next=C.project('标签 B');d.projects.push(p,next);
  C.setProjectTags(d,p,{location:[' 校园 ', '校园'],equipment:['Sony A7', '35mm']});
  C.setProjectTags(d,next,{location:['校园'],equipment:['sony a7', '35mm', 'SONY A7']});
  C.validate(d);
  assert.deepEqual(plain(next.tags.equipment),['Sony A7','35mm']);
  C.setProjectTags(d,p,{location:[],equipment:[]});C.setProjectTags(d,next,{location:[],equipment:[]});
  assert.ok(C.tagOptions(d,'location').includes('校园'));
  assert.ok(C.tagOptions(d,'equipment').includes('Sony A7'));
  const restored=C.parseArchive(JSON.stringify(C.archive(d)));
  assert.deepEqual(plain(restored.settings.tagHistory),plain(d.settings.tagHistory));
});

test('legacy v1 archives remain readable and former text fields act as reusable tags', () => {
  const d=fourPersonFixture(C),p=d.projects[0];delete p.tags;delete p.rosterPrepared;
  p.location='旧场地';p.equipment='旧设备';
  const restored=C.parseArchive(JSON.stringify(C.archive(d)));
  assert.deepEqual(plain(restored),plain(d));assert.deepEqual(plain(C.projectTags(restored.projects[0],'location')),['旧场地']);
  C.setProjectTags(restored,restored.projects[0],{location:['新场地'],equipment:['旧设备']});C.validate(restored);
  assert.ok(C.tagOptions(restored,'location').includes('旧场地'));
  assert.equal(C.summary(restored,restored.projects[0]).progress,77.5);
});

test('malformed and ambiguous tags reject archive restoration', () => {
  for(const tags of [{location:['重复','重复'],equipment:[]},{location:[''],equipment:[]},{location:'场地',equipment:[]},{location:['场地'],equipment:[3]}]) {
    const d=fourPersonFixture(C);d.projects[0].tags=tags;assert.throws(()=>C.validate(d));
  }
});

test('pre-screening roster and tags survive atomic save/reload; failure preserves draft history', () => {
  const storage=new MemoryStorage(),repo=new R.Repository(storage),d=C.empty(),p=C.project('未筛完');d.projects.push(p);d.people.push(C.person('小林'));
  C.setProjectTags(d,p,{location:['校园'],equipment:['相机']});
  const prepared=C.saveRoster(d,p.id,[{personId:d.people[0].id,groupId:null}]).candidate;
  assert.equal(repo.commit(prepared),true);
  const reloaded=new R.Repository(storage);assert.deepEqual(plain(reloaded.load()),plain(prepared));
  const candidate=C.clone(prepared);C.setProjectTags(candidate,candidate.projects[0],{location:['新场地'],equipment:['相机']});
  storage.failKey=R.KEY;assert.equal(repo.commit(candidate),false);
  assert.deepEqual(plain(repo.data),plain(prepared));assert.ok(C.tagOptions(repo.pending,'location').includes('新场地'));
  assert.ok(!C.tagOptions(repo.data,'location').includes('新场地'));
});

test('actual feedback export/restoration preserves new fields and unknown-count progress', () => {
  const fs=require('node:fs'),path=require('node:path');
  const read=name=>C.parseArchive(fs.readFileSync(path.join(__dirname,'artifacts',name),'utf8'));
  const source=read('feedback-source.json'),restored=read('feedback-restored.json');
  assert.deepEqual(plain(restored),plain(source));
  assert.equal(restored.projects.length,2);assert.equal(restored.people.length,1);assert.equal(restored.tasks.length,2);
  assert.equal(restored.tasks[0].personId,restored.tasks[1].personId);
  const p=restored.projects.find(p=>p.name==='反馈验收 · 已筛旧片');
  assert.deepEqual(plain(p.quantities),unknownSelected(120));assert.equal(C.summary(restored,p).progress,90);
  assert.deepEqual(plain(p.tags.equipment),['Sony A7','35mm']);assert.equal(p.resources.pixcake,true);
  assert.equal(p.storage.original,'D:/模拟照片/旧拍摄');assert.equal(p.storage.cloudBackup,true);
  const evidence=JSON.parse(fs.readFileSync(path.join(__dirname,'artifacts','feedback-browser-evidence.json'),'utf8'));
  for(const check of evidence.checks)assert.equal(check.visiblePeople??check.visibleProjects,check.expected);
});
