//! Typora 式 PDF 导出：隐藏 Webview 窗口渲染独立 HTML + 平台原生 print-to-PDF。
//!
//! - macOS：`NSPrintOperation` + `NSPrintSaveJob` 静默打印到文件
//!   （`sharedPrintInfo` copy + `canSpawnSeparateThread` + `runOperationModalForWindow`，
//!   与 wry 的 print 实现同款模式；`run()` + 新建 `NSPrintInfo` 会导致分页失控，勿用）
//! - Windows：WebView2 `ICoreWebView2_7::PrintToPdf`
//! - Linux：webkit2gtk 2.0 未绑定 `print_to_pdf`，返回 unsupported，前端回退打印对话框

use serde::Deserialize;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::ExportPdfResult;

/// 导出页自定义协议（lib.rs 注册，serve 当前导出任务的 HTML）
pub const PDF_SCHEME: &str = "vividmark-pdf";
pub const PDF_WINDOW_LABEL: &str = "pdf-export";
/// 等待页面加载（含图片等子资源）的超时；超时后继续打印（缺图好过失败）
const PAGE_LOAD_TIMEOUT: Duration = Duration::from_secs(15);
/// 等待系统打印管线写盘的超时
const PRINT_TIMEOUT: Duration = Duration::from_secs(60);

/// PDF 书签大纲项（前端从渲染后 HTML 提取，文本与 PDF 一致）
/// 仅 macOS 后处理读取字段（Windows 由 Chromium 自带大纲）
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub struct PdfOutlineItem {
    pub text: String,
    pub level: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPdfFileParams {
    pub html: String,
    pub output_path: String,
    #[allow(dead_code)]
    pub title: Option<String>,
    pub outline: Option<Vec<PdfOutlineItem>>,
}

/// 当前导出任务的 HTML（同时只有一个导出任务，由 EXPORT_LOCK 保证）
fn export_html_slot() -> &'static Mutex<Option<String>> {
    static SLOT: OnceLock<Mutex<Option<String>>> = OnceLock::new();
    SLOT.get_or_init(|| Mutex::new(None))
}

/// 导出任务串行化（排队而非报错）
fn export_lock() -> &'static tokio::sync::Mutex<()> {
    static LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| tokio::sync::Mutex::new(()))
}

fn unsupported(reason: &str) -> ExportPdfResult {
    // 前端以 "unsupported" 前缀识别并回退到打印对话框
    ExportPdfResult {
        success: false,
        error: Some(format!("unsupported: {}", reason)),
    }
}

fn failure(reason: impl Into<String>) -> ExportPdfResult {
    ExportPdfResult {
        success: false,
        error: Some(reason.into()),
    }
}

/// 自定义协议 handler：serve 当前导出 HTML（无任何状态时 404）
pub fn handle_pdf_protocol(
    _ctx: tauri::UriSchemeContext<'_, tauri::Wry>,
    _request: tauri::http::Request<Vec<u8>>,
    responder: tauri::UriSchemeResponder,
) {
    let html = export_html_slot().lock().unwrap().clone();
    match html {
        Some(html) => responder.respond(
            tauri::http::Response::builder()
                .header("Content-Type", "text/html; charset=utf-8")
                .body(html.into_bytes())
                .unwrap(),
        ),
        None => responder.respond(
            tauri::http::Response::builder()
                .status(404)
                .body(Vec::new())
                .unwrap(),
        ),
    }
}

/// 前端据此决定是否走保存对话框流程（false → 直接回退打印对话框）
#[tauri::command]
pub fn pdf_export_supported() -> bool {
    platform::supported()
}

/// 保存为 PDF 文件：隐藏窗口渲染 HTML → 平台原生 print-to-PDF 写入 output_path
#[tauri::command]
pub async fn export_pdf_file(
    app: AppHandle,
    params: ExportPdfFileParams,
) -> Result<ExportPdfResult, String> {
    let _guard = export_lock().lock().await;

    if !platform::supported() {
        return Ok(unsupported(platform::UNSUPPORTED_REASON));
    }

    let output_path = ensure_pdf_extension(&params.output_path);
    log::info!("[export_pdf_file] Exporting to: {}", output_path);

    *export_html_slot().lock().unwrap() = Some(params.html);
    // 任何提前返回都要清空 slot 并销毁窗口
    let result = export_pdf_file_inner(&app, &output_path, params.outline.as_deref()).await;
    *export_html_slot().lock().unwrap() = None;
    result
}

fn ensure_pdf_extension(path: &str) -> String {
    if path.to_lowercase().ends_with(".pdf") {
        path.to_string()
    } else {
        format!("{}.pdf", path)
    }
}

async fn export_pdf_file_inner(
    app: &AppHandle,
    output_path: &str,
    outline: Option<&[PdfOutlineItem]>,
) -> Result<ExportPdfResult, String> {
    let (ready_tx, ready_rx) = tokio::sync::oneshot::channel::<()>();
    let ready_tx = Mutex::new(Some(ready_tx));

    let window = match WebviewWindowBuilder::new(
        app,
        PDF_WINDOW_LABEL,
        WebviewUrl::CustomProtocol(export_url()),
    )
    .visible(false)
    .inner_size(800.0, 1132.0)
    .on_page_load(move |_window, payload| {
        use tauri::webview::PageLoadEvent;
        if matches!(payload.event(), PageLoadEvent::Finished)
            && payload.url().scheme() == PDF_SCHEME
        {
            if let Some(tx) = ready_tx.lock().unwrap().take() {
                let _ = tx.send(());
            }
        }
    })
    .build()
    {
        Ok(w) => w,
        Err(e) => {
            log::error!("[export_pdf_file] Failed to create hidden window: {}", e);
            return Ok(failure(format!("failed to create export window: {}", e)));
        }
    };

    // 等页面加载完成；超时打印警告但继续（例如远程图片不可达）
    if tokio::time::timeout(PAGE_LOAD_TIMEOUT, ready_rx)
        .await
        .is_err()
    {
        log::warn!(
            "[export_pdf_file] Page load timed out after {:?}, printing anyway",
            PAGE_LOAD_TIMEOUT
        );
    }

    let result = platform::print_to_pdf_file(&window, output_path, outline).await;

    if let Err(e) = window.destroy() {
        log::warn!("[export_pdf_file] Failed to destroy export window: {}", e);
    }
    Ok(result)
}

#[cfg(target_os = "windows")]
fn export_url() -> tauri::Url {
    // Windows 上自定义协议映射为 http://<scheme>.localhost
    tauri::Url::parse(&format!("http://{}.localhost/export.html", PDF_SCHEME)).unwrap()
}

#[cfg(not(target_os = "windows"))]
fn export_url() -> tauri::Url {
    tauri::Url::parse(&format!("{}://localhost/export.html", PDF_SCHEME)).unwrap()
}

// ---------------------------------------------------------------------------
// macOS：NSPrintOperation + NSPrintSaveJob 静默打印到文件
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
mod platform {
    use super::*;
    use objc2::rc::Retained;
    use objc2::runtime::{AnyObject, Bool};
    use objc2::{define_class, msg_send, sel, AnyThread, ClassType};
    use objc2_app_kit::{NSPrintInfo, NSPrintJobSavingURL, NSPrintSaveJob, NSWindow};
    use objc2_foundation::{NSCopying, NSPoint, NSString, NSURL};
    use objc2_pdf_kit::{PDFDestination, PDFDisplayBox, PDFDocument, PDFOutline};
    use objc2_web_kit::WKWebView;
    use tokio::sync::oneshot;

    pub const UNSUPPORTED_REASON: &str = "macOS WKWebView print operation unavailable";

    pub fn supported() -> bool {
        // WKWebView.printOperationWithPrintInfo: 需要 macOS 11+（wry print 同款 API 检查）
        unsafe {
            let yes: Bool = msg_send![
                WKWebView::class(),
                instancesRespondToSelector: sel!(printOperationWithPrintInfo:)
            ];
            yes.as_bool()
        }
    }

    /// 完成回调通过 contextInfo 携带（sender + delegate 自身的生命周期）
    type PrintCallback = (
        oneshot::Sender<Result<(), String>>,
        Retained<PdfPrintDelegate>,
    );

    define_class!(
        #[unsafe(super(objc2_foundation::NSObject))]
        #[name = "VividMarkPdfPrintDelegate"]
        struct PdfPrintDelegate;

        impl PdfPrintDelegate {
            // 与 NSPrintOperation runOperationModalForWindow 的 didRunSelector 约定一致
            #[unsafe(method(printOperationDidRun:success:contextInfo:))]
            fn did_run(
                &self,
                _op: *mut AnyObject,
                success: Bool,
                context_info: *mut std::ffi::c_void,
            ) {
                if context_info.is_null() {
                    return;
                }
                unsafe {
                    let (tx, _delegate) = *Box::from_raw(context_info as *mut PrintCallback);
                    let result = if success.as_bool() {
                        Ok(())
                    } else {
                        Err("print operation reported failure".to_string())
                    };
                    let _ = tx.send(result);
                }
            }
        }
    );

    impl PdfPrintDelegate {
        fn new() -> Retained<Self> {
            unsafe { msg_send![Self::class(), new] }
        }
    }

    pub async fn print_to_pdf_file(
        window: &WebviewWindow,
        output_path: &str,
        outline: Option<&[PdfOutlineItem]>,
    ) -> ExportPdfResult {
        let (tx, rx) = oneshot::channel::<Result<(), String>>();
        let path = output_path.to_string();

        let launched = window.with_webview(move |webview| unsafe {
            let wk_webview: &WKWebView = &*(webview.inner() as *const WKWebView);
            let ns_window: &NSWindow = &*(webview.ns_window() as *const NSWindow);

            // 关键：必须以 sharedPrintInfo 为底（自带合法纸张尺寸），
            // 全新 NSPrintInfo + run() 会导致无限分页（spike 实测）
            let print_info = NSPrintInfo::sharedPrintInfo().copy();
            // 15mm 页边距（单位 point）
            print_info.setTopMargin(42.52);
            print_info.setBottomMargin(42.52);
            print_info.setLeftMargin(42.52);
            print_info.setRightMargin(42.52);
            print_info.setJobDisposition(NSPrintSaveJob);
            let url = NSURL::fileURLWithPath(&NSString::from_str(&path));
            print_info.dictionary().insert(NSPrintJobSavingURL, &url);

            let print_op = wk_webview.printOperationWithPrintInfo(&print_info);
            print_op.setShowsPrintPanel(false);
            print_op.setShowsProgressPanel(false);
            // wry 同款：分离线程执行，主线程不阻塞
            print_op.setCanSpawnSeparateThread(true);

            let delegate = PdfPrintDelegate::new();
            let callback: *mut PrintCallback = Box::into_raw(Box::new((tx, delegate.clone())));
            print_op.runOperationModalForWindow_delegate_didRunSelector_contextInfo(
                ns_window,
                Some(&*delegate),
                Some(sel!(printOperationDidRun:success:contextInfo:)),
                callback as *mut std::ffi::c_void,
            );
        });

        if let Err(e) = launched {
            log::error!("[export_pdf_file] with_webview failed: {}", e);
            return failure(format!("failed to access webview: {}", e));
        }

        match tokio::time::timeout(PRINT_TIMEOUT, rx).await {
            Ok(Ok(Ok(()))) => {
                if let Some(items) = outline {
                    add_pdf_outline(output_path, items);
                }
                log::info!("[export_pdf_file] ✓ PDF written: {}", output_path);
                ExportPdfResult {
                    success: true,
                    error: None,
                }
            }
            Ok(Ok(Err(e))) => {
                log::error!("[export_pdf_file] Print failed: {}", e);
                failure(format!("print failed: {}", e))
            }
            Ok(Err(_)) => {
                log::error!("[export_pdf_file] Print callback dropped unexpectedly");
                failure("print callback dropped")
            }
            Err(_) => {
                log::error!(
                    "[export_pdf_file] Print timed out after {:?}",
                    PRINT_TIMEOUT
                );
                failure("print timed out")
            }
        }
    }

    /// 打印完成后用 PDFKit 后处理：按标题文本检索位置，重建 PDF 书签大纲。
    /// WebKit 打印不生成 outline（Chromium 会自动生成，Windows 无需此步骤）。
    /// 个别标题检索失败时跳过该项，不影响整体。
    fn add_pdf_outline(output_path: &str, outline: &[PdfOutlineItem]) {
        if outline.is_empty() {
            return;
        }
        unsafe {
            let url = NSURL::fileURLWithPath(&NSString::from_str(output_path));
            let Some(doc) = PDFDocument::initWithURL(PDFDocument::alloc(), &url) else {
                log::warn!("[export_pdf_file] PDFKit failed to open {}", output_path);
                return;
            };

            // WebKit 的 PDF 文本提取会把部分汉字映射为兼容表意文字（八→⼋ U+2F08）
            // 或康熙部首增补字符（风→⻛ U+2EDB，该区块 Unicode 无分解映射，NFKC 不折叠），
            // 并在中英文边界插入空格 —— PDFKit findString 精确匹配不可靠。
            // 改为自管检索：每页文本 NFKC 归一 + 去空白 + 部首字符通配，做包含匹配。
            let page_count = doc.pageCount();
            let mut pages_text: Vec<String> = Vec::with_capacity(page_count);
            for i in 0..page_count {
                let text = doc
                    .pageAtIndex(i)
                    .and_then(|page| page.string())
                    .map(|s| normalize_pdf_text(&s.to_string()))
                    .unwrap_or_default();
                pages_text.push(text);
            }

            let root = PDFOutline::new();
            // 栈底是不可见 root（level 0）；按 level 维护父子层级
            let mut stack: Vec<(u32, Retained<PDFOutline>)> = vec![(0, root.clone())];
            // 标题按文档顺序出现，页码游标只向前移动（重复标题按序定位）
            let mut start_page = 0usize;
            let mut added = 0u32;

            for item in outline {
                let needle = normalize_pdf_text(&item.text);
                if needle.is_empty() {
                    continue;
                }
                let found_page = pages_text
                    .iter()
                    .enumerate()
                    .skip(start_page)
                    .find(|(_, text)| pdf_text_contains(text, &needle))
                    .map(|(i, _)| i);
                let Some(page_index) = found_page else {
                    log::debug!("[export_pdf_file] outline text not found: {}", item.text);
                    continue;
                };
                start_page = page_index;

                let Some(page) = doc.pageAtIndex(page_index) else {
                    continue;
                };
                // 目标点：所在页页顶
                let bounds = page.boundsForBox(PDFDisplayBox::MediaBox);
                let point = NSPoint::new(0.0, bounds.size.height);
                let dest =
                    PDFDestination::initWithPage_atPoint(PDFDestination::alloc(), &page, point);

                let node = PDFOutline::new();
                node.setLabel(Some(&NSString::from_str(&item.text)));
                node.setDestination(Some(&dest));
                while stack.last().is_some_and(|(level, _)| *level >= item.level) {
                    stack.pop();
                }
                let parent = &stack.last().unwrap().1;
                parent.insertChild_atIndex(&node, parent.numberOfChildren());
                stack.push((item.level, node));

                added += 1;
            }

            if added > 0 {
                doc.setOutlineRoot(Some(&root));
                if !doc.writeToURL(&url) {
                    log::warn!("[export_pdf_file] Failed to write outline to PDF");
                } else {
                    log::info!("[export_pdf_file] PDF outline: {} bookmarks", added);
                }
            }
        }
    }

    /// PDF 文本归一化：NFKC（兼容表意文字 → 统一汉字、全角 → 半角）+ 去除全部空白
    fn normalize_pdf_text(s: &str) -> String {
        use unicode_normalization::UnicodeNormalization;
        s.chars().nfkc().filter(|c| !c.is_whitespace()).collect()
    }

    /// 归一化后的包含匹配；haystack 侧康熙部首/兼容字符按单字符通配处理
    ///（WebKit 把部分汉字提取为 U+2E80–U+2EFF 增补部首，无 Unicode 分解映射）
    fn pdf_text_contains(haystack: &str, needle: &str) -> bool {
        fn is_radical(c: char) -> bool {
            matches!(c, '\u{2E80}'..='\u{2EFF}' | '\u{2F00}'..='\u{2FDF}')
        }
        let h: Vec<char> = haystack.chars().collect();
        let n: Vec<char> = needle.chars().collect();
        if n.is_empty() || h.len() < n.len() {
            return false;
        }
        (0..=h.len() - n.len()).any(|start| {
            n.iter()
                .enumerate()
                .all(|(i, &nc)| is_radical(h[start + i]) || h[start + i] == nc)
        })
    }
}

// ---------------------------------------------------------------------------
// Windows：WebView2 ICoreWebView2_7::PrintToPdf
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
mod platform {
    use super::*;
    use std::sync::Arc;
    use tokio::sync::oneshot;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Environment6, ICoreWebView2_7,
    };
    use webview2_com::PrintToPdfCompletedHandler;
    use windows::core::{Interface, HSTRING, PCWSTR};

    pub const UNSUPPORTED_REASON: &str = "unreachable on Windows";

    pub fn supported() -> bool {
        // PrintToPdf 需要 WebView2 Runtime 1.0.1518.46+（2023 起基本普及）；
        // 过旧时运行时 cast 失败 → unsupported 错误 → 前端回退打印对话框
        true
    }

    pub async fn print_to_pdf_file(
        window: &WebviewWindow,
        output_path: &str,
        // Chromium 打印管线自动从标题生成 PDF 书签，无需后处理
        _outline: Option<&[PdfOutlineItem]>,
    ) -> ExportPdfResult {
        let (tx, rx) = oneshot::channel::<Result<(), String>>();
        // tx 既要给完成回调、又要覆盖“调用本身失败”的路径，用 Arc<Mutex<Option>> 共享
        let shared_tx = Arc::new(Mutex::new(Some(tx)));
        let path = output_path.to_string();
        let shared_in_closure = shared_tx.clone();

        let launched = window.with_webview(move |webview| unsafe {
            let send_err = |msg: String| {
                if let Some(tx) = shared_in_closure.lock().unwrap().take() {
                    let _ = tx.send(Err(msg));
                }
            };

            let core = match webview.controller().CoreWebView2() {
                Ok(c) => c,
                Err(e) => return send_err(format!("no CoreWebView2: {}", e)),
            };
            let core7 = match core.cast::<ICoreWebView2_7>() {
                Ok(c) => c,
                Err(_) => {
                    return send_err("unsupported: WebView2 runtime too old for PrintToPdf".into())
                }
            };
            let settings = match webview
                .environment()
                .cast::<ICoreWebView2Environment6>()
                .and_then(|env6| env6.CreatePrintSettings())
            {
                Ok(s) => s,
                Err(e) => return send_err(format!("no print settings: {}", e)),
            };
            let _ = settings.SetShouldPrintBackgrounds(true);
            // 15mm ≈ 0.59 英寸
            let _ = settings.SetMarginTop(0.59);
            let _ = settings.SetMarginBottom(0.59);
            let _ = settings.SetMarginLeft(0.59);
            let _ = settings.SetMarginRight(0.59);

            let wide = HSTRING::from(path.as_str());
            let shared_in_handler = shared_in_closure.clone();
            let handler = PrintToPdfCompletedHandler::create(Box::new(move |result, success| {
                if let Some(tx) = shared_in_handler.lock().unwrap().take() {
                    let _ = tx.send(match (result, success) {
                        (Ok(()), true) => Ok(()),
                        (Ok(()), false) => Err("PrintToPdf reported failure".to_string()),
                        (Err(e), _) => Err(format!("PrintToPdf error: {}", e)),
                    });
                }
                Ok(())
            }));
            if let Err(e) = core7.PrintToPdf(PCWSTR(wide.as_ptr()), &settings, &handler) {
                send_err(format!("PrintToPdf invoke failed: {}", e));
            }
        });

        if let Err(e) = launched {
            log::error!("[export_pdf_file] with_webview failed: {}", e);
            return failure(format!("failed to access webview: {}", e));
        }

        match tokio::time::timeout(PRINT_TIMEOUT, rx).await {
            Ok(Ok(Ok(()))) => {
                log::info!("[export_pdf_file] ✓ PDF written: {}", output_path);
                ExportPdfResult {
                    success: true,
                    error: None,
                }
            }
            Ok(Ok(Err(e))) => {
                log::error!("[export_pdf_file] PrintToPdf failed: {}", e);
                failure(e)
            }
            Ok(Err(_)) => failure("print callback dropped"),
            Err(_) => {
                log::error!("[export_pdf_file] PrintToPdf timed out");
                failure("print timed out")
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Linux：webkit2gtk 2.0 绑定没有 print_to_pdf，不支持
// ---------------------------------------------------------------------------

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod platform {
    use super::*;

    pub const UNSUPPORTED_REASON: &str = "platform does not support direct PDF export";

    pub fn supported() -> bool {
        false
    }

    pub async fn print_to_pdf_file(
        _window: &WebviewWindow,
        _output_path: &str,
        _outline: Option<&[PdfOutlineItem]>,
    ) -> ExportPdfResult {
        unsupported(UNSUPPORTED_REASON)
    }
}
