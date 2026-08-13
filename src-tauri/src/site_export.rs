//! 「导出为网站」的写盘命令。
//!
//! 前端把打开目录渲染成页面 manifest（HTML 文本 + 待复制资产），这里负责
//! 建目录、写 UTF-8 文本、按镜像相对路径复制二进制资产。独立模块，参照 pdf.rs。

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportSiteFile {
    /// 相对输出目录的路径（前端约定 '/' 分隔）
    pub path: String,
    /// 文本内容（HTML 页面 / CSS / .nojekyll），写 UTF-8
    pub content: Option<String>,
    /// 源文件绝对路径（图片等资产），按相对路径原样复制
    pub source_path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportSiteParams {
    pub output_dir: String,
    pub files: Vec<ExportSiteFile>,
}

#[derive(Debug, Serialize)]
pub struct ExportSiteResult {
    pub success: bool,
    pub error: Option<String>,
    pub written: usize,
}

/// 相对路径安全校验：拒绝绝对路径与 `..` 组件，防止逃逸出 output_dir
fn sanitize_relative_path(rel: &str) -> Result<PathBuf, String> {
    let mut out = PathBuf::new();
    for component in Path::new(rel).components() {
        match component {
            Component::Normal(part) => out.push(part),
            Component::CurDir => {}
            _ => return Err(format!("invalid relative path: {rel}")),
        }
    }
    if out.as_os_str().is_empty() {
        return Err("empty relative path".to_string());
    }
    Ok(out)
}

#[tauri::command]
pub fn export_site(params: ExportSiteParams) -> ExportSiteResult {
    let output_dir = Path::new(&params.output_dir);
    let mut written = 0usize;
    let mut errors: Vec<String> = Vec::new();

    for file in &params.files {
        let result = (|| -> Result<(), String> {
            let rel = sanitize_relative_path(&file.path)?;
            let dest = output_dir.join(rel);
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("{}: {e}", file.path))?;
            }
            if let Some(content) = &file.content {
                fs::write(&dest, content).map_err(|e| format!("{}: {e}", file.path))?;
            } else if let Some(source) = &file.source_path {
                fs::copy(source, &dest).map_err(|e| format!("{}: {e}", file.path))?;
            } else {
                return Err(format!("{}: neither content nor sourcePath", file.path));
            }
            Ok(())
        })();
        match result {
            Ok(()) => written += 1,
            Err(e) => errors.push(e),
        }
    }

    ExportSiteResult {
        success: errors.is_empty(),
        // 单文件失败不中断整批；错误取前几条拼接返回
        error: if errors.is_empty() {
            None
        } else {
            Some(errors.into_iter().take(3).collect::<Vec<_>>().join("; "))
        },
        written,
    }
}
