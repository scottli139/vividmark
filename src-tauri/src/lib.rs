use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::Instant;

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

// 读取文件
#[tauri::command]
fn read_file(path: String) -> Result<FileInfo, String> {
    let start = Instant::now();
    log::info!("[read_file] Reading file: {}", path);

    let path_buf = PathBuf::from(&path);

    let content = fs::read_to_string(&path_buf).map_err(|e| {
        log::error!("[read_file] Failed to read: {} - {}", path, e);
        format!("Failed to read file: {}", e)
    })?;

    let name = path_buf
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled.md")
        .to_string();

    let size = content.len();
    log::info!(
        "[read_file] Complete: {} ({} bytes) in {:?}",
        path,
        size,
        start.elapsed()
    );

    Ok(FileInfo { path, content, name })
}

// 保存文件
#[tauri::command]
fn save_file(path: String, content: String) -> Result<SaveResult, String> {
    let start = Instant::now();
    log::info!("[save_file] Writing to: {} ({} bytes)", path, content.len());

    fs::write(&path, &content).map_err(|e| {
        log::error!("[save_file] Failed to write: {} - {}", path, e);
        format!("Failed to save file: {}", e)
    })?;

    log::info!("[save_file] Complete: {} in {:?}", path, start.elapsed());

    Ok(SaveResult {
        success: true,
        error: None,
    })
}

// 检查文件是否存在
#[tauri::command]
fn file_exists(path: String) -> bool {
    let exists = PathBuf::from(&path).exists();
    log::debug!("[file_exists] {} -> {}", path, exists);
    exists
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
                .level_for("vividmark", log::LevelFilter::Debug);

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

            log::info!("[VividMark] Application starting");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![read_file, save_file, file_exists])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
