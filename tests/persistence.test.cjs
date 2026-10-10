const test = require('node:test');
const assert = require('node:assert/strict');
const {load,plain,MemoryStorage,fourPersonFixture} = require('./helpers.cjs');
const {C,R} = load();

test('atomic commit uses one write and reload derives correct values', () => {
  const storage=new MemoryStorage(),repo=new R.Repository(storage);repo.load();
  const d=fourPersonFixture(C);assert.equal(repo.commit(d),true);assert.equal(storage.writes,1);
  const reopened=new R.Repository(storage);reopened.load();assert.deepEqual(plain(reopened.data),plain(d));
  assert.equal(C.summary(reopened.data,reopened.data.projects[0]).progress,77.5);
});
test('save failure keeps last successful archive, committed views and unsaved export candidate', () => {
  const storage=new MemoryStorage(),repo=new R.Repository(storage);repo.load();repo.commit(fourPersonFixture(C));
  const oldRaw=storage.getItem(R.KEY),oldData=plain(repo.data),candidate=C.batch(repo.data,[repo.data.tasks[1].id],'publish').candidate;
  storage.failKey=R.KEY;assert.equal(repo.commit(candidate),false);
  assert.equal(storage.getItem(R.KEY),oldRaw);assert.deepEqual(plain(repo.data),oldData);
  assert.deepEqual(plain(repo.pending),plain(candidate));assert.match(repo.error,/保存失败/);
  storage.failKey=null;assert.equal(repo.commit(repo.pending),true);assert.equal(repo.pending,null);
});
test('cancelled warning means no mutation and no storage write', () => {
  const storage=new MemoryStorage(),repo=new R.Repository(storage);repo.load();repo.commit(fourPersonFixture(C));
  const before=storage.getItem(R.KEY),writes=storage.writes;
  const draft=C.editQuantities(repo.data,repo.data.projects[0].id,{original:100,remaining:90,selected:5,exported:12},true);
  assert.ok(draft.warnings.length); // User cancellation intentionally never calls commit.
  assert.equal(storage.getItem(R.KEY),before);assert.equal(storage.writes,writes);assert.equal(repo.data.projects[0].selectionComplete,true);
});
test('corrupt startup never writes empty data, protects original bytes and requires explicit restore', () => {
  const storage=new MemoryStorage();storage.setItem(R.KEY,'broken { bytes');
  const repo=new R.Repository(storage);repo.load();assert.equal(repo.blocked,true);
  assert.equal(storage.getItem(R.KEY),'broken { bytes');assert.equal(repo.commit(C.empty()),false);
  assert.equal(storage.getItem(R.KEY),'broken { bytes');assert.equal(repo.restore(fourPersonFixture(C)),true);
  assert.equal(JSON.parse(storage.getItem(R.SNAPSHOT_KEY)).raw,'broken { bytes');assert.equal(repo.blocked,false);
});
test('snapshot failure aborts restore without modifying archive or views', () => {
  const storage=new MemoryStorage(),repo=new R.Repository(storage);repo.load();repo.commit(fourPersonFixture(C));
  const oldRaw=storage.getItem(R.KEY),oldData=plain(repo.data);storage.failKey=R.SNAPSHOT_KEY;
  assert.equal(repo.restore(C.empty()),false);assert.equal(storage.getItem(R.KEY),oldRaw);
  assert.deepEqual(plain(repo.data),oldData);assert.match(repo.error,/快照保存失败/);
});
test('replacement failure preserves original archive and a recoverable snapshot', () => {
  const storage=new MemoryStorage(),repo=new R.Repository(storage);repo.load();repo.commit(fourPersonFixture(C));
  const oldRaw=storage.getItem(R.KEY),oldData=plain(repo.data);storage.failKey=R.KEY;
  assert.equal(repo.restore(C.empty()),false);assert.equal(storage.getItem(R.KEY),oldRaw);
  assert.deepEqual(plain(repo.data),oldData);assert.equal(JSON.parse(storage.getItem(R.SNAPSHOT_KEY)).raw,oldRaw);
});
test('restoration replaces entire dataset and previous snapshot restores exact business state', () => {
  const storage=new MemoryStorage(),repo=new R.Repository(storage);repo.load();repo.commit(fourPersonFixture(C));
  const original=plain(repo.data);assert.equal(repo.restore(C.empty()),true);
  assert.equal(repo.data.projects.length,0);assert.deepEqual(plain(repo.beforeRestore()),original);
  assert.equal(repo.restore(repo.beforeRestore()),true);assert.deepEqual(plain(repo.data),original);
});
test('invalid restoration does not create snapshot or replace data', () => {
  const storage=new MemoryStorage(),repo=new R.Repository(storage);repo.load();repo.commit(fourPersonFixture(C));
  const oldRaw=storage.getItem(R.KEY),d=C.clone(repo.data);d.tasks[0].personId='broken';
  assert.throws(()=>repo.restore(d));assert.equal(storage.getItem(R.KEY),oldRaw);assert.equal(storage.getItem(R.SNAPSHOT_KEY),null);
});
test('storage unavailable on load is protected and no later automatic write occurs', () => {
  let writes=0;const storage={getItem(){throw new Error('SecurityError');},setItem(){writes++;}};
  const repo=new R.Repository(storage);repo.load();assert.equal(repo.blocked,true);
  assert.equal(repo.commit(C.empty()),false);assert.equal(writes,0);
});
