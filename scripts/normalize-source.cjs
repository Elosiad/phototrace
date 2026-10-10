// Restore the static shell after preserving an in-browser development copy.
const fs=require('node:fs');
const path=require('node:path');
const file=path.join(__dirname,'..','phototrace.html');
let html=fs.readFileSync(file,'utf8');
const start=html.indexOf('<body>'),end=html.indexOf('<script id="phototrace-domain">');
if(start<0||end<0)throw new Error('Unexpected application shell');
const shell=`<body>
<header class="topbar">
  <div class="brand"><div class="brand-mark" aria-hidden="true"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M8 6l1-3h6l1 3"/><circle cx="12" cy="13" r="4"/></svg></div><div><h1>PhotoTrace</h1><p>每一场拍摄，都有迹可循</p></div></div>
  <div class="actions"><span id="save-status" class="save-status" role="status">正在读取存档</span><button data-action="backup">导出备份</button><button data-action="restore">恢复备份</button><button class="primary" data-action="new-project">＋ 新建拍摄</button></div>
</header>
<div id="download-notice" class="notice" hidden style="margin:12px 28px 0" role="status"></div>
<main class="workspace" id="workspace">
  <div id="storage-notice" hidden class="notice error" role="alert"></div>
  <div class="intro"><div><p class="eyebrow">PHOTOGRAPHY WORKSPACE</p><h2 id="view-title">拍摄项目</h2><p id="view-subtitle">从导入到发布，把摄影工作放在一处。</p></div><div id="metrics" class="metrics"></div></div>
  <nav class="tabs" role="tablist" aria-label="工作视图"><button role="tab" id="tab-projects" aria-selected="true" data-action="view-projects">项目总览 <span id="project-count" class="tab-count">0</span></button><button role="tab" id="tab-people" aria-selected="false" data-action="view-people">人物任务 <span id="task-count" class="tab-count">0</span></button><button class="quiet" data-action="manage-people">人物库</button></nav>
  <div class="filters" aria-label="搜索与筛选"><input class="search" id="search" type="search" aria-label="搜索项目、人物或团体" placeholder="搜索拍摄、人物、团体…"><select id="rating-filter" aria-label="评级筛选"><option value="">全部评级</option><option value="5">★★★★★</option><option value="4">★★★★</option><option value="3">★★★</option><option value="2">★★</option><option value="1">★</option><option value="0">未评级</option></select><select id="resource-filter" aria-label="资源筛选"><option value="">全部资源</option><option value="active">进行中</option><option value="ipad">iPad 筛图</option><option value="pixcake">像素蛋糕</option><option value="idle">未占用资源</option></select><input id="date-from" type="date" aria-label="起始拍摄日期" title="起始拍摄日期"><input id="date-to" type="date" aria-label="结束拍摄日期" title="结束拍摄日期"><button data-action="clear-filters" class="quiet">重置筛选</button></div>
  <div id="batchbar" hidden></div><div id="empty" hidden></div><div id="board" class="board" aria-label="摄影项目看板"></div><div id="excluded"></div>
  <footer class="footer"><span>本机离线保存 · 定期导出备份</span><span>导入 30% · 初筛 30% · 修图 30% · 发布 10%</span></footer>
</main>
<div id="detail-layer" class="detail-layer" hidden><div class="backdrop" data-action="close-detail"></div><section id="detail-panel" class="detail-panel" role="dialog" aria-modal="true" aria-labelledby="detail-title"></section></div>
<div id="dialog-layer" class="dialog-layer" hidden></div><div id="confirm-layer" class="dialog-layer" hidden></div>
<input id="restore-file" type="file" class="file-control" accept="application/json,.json" aria-label="选择 PhotoTrace 备份文件"><div id="toast" class="toast" role="status" hidden></div>
`;
html=html.slice(0,start)+shell+html.slice(end);
fs.writeFileSync(file,html,'utf8');console.log('Static application shell restored; runtime scripts preserved.');
