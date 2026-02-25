use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

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
    let path_buf = PathBuf::from(&path);

    let content = fs::read_to_string(&path_buf)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let name = path_buf
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled.md")
        .to_string();

    Ok(FileInfo { path, content, name })
}

// 保存文件
#[tauri::command]
fn save_file(path: String, content: String) -> Result<SaveResult, String> {
    fs::write(&path, &content)
        .map_err(|e| format!("Failed to save file: {}", e))?;

    Ok(SaveResult {
        success: true,
        error: None,
    })
}

// 检查文件是否存在
#[tauri::command]
fn file_exists(path: String) -> bool {
    PathBuf::from(&path).exists()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![read_file, save_file, file_exists])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
