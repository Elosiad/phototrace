const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {load,plain}=require('./helpers.cjs');
const {C}=load();
const read=name=>fs.readFileSync(path.join(__dirname,'artifacts',name),'utf8');
test('actual browser-exported files roundtrip all business fields and stable associations',()=>{
  const source=C.parseArchive(read('roundtrip-source.json'));
  const restored=C.parseArchive(read('roundtrip-restored.json'));
  assert.deepEqual(plain(restored),plain(source));
  assert.equal(source.projects.length,6);assert.equal(source.people.length,4);assert.equal(source.tasks.length,6);
  const sample=source.projects.find(p=>p.name==='校园秋日人像 · 四人');
  assert.equal(C.summary(source,sample).progress,77.5);
});
test('actual invalid-file attempts left original business data intact',()=>{
  const source=C.parseArchive(read('roundtrip-source.json'));
  const after=C.parseArchive(read('after-rejected-files.json'));
  assert.deepEqual(plain(after),plain(source));
  const evidence=JSON.parse(read('rejected-files.json'));
  assert.equal(evidence.length,3);assert.ok(evidence.every(e=>e.previewOpened===false));
  assert.match(evidence[0].message,/有效 JSON/);assert.match(evidence[1].message,/版本 999/);assert.match(evidence[2].message,/关联断裂/);
});
test('actual unsaved-work export keeps candidate numbers and all prior achievements',()=>{
  const source=C.parseArchive(read('roundtrip-source.json'));
  const unsaved=C.parseArchive(read('unsaved-work-export.json'));
  const sample=unsaved.projects.find(p=>p.name==='校园秋日人像 · 四人');
  assert.equal(sample.quantities.exported,13);
  const expected=plain(source);expected.projects.find(p=>p.id===sample.id).quantities.exported=13;
  assert.deepEqual(plain(unsaved),expected);
});
