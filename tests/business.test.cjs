const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {load,plain,fourPersonFixture} = require('./helpers.cjs');
const {C} = load();

test('all inline scripts are syntactically valid; single-file runtime has no remote dependencies', () => {
  const html=fs.readFileSync(path.join(__dirname,'..','phototrace.html'),'utf8');
  for(const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
  assert.doesNotMatch(html, /<script[^>]*\bsrc=|<link[^>]*\bhref=/i);
});
test('2300 original, 1380 remaining, imported produces 42% and pending', () => {
  const d=C.empty(),p=C.project('2300 张');d.projects.push(p);
  p.quantities={original:2300,remaining:1380,selected:50,exported:null};p.imported=true;
  C.validate(d);const s=C.summary(d,p);assert.equal(s.progress,42);assert.equal(s.status,'pending');
});
test('four people, two retouched and one published produces 77.5%', () => {
  const d=fourPersonFixture(C),s=C.summary(d,d.projects[0]);
  assert.equal(s.progress,77.5);assert.equal(s.status,'selected');assert.equal(s.activeCount,4);
});
test('resource release changes visibility flag only; suspended project retains resources', () => {
  const d=fourPersonFixture(C),p=d.projects[0];p.resources.pixcake=false;
  assert.equal(C.summary(d,p).progress,77.5);assert.equal(C.summary(d,p).active,false);
  p.suspended=true;p.resources.ipad=true;
  assert.equal(C.summary(d,p).status,'suspended');assert.equal(C.summary(d,p).progress,77.5);assert.equal(p.resources.ipad,true);
});
test('combined quantity edit validates final draft and atomically reopens screening', () => {
  const d=fourPersonFixture(C),before=plain(d);
  const result=C.editQuantities(d,d.projects[0].id,{original:100,remaining:90,selected:5,exported:12},true);
  assert.deepEqual(plain(d),before);assert.equal(result.candidate.projects[0].quantities.selected,5);
  assert.equal(result.candidate.projects[0].selectionComplete,false);assert.equal(result.warnings.length,2);
  assert.deepEqual(plain(result.candidate.tasks),before.tasks);
});
test('invalid final quantities reject without mutation; unknown values are not zeros', () => {
  const d=fourPersonFixture(C),before=plain(d);
  for(const q of [{original:100,remaining:90,selected:20,exported:0},{original:-1,remaining:null,selected:null,exported:null},{original:10,remaining:11,selected:null,exported:null},{original:1.5,remaining:0,selected:0,exported:0},{original:10,remaining:null,selected:11,exported:0}]) assert.throws(()=>C.editQuantities(d,d.projects[0].id,q,true));
  assert.deepEqual(plain(d),before);
  const out=C.editQuantities(d,d.projects[0].id,{original:null,remaining:null,selected:null,exported:null},true);
  assert.equal(out.candidate.projects[0].quantities.original,null);
});
test('export count above selected requires warning, never truncates actual output', () => {
  const d=fourPersonFixture(C),out=C.editQuantities(d,d.projects[0].id,{original:100,remaining:0,selected:10,exported:25},true);
  assert.equal(out.warnings.length,1);assert.equal(out.candidate.projects[0].quantities.exported,25);
});
test('re-screening keeps postproduction contributions, markers, links and task IDs, hides people', () => {
  const d=fourPersonFixture(C);d.tasks.forEach(t=>{t.retouched=true;t.published=true;});
  const out=C.editQuantities(d,d.projects[0].id,{original:100,remaining:50,selected:10,exported:20},true).candidate;
  const s=C.summary(out,out.projects[0]);assert.equal(s.progress,85);assert.equal(s.status,'pending');
  assert.deepEqual(plain(out.tasks),plain(d.tasks));assert.equal(C.visibleTasks(out).length,0);
  assert.throws(()=>C.batch(out,[out.tasks[0].id],'exclude'),/重新初筛/);
});
test('reconfirm uses existing task identity; omitted people become excluded with achievements retained', () => {
  const d=fourPersonFixture(C),p=d.projects[0],out=C.reopen(d,p.id).candidate;
  const result=C.confirmPeople(out,p.id,[{personId:d.people[0].id,groupId:null}]).candidate;
  assert.equal(result.tasks.length,4);assert.equal(result.tasks[0].id,d.tasks[0].id);
  assert.equal(result.tasks[1].excluded,true);assert.equal(result.tasks[1].retouched,true);
  assert.equal(C.summary(result,result.projects[0]).progress,100);assert.equal(C.visibleTasks(result).length,1);
});
test('excluded tasks leave both numerator and denominator but still count as actual achievements', () => {
  const d=fourPersonFixture(C),out=C.batch(d,[d.tasks[0].id],'exclude').candidate,s=C.summary(out,out.projects[0]);
  assert.equal(s.activeCount,3);assert.equal(s.retouchedCount,1);assert.equal(s.publishedCount,0);
  assert.equal(s.actualRetouched,2);assert.equal(s.actualPublished,1);assert.equal(out.projects[0].quantities.exported,12);
  assert.deepEqual(plain(out.tasks[0].links),plain(d.tasks[0].links));
  const restored=C.batch(out,[d.tasks[0].id],'include').candidate;
  assert.equal(C.summary(restored,restored.projects[0]).progress,77.5);
});
test('confirmed zero people produces 100% and no false publication', () => {
  const d=C.empty(),p=C.project('零人物');p.imported=true;p.quantities={original:0,remaining:0,selected:0,exported:0};d.projects.push(p);
  assert.equal(C.summary(d,p).progress,30);assert.equal(C.summary(d,p).status,'pending');
  const out=C.confirmPeople(d,p.id,[]).candidate,s=C.summary(out,out.projects[0]);
  assert.equal(s.progress,100);assert.equal(s.reason,'无需后续处理');assert.equal(s.actualPublished,0);
});
test('unknown quantities can be explicitly confirmed, first unconfirmed project contributes no postproduction', () => {
  const d=C.empty(),p=C.project('未知');d.projects.push(p);
  assert.equal(C.summary(d,p).progress,0);p.imported=true;
  assert.equal(C.summary(d,p).progress,30);assert.equal(C.summary(d,p).stages.published,0);
  const out=C.confirmPeople(d,p.id,[]).candidate;assert.equal(C.summary(out,out.projects[0]).progress,100);
  assert.equal(out.projects[0].quantities.original,null);
});
test('one failing task blocks whole publish batch', () => {
  const d=fourPersonFixture(C),before=plain(d);
  assert.throws(()=>C.batch(d,[d.tasks[1].id,d.tasks[2].id],'publish'),/人物 3.*尚未完成修图/);
  assert.deepEqual(plain(d),before);
});
test('unretouch lists published impacts, clears dependent flag, retains link', () => {
  const d=fourPersonFixture(C),out=C.batch(d,[d.tasks[0].id,d.tasks[1].id],'unretouch');
  assert.equal(out.warnings.length,1);assert.equal(out.candidate.tasks[0].published,false);
  assert.equal(out.candidate.tasks[0].retouched,false);assert.equal(out.candidate.tasks[1].retouched,false);
  assert.deepEqual(plain(out.candidate.tasks[0].links),plain(d.tasks[0].links));assert.equal(d.tasks[0].published,true);
});
test('all valid batch operations remain atomic and reject invalid/missing IDs', () => {
  const d=fourPersonFixture(C);
  const out=C.batch(d,d.tasks.map(t=>t.id),'retouch').candidate;
  const published=C.batch(out,out.tasks.map(t=>t.id),'publish').candidate;
  assert.equal(C.summary(published,published.projects[0]).reason,'已发布');
  assert.throws(()=>C.batch(d,[],'retouch'));assert.throws(()=>C.batch(d,[d.tasks[0].id,'missing'],'retouch'));
  assert.throws(()=>C.batch(d,[d.tasks[0].id,d.tasks[0].id],'retouch'));assert.throws(()=>C.batch(d,[d.tasks[0].id],'anything'));
});
test('same names and same-date projects are independent; rename never changes task relationship', () => {
  const d=fourPersonFixture(C);d.people[1].name=d.people[0].name;
  const p=C.project('第二活动',d.projects[0].date);p.imported=true;d.projects.push(p);
  const out=C.confirmPeople(d,p.id,[{personId:d.people[0].id,groupId:null}]).candidate;
  assert.equal(out.tasks.length,5);assert.equal(new Set(out.tasks.map(t=>t.id)).size,5);
  const before=out.tasks.map(t=>t.personId);out.people[0].name='新名字';C.validate(out);
  assert.deepEqual(plain(out.tasks.map(t=>t.personId)),plain(before));
});
test('groups enforce project ownership; rating does not change project rating', () => {
  const d=fourPersonFixture(C),p=C.project('别的项目');d.projects.push(p);
  d.groups.push({id:'group-test',projectId:p.id,name:'团体',rating:5});
  d.tasks[0].groupId='group-test';assert.throws(()=>C.validate(d),/团体关联无效/);
  d.groups[0].projectId=d.projects[0].id;C.validate(d);assert.equal(d.projects[0].rating,0);
});
test('strict restoration rejects missing fields, nonintegers, impossible dates and unsafe links', () => {
  for(const mutate of [d=>delete d.projects[0].storage,d=>d.projects[0].date='2026-02-30',d=>d.projects[0].quantities.remaining=101,d=>d.tasks[0].links=['javascript:alert(1)'],d=>d.tasks[0].links=['https://'],d=>d.tasks[0].published=true&&!(d.tasks[0].retouched=false)]) {
    const d=fourPersonFixture(C);mutate(d);assert.throws(()=>C.validate(d));
  }
});
test('archive rejects corrupt, unknown, generic, broken-link, duplicate task and malformed booleans', () => {
  const d=fourPersonFixture(C),archive=C.archive(d);
  assert.throws(()=>C.parseArchive('{'),/有效 JSON/);
  assert.throws(()=>C.parseArchive(JSON.stringify({...plain(archive),version:999})),/版本/);
  assert.throws(()=>C.parseArchive(JSON.stringify({columns:[]})),/PhotoTrace/);
  for(const mutate of [a=>a.data.tasks[0].personId='missing',a=>a.data.tasks.push({...a.data.tasks[0],id:'duplicate'}),a=>a.data.people.push({...a.data.people[0]}),a=>a.data.projects[0].imported='true',a=>a.data.tasks[0].groupId='missing',a=>a.data.settings.motion='unknown']) {
    const a=plain(archive);mutate(a);assert.throws(()=>C.parseArchive(JSON.stringify(a)));
  }
});
test('archive preserves source fields, IDs, associations and recomputes percentages', () => {
  const d=fourPersonFixture(C);d.projects[0].storage.original='D:\\照片\\拍摄';
  const out=C.parseArchive(JSON.stringify(C.archive(d)));
  assert.deepEqual(plain(out),plain(d));assert.equal(C.summary(out,out.projects[0]).progress,77.5);
  assert.ok(!Object.hasOwn(out.projects[0],'progress'));assert.ok(!Object.hasOwn(out.projects[0],'status'));
});
