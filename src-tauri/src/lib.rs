use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::Instant;
use tauri::{Manager, WebviewWindow};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;



/// 文件树项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTreeItem {
    pub name: String,
    pub path: String,
    #[serde(rename = "isDirectory")]
    pub is_directory: bool,
    pub children: Option<Vec<FileTreeItem>>,
}

/// 读取目录参数
#[derive(Debug, Deserialize)]
pub struct ReadDirectoryParams {
    pub path: String,
    pub recursive: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub content: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveResult {
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportPdfResult {
    pub success: bool,
    pub error: Option<String>,
}

/// PDF 导出参数
#[derive(Debug, Deserialize)]
pub struct ExportPdfParams {
    pub html_content: String,
    pub title: Option<String>,
}

/// 文件元数据信息，用于诊断
#[derive(Debug)]
struct FileMetadata {
    size: u64,
    permissions: Option<String>,
    modified: Option<String>,
    is_file: bool,
}

/// 获取文件元数据信息（用于诊断日志）
fn get_file_metadata(path: &PathBuf) -> Option<FileMetadata> {
    fs::metadata(path).ok().map(|metadata| {
        let permissions = metadata.permissions();
        #[cfg(unix)]
        let perm_str = format!("{:o}", permissions.mode() & 0o777);
        #[cfg(not(unix))]
        let perm_str = format!("readonly: {}", permissions.readonly());

        FileMetadata {
            size: metadata.len(),
            permissions: Some(perm_str),
            modified: metadata
                .modified()
                .ok()
                .and_then(|t| t.elapsed().ok().map(|d| format!("{:?} ago", d))),
            is_file: metadata.is_file(),
        }
    })
}

/// 格式化错误信息，包含堆栈跟踪上下文
fn format_error_with_context(operation: &str, path: &str, error: &std::io::Error) -> String {
    let error_kind = error.kind();
    let error_desc = match error_kind {
        std::io::ErrorKind::NotFound => "文件不存在",
        std::io::ErrorKind::PermissionDenied => "权限被拒绝",
        std::io::ErrorKind::InvalidInput => "无效的输入",
        std::io::ErrorKind::InvalidData => "无效的数据",
        std::io::ErrorKind::WriteZero => "写入零字节",
        std::io::ErrorKind::UnexpectedEof => "意外的文件结束",
        std::io::ErrorKind::OutOfMemory => "内存不足",
        _ => "未知错误",
    };

    format!(
        "[{}] {} - {} (kind: {:?}, raw: {})",
        operation, path, error_desc, error_kind, error
    )
}

// 读取文件
#[tauri::command]
fn read_file(path: String) -> Result<FileInfo, String> {
    let start = Instant::now();
    let path_buf = PathBuf::from(&path);

    log::info!("[read_file] Starting file read operation");
    log::debug!("[read_file] Target path: {}", path);
    log::debug!("[read_file] Path absolute: {:?}", path_buf.canonicalize().ok());
    log::debug!("[read_file] Parent directory: {:?}", path_buf.parent().and_then(|p| p.to_str()));

    // 读取前记录元数据
    if let Some(meta) = get_file_metadata(&path_buf) {
        log::debug!(
            "[read_file] Pre-read metadata: size={} bytes, permissions={:?}, modified={:?}, is_file={}",
            meta.size,
            meta.permissions,
            meta.modified,
            meta.is_file
        );
    } else {
        log::warn!("[read_file] Unable to retrieve metadata before reading");
    }

    let content = fs::read_to_string(&path_buf).map_err(|e| {
        let error_msg = format_error_with_context("read_file", &path, &e);
        log::error!("[read_file] Operation failed: {}", error_msg);
        
        // 额外诊断：检查父目录是否存在
        if let Some(parent) = path_buf.parent() {
            if !parent.exists() {
                log::error!("[read_file] Parent directory does not exist: {:?}", parent);
            } else {
                log::debug!("[read_file] Parent directory exists: {:?}", parent);
            }
        }
        
        format!("Failed to read file: {}", e)
    })?;

    let name = path_buf
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled.md")
        .to_string();

    let size = content.len();
    let elapsed = start.elapsed();
    
    log::info!(
        "[read_file] ✓ Success: {} ({} bytes, {} chars) in {:?} (~{:.2} MB/s)",
        path,
        size,
        content.chars().count(),
        elapsed,
        if elapsed.as_secs_f64() > 0.0 {
            (size as f64 / 1_048_576.0) / elapsed.as_secs_f64()
        } else {
            0.0
        }
    );

    Ok(FileInfo { path, content, name })
}

// 保存文件
#[tauri::command]
fn save_file(path: String, content: String) -> Result<SaveResult, String> {
    let start = Instant::now();
    let path_buf = PathBuf::from(&path);
    let content_size = content.len();
    let content_chars = content.chars().count();

    log::info!("[save_file] Starting file save operation");
    log::debug!("[save_file] Target path: {}", path);
    log::debug!("[save_file] Content size: {} bytes, {} characters", content_size, content_chars);
    log::debug!("[save_file] Path absolute: {:?}", path_buf.canonicalize().ok());

    // 检查父目录
    if let Some(parent) = path_buf.parent() {
        if !parent.exists() {
            log::warn!("[save_file] Parent directory does not exist, will attempt to create: {:?}", parent);
            if let Err(e) = fs::create_dir_all(parent) {
                log::error!("[save_file] Failed to create parent directories: {}", e);
                return Err(format!("Failed to create directory: {}", e));
            }
            log::info!("[save_file] Created parent directories: {:?}", parent);
        }
    }

    // 如果文件已存在，记录原文件元数据
    if path_buf.exists() {
        if let Some(meta) = get_file_metadata(&path_buf) {
            log::debug!(
                "[save_file] Pre-save metadata: size={} bytes, permissions={:?}, modified={:?}",
                meta.size,
                meta.permissions,
                meta.modified
            );
        }
    } else {
        log::debug!("[save_file] Creating new file");
    }

    let write_start = Instant::now();
    fs::write(&path, &content).map_err(|e| {
        let error_msg = format_error_with_context("save_file", &path, &e);
        log::error!("[save_file] Write operation failed: {}", error_msg);
        
        // 诊断磁盘空间
        if e.kind() == std::io::ErrorKind::Other {
            log::error!("[save_file] Possible causes: insufficient disk space or filesystem error");
        }
        
        format!("Failed to save file: {}", e)
    })?;
    
    let write_elapsed = write_start.elapsed();
    let total_elapsed = start.elapsed();

    // 验证写入后的文件
    if let Some(meta) = get_file_metadata(&path_buf) {
        log::debug!(
            "[save_file] Post-save metadata: size={} bytes, permissions={:?}",
            meta.size,
            meta.permissions
        );
        
        if meta.size as usize != content_size {
            log::warn!(
                "[save_file] Size mismatch! Expected {} bytes, found {} bytes",
                content_size,
                meta.size
            );
        }
    }

    log::info!(
        "[save_file] ✓ Success: {} ({} bytes) in {:?} (write: {:?}, ~{:.2} MB/s)",
        path,
        content_size,
        total_elapsed,
        write_elapsed,
        if total_elapsed.as_secs_f64() > 0.0 {
            (content_size as f64 / 1_048_576.0) / total_elapsed.as_secs_f64()
        } else {
            0.0
        }
    );

    Ok(SaveResult {
        success: true,
        error: None,
    })
}

// 检查文件是否存在
#[tauri::command]
fn file_exists(path: String) -> bool {
    let path_buf = PathBuf::from(&path);
    let exists = path_buf.exists();
    let is_file = path_buf.is_file();

    log::debug!(
        "[file_exists] {} -> exists={}, is_file={}",
        path,
        exists,
        is_file
    );

    exists && is_file
}

/// 读取目录内容
#[tauri::command]
fn read_directory(params: ReadDirectoryParams) -> Result<Vec<FileTreeItem>, String> {
    let start = Instant::now();
    let path_buf = PathBuf::from(&params.path);
    let recursive = params.recursive.unwrap_or(false);

    log::info!("[read_directory] Starting directory read operation");
    log::debug!("[read_directory] Target path: {}", params.path);
    log::debug!("[read_directory] Recursive: {}", recursive);

    if !path_buf.exists() {
        log::error!("[read_directory] Directory does not exist: {}", params.path);
        return Err(format!("Directory does not exist: {}", params.path));
    }

    if !path_buf.is_dir() {
        log::error!("[read_directory] Path is not a directory: {}", params.path);
        return Err(format!("Path is not a directory: {}", params.path));
    }

    let entries = read_directory_recursive(&path_buf, recursive, 0)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let elapsed = start.elapsed();
    log::info!(
        "[read_directory] ✓ Success: {} entries in {:?}",
        entries.len(),
        elapsed
    );

    Ok(entries)
}

// 导出 PDF - 使用系统打印对话框
#[tauri::command]
async fn export_pdf(
    _window: tauri::Window,
    params: ExportPdfParams,
) -> Result<ExportPdfResult, String> {
    let start = Instant::now();
    log::info!("[export_pdf] Starting PDF export operation");
    log::debug!("[export_pdf] Title: {:?}", params.title);
    log::debug!("[export_pdf] HTML content size: {} bytes", params.html_content.len());

    // 创建临时 HTML 文件
    let temp_dir = std::env::temp_dir();
    let timestamp = start.elapsed().as_millis();
    let temp_html_path = temp_dir.join(format!("vividmark_export_{}.html", timestamp));
    
    // 构建完整的 HTML 文档
    let title = params.title.unwrap_or_else(|| "VividMark Export".to_string());
    let full_html = format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px;
        }}
        h1, h2, h3, h4, h5, h6 {{
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
        }}
        h1 {{ font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }}
        h2 {{ font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }}
        h3 {{ font-size: 1.25em; }}
        p {{ margin-bottom: 16px; }}
        code {{
            background-color: #f6f8fa;
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
            font-size: 85%;
        }}
        pre {{
            background-color: #f6f8fa;
            padding: 16px;
            border-radius: 6px;
            overflow: auto;
            font-size: 85%;
            line-height: 1.45;
        }}
        pre code {{
            background-color: transparent;
            padding: 0;
        }}
        blockquote {{
            margin: 0;
            padding: 0 1em;
            color: #6a737d;
            border-left: 0.25em solid #dfe2e5;
        }}
        ul, ol {{
            margin-bottom: 16px;
            padding-left: 2em;
        }}
        li + li {{
            margin-top: 0.25em;
        }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 16px;
        }}
        th, td {{
            padding: 6px 13px;
            border: 1px solid #dfe2e5;
        }}
        th {{
            background-color: #f6f8fa;
            font-weight: 600;
        }}
        tr:nth-child(2n) {{
            background-color: #f6f8fa;
        }}
        img {{
            max-width: 100%;
            height: auto;
        }}
        .task-list-item {{
            list-style-type: none;
        }}
        .admonition {{
            margin: 16px 0;
            padding: 12px 16px;
            border-left: 4px solid;
            border-radius: 4px;
        }}
        .admonition.tip {{ border-color: #28a745; background-color: #f8fff8; }}
        .admonition.warning {{ border-color: #ffc107; background-color: #fffbf0; }}
        .admonition.info {{ border-color: #17a2b8; background-color: #f0f9fb; }}
        .admonition.note {{ border-color: #6c757d; background-color: #f8f9fa; }}
        .admonition.danger {{ border-color: #dc3545; background-color: #fff5f5; }}
        .admonition-title {{
            font-weight: 600;
            margin-bottom: 8px;
        }}
    </style>
</head>
<body>
    {}
</body>
</html>"#,
        title, params.html_content
    );

    // 写入临时文件
    if let Err(e) = fs::write(&temp_html_path, full_html) {
        log::error!("[export_pdf] Failed to create temp HTML file: {}", e);
        return Ok(ExportPdfResult {
            success: false,
            error: Some(format!("Failed to create temp file: {}", e)),
        });
    }

    log::debug!("[export_pdf] Temp HTML file created: {:?}", temp_html_path);

    // 使用系统命令打开 HTML 文件进行打印
    let path_str = temp_html_path.to_string_lossy().to_string();
    
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open")
        .arg(&path_str)
        .spawn();
    
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("cmd")
        .args(["/C", "start", "", &path_str])
        .spawn();
    
    #[cfg(target_os = "linux")]
    let result = std::process::Command::new("xdg-open")
        .arg(&path_str)
        .spawn();
    
    match result {
        Ok(_) => {
            log::info!("[export_pdf] ✓ Success: opened HTML for printing in {:?}", start.elapsed());
            Ok(ExportPdfResult {
                success: true,
                error: None,
            })
        }
        Err(e) => {
            log::error!("[export_pdf] Failed to open for printing: {}", e);
            Ok(ExportPdfResult {
                success: false,
                error: Some(format!("Failed to open for printing: {}", e)),
            })
        }
    }
}

/// 使用 WebView 原生打印功能导出 PDF（应用内打印对话框）
#[tauri::command]
async fn print_pdf(window: WebviewWindow, file_name: String) -> Result<ExportPdfResult, String> {
    log::info!("[print_pdf] Opening native print dialog for: {}", file_name);
    
    // 注入 CSS 进行打印准备
    let prepare_print = r#"
        (function() {
            // 清理之前的样式
            const existing = document.getElementById('print-pdf-style');
            if (existing) existing.remove();
            
            // 移除之前的内联样式恢复
            if (window._printCleanup) {
                window._printCleanup();
                delete window._printCleanup;
            }
            
            // 保存原始标题用于恢复
            if (!window._originalTitle) {
                window._originalTitle = document.title;
            }
            
            // 保存需要恢复的元素和值
            const toRestore = [];
            
            // 修复高度限制 - 找到所有限制高度的元素
            document.querySelectorAll('*').forEach(el => {
                const style = window.getComputedStyle(el);
                const height = style.height;
                const maxHeight = style.maxHeight;
                const overflow = style.overflow;
                
                // 检查是否有固定高度或溢出隐藏
                if ((height.includes('px') || height.includes('vh') || height.includes('%')) &&
                    height !== 'auto' && parseInt(height) > 100) {
                    toRestore.push({ el: el, height: el.style.height });
                    el.style.height = 'auto';
                }
                
                if ((maxHeight.includes('px') || maxHeight.includes('vh')) && maxHeight !== 'none') {
                    toRestore.push({ el: el, maxHeight: el.style.maxHeight });
                    el.style.maxHeight = 'none';
                }
                
                if (overflow === 'hidden' || overflow === 'auto' || overflow === 'scroll') {
                    toRestore.push({ el: el, overflow: el.style.overflow });
                    el.style.overflow = 'visible';
                }
            });
            
            // 创建恢复函数
            window._printCleanup = function() {
                toRestore.forEach(item => {
                    if (item.height !== undefined) item.el.style.height = item.height;
                    if (item.maxHeight !== undefined) item.el.style.maxHeight = item.maxHeight;
                    if (item.overflow !== undefined) item.el.style.overflow = item.overflow;
                });
                // 恢复原标题
                if (window._originalTitle) {
                    document.title = window._originalTitle;
                }
            };
            
            // 添加打印样式
            const style = document.createElement('style');
            style.id = 'print-pdf-style';
            style.textContent = `
                @media print {
                    @page { margin: 15mm; size: auto; }
                    
                    /* 隐藏工具栏 */
                    .h-12, .h-14, header, nav,
                    div[class*="toolbar"],
                    div[style*="height: 3rem"] {
                        display: none !important;
                    }
                    
                    /* 隐藏侧边栏 */
                    aside, .border-r, .w-64, .w-60, .w-56,
                    div[class*="sidebar"] {
                        display: none !important;
                    }
                    
                    /* 主内容 */
                    main, .flex-1, article, body {
                        width: 100% !important;
                        height: auto !important;
                        max-height: none !important;
                        overflow: visible !important;
                        margin: 0 !important;
                        padding: 20px !important;
                    }
                    
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
                        line-height: 1.6 !important;
                        color: #333 !important;
                        font-size: 11pt !important;
                    }
                    
                    /* 代码块使用等宽字体 */
                    code, pre, pre code {
                        font-family: 'Courier New', 'Courier', monospace !important;
                        font-variant-ligatures: none !important;
                        -webkit-font-feature-settings: "liga" 0 !important;
                    }
                    
                    /* 强制所有子元素继承 */
                    pre *, code *, pre code * {
                        font-family: inherit !important;
                    }
                    
                    pre {
                        background-color: #f6f8fa !important;
                        padding: 12px !important;
                        border-radius: 6px !important;
                        overflow-x: auto !important;
                        white-space: pre !important;
                        word-wrap: normal !important;
                    }
                    
                    pre, code, h1, h2, h3, h4, img, table {
                        page-break-inside: avoid !important;
                    }
                }
            `;
            document.head.appendChild(style);
            
            // 打印后清理
            window.addEventListener('afterprint', function onAfterPrint() {
                window.removeEventListener('afterprint', onAfterPrint);
                
                const s = document.getElementById('print-pdf-style');
                if (s) s.remove();
                
                if (window._printCleanup) {
                    window._printCleanup();
                    delete window._printCleanup;
                }
            });
            
            return true;
        })()
    "#;
    
    if let Err(e) = window.eval(prepare_print) {
        log::warn!("[print_pdf] Failed to prepare print: {}", e);
    }
    
    // 注意：macOS 的打印对话框默认使用应用 bundle 名称作为 PDF 文件名
    // 这是系统行为，无法通过标准 API 修改
    // 用户需要在打印对话框中手动更改文件名
    
    // 使用 WebView 的 print 方法
    match window.print() {
        Ok(_) => {
            log::info!("[print_pdf] ✓ Print dialog opened");
            Ok(ExportPdfResult { success: true, error: None })
        }
        Err(e) => {
            log::error!("[print_pdf] Failed: {}", e);
            Ok(ExportPdfResult { success: false, error: Some(e.to_string()) })
        }
    }
}

/// 递归读取目录
fn read_directory_recursive(
    path: &PathBuf,
    recursive: bool,
    depth: usize,
) -> Result<Vec<FileTreeItem>, std::io::Error> {
    const MAX_DEPTH: usize = 10;

    if depth > MAX_DEPTH {
        log::warn!("[read_directory] Maximum recursion depth reached: {}", path.display());
        return Ok(vec![]);
    }

    let mut entries = vec![];
    let mut dir_entries: Vec<_> = fs::read_dir(path)?.collect::<Result<Vec<_>, _>>()?;

    // 排序：文件夹在前，文件在后，按名称排序
    dir_entries.sort_by(|a, b| {
        let a_is_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let b_is_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);

        match (a_is_dir, b_is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.file_name().cmp(&b.file_name()),
        }
    });

    for entry in dir_entries {
        let file_type = entry.file_type()?;
        let is_directory = file_type.is_dir();
        let name = entry.file_name().to_string_lossy().to_string();
        let entry_path = entry.path().to_string_lossy().to_string();

        // 跳过隐藏文件和特定目录
        if name.starts_with('.') || name == "node_modules" || name == "target" {
            continue;
        }

        let children = if is_directory && recursive {
            Some(read_directory_recursive(&entry.path(), recursive, depth + 1)?)
        } else {
            None
        };

        entries.push(FileTreeItem {
            name,
            path: entry_path,
            is_directory,
            children,
        });
    }

    Ok(entries)
}

/// 获取系统信息，用于启动诊断
fn log_system_info() {
    log::info!("[System] ============================================");
    log::info!("[System] VividMark Backend Starting");
    log::info!("[System] ============================================");
    
    // Rust 版本信息
    log::info!("[System] Rust version: {}", env!("CARGO_PKG_RUST_VERSION"));
    
    // 操作系统信息
    #[cfg(target_os = "macos")]
    log::info!("[System] Platform: macOS");
    #[cfg(target_os = "windows")]
    log::info!("[System] Platform: Windows");
    #[cfg(target_os = "linux")]
    log::info!("[System] Platform: Linux");
    
    log::info!("[System] Architecture: {}", std::env::consts::ARCH);
    
    // 当前工作目录
    if let Ok(cwd) = std::env::current_dir() {
        log::info!("[System] Working directory: {:?}", cwd);
    }
    
    // 临时目录
    if let Ok(tmp) = std::env::temp_dir().canonicalize() {
        log::info!("[System] Temp directory: {:?}", tmp);
    }
    
    // 内存信息（如果可用）
    #[cfg(target_os = "macos")]
    {
        log::debug!("[System] Memory info available via system_profiler");
    }
    
    log::info!("[System] ============================================");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Configure logging for both debug and release builds
            let log_builder = tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .level_for("vividmark", log::LevelFilter::Debug)
                .level_for("app_lib", log::LevelFilter::Debug);

            // In debug mode, also log to console
            #[cfg(debug_assertions)]
            let log_builder = log_builder.target(tauri_plugin_log::Target::new(
                tauri_plugin_log::TargetKind::Stdout,
            ));

            // Always log to file for diagnostics
            let log_builder = log_builder.target(tauri_plugin_log::Target::new(
                tauri_plugin_log::TargetKind::LogDir { file_name: None },
            ));

            app.handle().plugin(log_builder.build())?;

            // Log system information
            log_system_info();
            
            // Log log file location
            match app.path().app_log_dir() {
                Ok(log_dir) => {
                    log::info!("[System] Log directory: {:?}", log_dir);
                }
                Err(e) => {
                    log::warn!("[System] Could not determine log directory: {}", e);
                }
            }

            log::info!("[VividMark] Application started successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![read_file, save_file, file_exists, read_directory, export_pdf, print_pdf])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
