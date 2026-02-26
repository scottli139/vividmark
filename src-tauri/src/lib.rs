use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::Instant;
use tauri::Manager;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

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
        .invoke_handler(tauri::generate_handler![read_file, save_file, file_exists])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
