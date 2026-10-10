# PhotoTrace · 摄影工作台

每一场拍摄，都有迹可循。

PhotoTrace 是一款专为摄影师与摄影团队打造的**单文件、零依赖、离线优先**的摄影项目流转与成果管理工作台。从导入、初筛、修图到发布，提供清晰直观的可视化看板与人员协同管理。

- **当前版本**：v1.0（正式发布版）
- **核心架构**：单文件纯原生架构（HTML + CSS + JavaScript 内联整合），无须 Node.js、无须 Webpack/Vite 打包构建、无须外部云端数据库。

---

## 快速使用

### 方式一：GitHub Pages 在线访问
推送到 GitHub 并开启 Pages 后，可在任何现代桌面浏览器中直接打开访问：
- 静态页面由 GitHub Pages 直接托管根目录 `index.html`。
- 所有数据均保存在访问者浏览器的本地缓存（`localStorage`）中，安全离线，保护隐私。

### 方式二：本地直接运行
无需安装任何环境或运行本地服务器：
- 直接在文件管理器中**双击打开 `index.html` 或 `phototrace.html`** 即可开始使用。

---

## 核心功能

1. **项目与进度管理**：
   - 记录拍摄活动名称、日期、星级评分、原片总数、待筛选数、初筛入选数、精修导出数。
   - 综合进度依据真实阶段推导：导入（30%）、初筛（30%）、修图（30%）、发布（10%）。
   - 智能识别筛选状态，支持重新初筛与成果延续。

2. **人物任务与团体流转**：
   - 支持同一场拍摄添加多个出镜人物与团体，并在初筛前后随时维护。
   - 人物视图按阶段（待筛选、待修图、待发布、已完成）聚合人物卡片，同阶段支持一键整批推进。
   - 详情页内嵌快速录入工具栏，直接敲击回车即可将人物加入拍摄。

3. **操作集群与安全撤销**：
   - 人物任务行配备 28px 规范化操作按钮：主推进、外链复制、低干扰删除与紧凑下拉菜单。
   - 任务推进操作提供 10 秒即时撤销支持，避免误触。

4. **硬件与存储留档**：
   - 记录 iPad 筛图、像素蛋糕修图等硬件与软件资源占用状态。
   - 记录原片存储路径、工作目录、交付链接、云备份与长期留档标记。

5. **数据导出与无损备份**：
   - 支持一键导出标准格式 JSON 备份（以本地时间戳命名，如 `phototrace-backup-YYYYMMDD_HHmmss.json`）。
   - 恢复前自动校验并生成快照，支持无缝恢复。

---

## 目录结构说明

```
phototrace/
├── index.html            # GitHub Pages 默认入口 / 主运行文件（单文件全功能）
├── phototrace.html       # 独立正式入口文件（与 index.html 完全一致，方便本地双击运行）
├── README.md             # 项目说明与文档
├── PLAN.md               # 项目演进规划与交互设计记录
├── package.json          # Node 测试脚本入口配置（npm test）
├── .gitignore            # Git 忽略配置
│
├── archive/              # 历史归档目录
│   └── releases/         # 历史发布版本
│       └── v0.9/         # v0.9 封板归档（包含旧版全量单文件 phototrace.html）
│
├── docs/                 # 架构设计与技术文档（保留）
│   ├── PLAN.original.md  # 初始技术规划
│   ├── REFERENCE-AUDIT.md# 参考软件审计与交互对照
│   └── VALIDATION.md     # 业务校验规则与测试设计
│
├── scripts/              # 辅助工具脚本（保留）
│   ├── create-fixtures.cjs   # 生成模拟数据夹具
│   ├── create-qa-harness.cjs # 生成离线保存故障测试页
│   └── normalize-source.cjs  # 源码规范化工具
│
└── tests/                # 自动化测试套件与证据链（保留）
    ├── fixtures/         # 测试用例模拟数据
    ├── artifacts/        # 历史版本与回归测试证据快照
    ├── helpers.cjs       # Node.js 测试加载器
    └── *.test.cjs        # 单元测试与核心业务回归测试
```

### 为什么保留 docs、scripts、tests？
1. **GitHub Pages 零影响**：GitHub Pages 仅托管静态网页（读取根目录的 `index.html`），`docs/`、`scripts/` 与 `tests/` 目录完全不会影响网页的加载性能与部署。
2. **开源规范与工程可信度**：在开源仓库中保留设计文档（`docs/`）与自动化测试（`tests/`），能够清晰证明业务逻辑的严肃性与稳定性，方便后续回顾与迭代。
3. **零外部体积**：测试代码采用 Node 原生测试运行器（`node:test`），无任何第三方 `node_modules` 依赖，仓库整体体积非常小巧。

---

## 业务规则说明

- **综合进度计算**：
  - 进度公式：`30% * 导入 + 30% * 初筛 + 30% * 修图 + 10% * 发布`。
  - 原片与待筛选留空时表示未知，不阻断后续操作。
  - 仅录入初筛入选数且待筛选为 0 时，自动标记为初筛完成（进度 60%）。
  - 若拍摄确实无人物后期任务，可在完成初筛后点击“无需人物后期”，进度直接进入 100% 已完成。
- **重新初筛保护**：
  - 项目重新初筛时，已修图/已发布的成果与链接继续计入进度贡献，任务在人物看板中临时暂停编辑，初筛完成后自动恢复。
- **不再处理与删除**：
  - 取消勾选或删除人物表示该人物不在此拍摄中；
  - 点击“不再处理”则将人物移出有效任务分子与分母，保留其实际修图与发布历史成果。

---

## 保存与恢复机制

- **本地存储键**：
  - 核心存档：`phototrace.v1.archive`
  - 恢复前快照：`phototrace.v1.before-restore`
- **原子事务与防御性写入**：
  - 每次保存均在内存中完整校验（数据完整性、人物任务关联、阶段状态合法性）。
  - 若浏览器存储满载或异常，系统保留未保存工作数据并提供“导出未保存数据”按钮，杜绝脏数据覆写。
- **备份格式**：
  - 标准 JSON 格式：`{ format: "PhotoTrace", version: 1, exportedAt, data }`。

---

## GitHub Pages 部署指南

1. **新建 GitHub 仓库**：
   在 GitHub 上创建一个新的公开（Public）或私有（Private）仓库，名称例如 `phototrace`。

2. **初始化并推送到 GitHub**：
   在本地项目根目录（`D:\codex\phototrace`）打开终端执行：
   ```bash
   git init
   git add .
   git commit -m "feat: release v1.0 and organize project for GitHub Pages"
   git branch -M main
   git remote add origin https://github.com/<你的GitHub用户名>/phototrace.git
   git push -u origin main
   ```

3. **启用 GitHub Pages**：
   - 打开 GitHub 仓库页面，点击 **Settings**（设置）。
   - 在左侧菜单找到 **Pages**。
   - 在 **Build and deployment -> Source** 下拉菜单选择 **Deploy from a branch**。
   - **Branch** 选择 `main`，目录选择 `/ (root)`，点击 **Save**。

4. **访问网站**：
   - 等待约 30 秒至 1 分钟，GitHub Pages 部署完成后，在页面上方会显示访问链接：
     `https://<你的GitHub用户名>.github.io/phototrace/`
   - 打开该链接即可直接使用。

---

## 本地开发与测试

运行自动化测试（需要 Node.js 18+ 环境，无任何 npm 外部安装依赖）：

```bash
npm test
```
