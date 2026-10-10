const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'phototrace.html'),'utf8');
const fixtureName=process.argv[3]||'acceptance.json';
if(!/^[a-zA-Z0-9.-]+\.json$/.test(fixtureName))throw new Error('QA fixture must be a simple JSON filename');
const fixture=fs.readFileSync(path.join(root,'tests/fixtures',fixtureName),'utf8');
const mode=process.argv[4]||'save-failure';
if(!['save-failure','save-enabled'].includes(mode))throw new Error('Unknown QA save mode');
const injection=`<script>
// Isolated test storage; never reads or writes the user's browser archive.
(() => {let raw=${JSON.stringify(fixture).replace(/</g,'\\u003c')}, fail=${mode==='save-failure'};
Object.defineProperty(window,'localStorage',{value:{getItem(key){return key==='phototrace.v1.archive'?raw:null},setItem(key,value){if(fail)throw new Error('QuotaExceededError (QA injected)');if(key==='phototrace.v1.archive')raw=value}}});
Element.prototype.animate=undefined;
window.addEventListener('DOMContentLoaded',()=>{if(!fail)return;const b=document.createElement('button');b.id='qa-enable-saving';b.textContent='测试专用：关闭模拟保存故障';b.style.cssText='position:fixed;top:2px;left:420px;z-index:120;background:#ffefbd';b.onclick=()=>{fail=false;b.textContent='测试专用：保存故障已关闭'};document.body.appendChild(b);});
})();
</script>\n`;
const target=process.argv[2]||'save-failure.html';
if(!/^[a-zA-Z0-9.-]+\.html$/.test(target))throw new Error('QA output must be a simple HTML filename');
fs.writeFileSync(path.join(root,'tests/artifacts',target),html.replace('<script id="phototrace-ui">',injection+'<script id="phototrace-ui">'),'utf8');
console.log('Created isolated save-failure and animation-fallback QA harness.');
