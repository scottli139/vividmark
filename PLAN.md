# VividMark 开发计划

> 类似 Typora 的所见即所得 Markdown 编辑器

## 项目信息

- **项目名称**: VividMark
- **技术栈**: Tauri 2.0 + React + TypeScript
- **仓库**: https://github.com/scottli139/vividmark

---

## 开发进度

### Phase 1: 基础框架 ✅ (已完成)

- [x] 项目初始化 (Tauri + React + Vite)
- [x] 配置 TailwindCSS
- [x] 配置 Zustand 状态管理
- [x] 基础布局 (Toolbar + Sidebar + Editor)
- [x] 深色模式切换
- [x] 开发环境验证

### Phase 2: 核心编辑器 ✅ (已完成)

- [x] Markdown 解析 (markdown-it)
- [x] 块级渲染组件
- [x] 块级编辑 (点击编辑，失焦渲染)
- [x] 优化块级切换体验 (减少闪烁)
- [x] 支持行内元素编辑 (粗体、斜体、链接)
- [x] 代码块语法高亮

### Phase 3: 文件操作 ✅ (已完成)

- [x] Rust 后端文件读写命令
- [x] 文件对话框插件集成
- [x] 工具栏文件操作按钮
- [x] 快捷键绑定 (Cmd+O, Cmd+S, Cmd+N)
- [x] 拖拽打开文件
- [x] 最近文件列表
- [x] 自动保存

### Phase 4: 编辑增强 (待开始)

- [ ] 快捷键工具栏 (Bold, Italic, Link, etc.)
- [ ] 表格编辑
- [ ] 图片插入与预览
- [ ] 数学公式 (KaTeX)
- [ ] 任务列表 (Checkbox)
- [ ] 撤销/重做栈

### Phase 5: 文件管理 (待开始)

- [ ] 侧边栏文件树
- [ ] 文件夹打开
- [ ] 大纲视图增强 (点击跳转)
- [ ] 多标签页
- [ ] 文件变更监控 (自动重载)

### Phase 6: 高级功能 (待开始)

- [ ] 主题系统 (CSS 主题切换)
- [ ] 自定义主题编辑
- [ ] 导出 PDF
- [ ] 导出 HTML
- [ ] 导出 Word
- [ ] 搜索与替换

### Phase 7: 打磨优化 (待开始)

- [ ] 性能优化 (大文件处理)
- [ ] 原生菜单集成
- [ ] 系统托盘
- [ ] 快捷键自定义
- [ ] 偏好设置面板
- [ ] 多语言支持

---

## 工程化改进 (后续 Session)

### Phase 8: 代码规范配置

- [ ] 配置 ESLint 规则 (extends, rules)
- [ ] 配置 Prettier 格式化规则
- [ ] 配置 TypeScript 严格模式
- [ ] 添加 .editorconfig 统一编辑器配置
- [ ] 添加 pre-commit hooks (husky + lint-staged)
- [ ] 创建 CONTRIBUTING.md 文档

**建议配置文件：**
```
.prettierrc      # Prettier 配置
.prettierignore  # Prettier 忽略文件
.eslintrc.js     # ESLint 配置 (如需自定义)
.editorconfig    # 编辑器统一配置
```

### Phase 9: 自动化测试

- [ ] 配置 Vitest 单元测试
- [ ] 添加 React Testing Library 组件测试
- [ ] 配置 Tauri E2E 测试 (WebDriver/Playwright)
- [ ] 配置 GitHub Actions CI/CD
  - [ ] 自动运行测试
  - [ ] 自动构建多平台版本
  - [ ] 自动发布 Release

**测试策略：**
- 单元测试：hooks, utils, store
- 组件测试：Editor, Toolbar, Sidebar
- E2E 测试：文件操作、编辑流程

### Phase 10: 品牌设计

- [ ] 设计应用 Logo 图标
  - 考虑使用 AI 图像生成 API (如 Seedream)
  - 需要生成多尺寸图标
- [ ] 创建图标文件
  - [ ] 32x32.png
  - [ ] 128x128.png
  - [ ] 128x128@2x.png
  - [ ] icon.icns (macOS)
  - [ ] icon.ico (Windows)
- [ ] 设计应用启动画面 (Splash Screen)
- [ ] 设计网站/README 横幅图

**Logo 设计思路：**
- 体现 Markdown 编辑器特性
- 简洁现代的设计风格
- 支持深色/浅色两种变体

---

## 技术细节

### 核心依赖

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.10.1",
    "@tauri-apps/plugin-dialog": "^2.6.0",
    "@tauri-apps/plugin-fs": "^2.4.5",
    "markdown-it": "^14.1.1",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "zustand": "^5.0.11"
  }
}
```

### 目录结构

```
vividmark/
├── src/                    # React 前端
│   ├── components/
│   │   ├── Editor/         # 核心编辑器
│   │   ├── Sidebar/        # 侧边栏
│   │   └── Toolbar/        # 工具栏
│   ├── hooks/              # 自定义 Hooks
│   ├── stores/             # Zustand 状态
│   ├── lib/
│   │   ├── markdown/       # Markdown 解析
│   │   └── fileOps.ts      # 文件操作
│   ├── styles/             # 全局样式
│   └── App.tsx
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── lib.rs          # 主逻辑 + 命令
│   │   └── main.rs         # 入口
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

---

## 下一步行动

### 优先级高

1. **Phase 8: 代码规范配置** - 保证代码风格统一
2. **Phase 9: 自动化测试** - 保证代码质量
3. **Phase 10: 品牌设计** - 提升产品形象

### 功能开发

1. 添加表格编辑支持
2. 添加图片插入与预览
3. 实现撤销/重做功能
4. 添加多标签页支持

---

## 启动命令

```bash
cd /Volumes/hagibis1t/huicom/github/markdown/vividmark

# 开发模式
pnpm tauri dev

# 构建
pnpm tauri build
```

---

## 注意事项

1. **网络问题**: 使用清华镜像
   - Cargo: `~/.cargo/config.toml` 已配置
   - npm: 自动使用镜像

2. **代理问题**: git 代理已清除，如需恢复:
   ```bash
   git config --global http.proxy http://127.0.0.1:7897
   git config --global https.proxy http://127.0.0.1:7897
   ```
