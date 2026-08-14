//! 窗口标题设置命令（macOS 侧附红绿灯重排）。
//!
//! 背景：tauri.conf.json / window_router 的 trafficLightPosition 只在窗口创建时生效；
//! AppKit 在 setTitle 后会把红绿灯重置回默认位置（实测 macOS 26 上上移约 7pt，肉眼可见
//! 跳变），而 tauri 2.10 / tao 0.34 没有运行时重排 API。这里在 Rust 侧设标题并立即用
//! objc2 显式重排按钮，保证始终垂直居中于 48px 工具栏。

use tauri::WebviewWindow;

/// 与 tauri.conf.json / window_router 的 trafficLightPosition 对齐
#[cfg(target_os = "macos")]
const TRAFFIC_LIGHT_X: f64 = 12.0;
/// 按钮顶距（窗口顶到按钮顶）：48px 工具栏内居中 16pt 按钮 = 16pt
#[cfg(target_os = "macos")]
const TRAFFIC_LIGHT_TOP: f64 = 16.0;
/// 标题栏容器高度 = 按钮高 + 该值（沿用 tao inset_traffic_lights 的约定，保证命中区域）
#[cfg(target_os = "macos")]
const TITLEBAR_INSET_Y: f64 = 25.5;

/// 显式重排三个标准按钮：x = 12 + i*间距，顶距 16pt。
/// 按钮 y 先换算到窗口坐标再求差值，避免直接依赖父视图坐标系的假设。
#[cfg(target_os = "macos")]
unsafe fn layout_traffic_lights(ns_window: &objc2_app_kit::NSWindow) {
    use objc2_app_kit::NSWindowButton;

    let (Some(close), Some(miniaturize), Some(zoom)) = (
        ns_window.standardWindowButton(NSWindowButton::CloseButton),
        ns_window.standardWindowButton(NSWindowButton::MiniaturizeButton),
        ns_window.standardWindowButton(NSWindowButton::ZoomButton),
    ) else {
        return;
    };

    // 容器高度沿用 tao 约定（按钮高 + inset），置顶，保证按钮下移后仍在命中区域内
    if let Some(container) = close.superview().and_then(|v| v.superview()) {
        let mut rect = container.frame();
        rect.size.height = close.frame().size.height + TITLEBAR_INSET_Y;
        rect.origin.y = ns_window.frame().size.height - rect.size.height;
        container.setFrame(rect);
    }

    let spacing = miniaturize.frame().origin.x - close.frame().origin.x;
    let win_height = ns_window.frame().size.height;
    for (i, button) in [close, miniaturize, zoom].into_iter().enumerate() {
        // 按钮在窗口坐标中的当前位置（convertRect:toView:nil → 窗口坐标系）
        let in_window = button.convertRect_toView(button.bounds(), None);
        let target_origin_y = win_height - TRAFFIC_LIGHT_TOP - in_window.size.height;
        let delta_y = target_origin_y - in_window.origin.y;
        let mut origin = button.frame().origin;
        origin.x = TRAFFIC_LIGHT_X + i as f64 * spacing;
        origin.y += delta_y;
        button.setFrameOrigin(origin);
    }
}

/// 设置窗口标题；macOS 上设完立即重排红绿灯（setTitle 会触发 AppKit 重置按钮位置）。
/// with_webview 的闭包在主线程执行，标题与重排同一次完成，无时序竞争。
#[tauri::command]
pub fn set_window_title(window: WebviewWindow, title: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        window
            .with_webview(move |webview| unsafe {
                let ns_window: &objc2_app_kit::NSWindow =
                    &*(webview.ns_window() as *const objc2_app_kit::NSWindow);
                ns_window.setTitle(&objc2_foundation::NSString::from_str(&title));
                layout_traffic_lights(ns_window);
            })
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        window.set_title(&title).map_err(|e| e.to_string())
    }
}
