const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

function load() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'phototrace.html'), 'utf8');
  const context = vm.createContext({URL, Date, crypto: crypto.webcrypto, console});
  for (const id of ['phototrace-domain', 'phototrace-persistence']) {
    const script = html.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)</script>'));
    if (!script) throw new Error('Missing inline script: ' + id);
    vm.runInContext(script[1], context, {filename: id + '.js'});
  }
  return vm.runInContext('({C:PhotoTraceCore,R:PhotoTracePersistence})', context);
}
function plain(value) { return JSON.parse(JSON.stringify(value)); }
class MemoryStorage {
  constructor() { this.values = new Map(); this.failKey = null; this.writes = 0; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) {
    if (key === this.failKey) throw new Error('QuotaExceededError (injected)');
    this.values.set(key, value); this.writes++;
  }
}
function fourPersonFixture(C) {
  const data = C.empty();
  const p = C.project('四人拍摄 · 验收数据', '2026-10-08');
  p.quantities = {original:100, remaining:0, selected:20, exported:12};
  p.imported = true; p.selectionComplete = true; p.peopleConfirmed = true;
  p.resources.pixcake = true;
  data.projects.push(p);
  for (let i=0;i<4;i++) {
    const person = C.person('人物 ' + (i+1), '测试身份'); data.people.push(person);
    const t = C.task(p.id, person.id); t.retouched = i < 2; t.published = i < 1;
    if (t.published) t.links = ['https://example.com/phototrace/1'];
    data.tasks.push(t);
  }
  C.validate(data); return data;
}
function feedback2Fixture(C) {
  let d=C.empty();const futian=C.person('富田','反馈 2 模拟人物'),unnamed=C.person('无名','反馈 2 模拟人物');d.people.push(futian,unnamed);
  for(const name of ['1.2','1.3','2.3','1.5']) {
    const p=C.project(name,'2026-10-10');p.imported=true;p.selectionComplete=true;p.quantities={original:100,remaining:0,selected:20,exported:null};p.resources.pixcake=true;d.projects.push(p);
    const entries=[{personId:futian.id,groupName:'摄影社'}];if(name==='1.3')entries.push({personId:unnamed.id,groupName:'摄影社'});
    d=C.saveRoster(d,p.id,entries).candidate;
    for(const t of d.tasks.filter(t=>t.projectId===p.id)){t.retouched=name==='2.3'||name==='1.5'||t.personId===unnamed.id;t.published=name==='1.5';if(t.published)t.links=['https://example.com/phototrace/futian'];}
  }
  C.validate(d);return d;
}
module.exports = {load, plain, MemoryStorage, fourPersonFixture, feedback2Fixture};
