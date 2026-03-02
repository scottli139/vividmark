# Typst 离线支持配置指南

## 目录结构

```
public/
└── typst/
    ├── typst_ts_web_compiler_bg.wasm    # ~3MB
    ├── typst_ts_renderer_bg.wasm        # ~2MB
    └── fonts/
        ├── NewComputerModern-Regular.otf
        ├── NewComputerModern-Italic.otf
        ├── NewComputerModernMath-Regular.otf
        └── LibertinusSerif-Regular.otf
```

## 前端初始化配置

```typescript
// src/lib/typst/init.ts
import { $typst } from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs'
import { convertFileSrc } from '@tauri-apps/api/core'
import { appDataDir, join } from '@tauri-apps/api/path'

let initialized = false

export async function initTypstOffline() {
  if (initialized) return
  
  // Tauri 环境下使用本地文件路径
  const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI__
  
  if (isTauri) {
    // 开发环境：使用 public 目录
    // 生产环境：使用 appDataDir 或 resourceDir
    const basePath = import.meta.env.DEV 
      ? '/typst' 
      : await getResourcePath()
    
    $typst.setCompilerInitOptions({
      getModule: () => `${basePath}/typst_ts_web_compiler_bg.wasm`,
      // 字体路径配置
      getFontAssets: () => [`${basePath}/fonts/`]
    })
    
    $typst.setRendererInitOptions({
      getModule: () => `${basePath}/typst_ts_renderer_bg.wasm`
    })
  }
  
  initialized = true
}

async function getResourcePath() {
  // Tauri 2.0 中获取资源目录
  const { resourceDir } = await import('@tauri-apps/api/path')
  const dir = await resourceDir()
  return convertFileSrc(`${dir}/typst`)
}
```

## Tauri 配置修改

```json
// src-tauri/tauri.conf.json
{
  "bundle": {
    "resources": {
      "typst": "./typst"
    }
  }
}
```

## Rust 后端添加字体扫描命令

```rust
// src-tauri/src/lib.rs
use std::path::PathBuf;
use tauri::Manager;

#[tauri::command]
async fn get_system_fonts() -> Result<Vec<String>, String> {
    let mut fonts = vec![];
    
    // macOS 系统字体目录
    #[cfg(target_os = "macos")]
    let font_dirs = vec![
        PathBuf::from("/System/Library/Fonts"),
        PathBuf::from("/Library/Fonts"),
        PathBuf::from("~/Library/Fonts"),
    ];
    
    // Windows 系统字体目录
    #[cfg(target_os = "windows")]
    let font_dirs = vec![
        PathBuf::from("C:\\Windows\\Fonts"),
    ];
    
    // Linux 系统字体目录
    #[cfg(target_os = "linux")]
    let font_dirs = vec![
        PathBuf::from("/usr/share/fonts"),
        PathBuf::from("/usr/local/share/fonts"),
        PathBuf::from("~/.fonts"),
    ];
    
    for dir in font_dirs {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(ext) = path.extension() {
                    if ext == "ttf" || ext == "otf" || ext == "ttc" {
                        fonts.push(path.to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    
    Ok(fonts)
}
```

## 在 Parser 中使用

```typescript
// src/lib/markdown/parser.ts
import { initTypstOffline } from './typst/init'

// 初始化（在应用启动时调用一次）
await initTypstOffline()

// 在 highlight 函数中使用
if (lang === 'typst') {
  try {
    const svg = await $typst.svg({ mainContent: str })
    return `<div class="typst-render">${svg}</div>`
  } catch (err) {
    console.error('Typst render failed:', err)
    return `<pre class="hljs"><code>${escapeHtml(str)}</code></pre>`
  }
}
```

## 字体版权说明

| 字体 | 许可证 | 用途 |
|------|--------|------|
| New Computer Modern | OFL 1.1 | ✅ 可嵌入 |
| Libertinus | OFL 1.1 | ✅ 可嵌入 |
| Noto Sans CJK | OFL 1.1 | ✅ 可嵌入 |

## 备选方案：系统字体优先

如果不希望打包字体，可以通过 Tauri 读取系统字体：

```typescript
// 获取系统字体列表
const systemFonts = await invoke<string[]>('get_system_fonts')

// 传递给 typst.ts
$typst.setCompilerInitOptions({
  getModule: () => '/typst/typst_ts_web_compiler_bg.wasm',
  getFontAssets: () => systemFonts
})
```

这种方案的优点是包体积小，缺点是需要系统已安装相应字体。
