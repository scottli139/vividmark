# VividMark 玲珑（Linglong）打包

在 UOS 20 / deepin 等老系统上构建并运行 VividMark 桌面版的方案。原理：玲珑构建容器自带新版用户空间（Deepin 23 base，glib 2.80），编译不受宿主系统限制；webkit2gtk-4.1 等运行库随包内置，运行时与宿主系统库完全解耦。

## 产物

- `com.vividmark.app_<ver>_arm64_binary.layer`（约 133MB：18MB 二进制 + 210MB 内置库压缩后）

## 构建

```bash
sudo apt-get install linglong-builder   # ll-builder + ll-cli
ll-builder build          # 容器内完成全部编译（首次约 15-25 分钟）
ll-builder export -l      # 导出 .layer（uab 导出需要新版 uab-header，1.5.x 没有）
ll-cli install ./com.vividmark.app_*_binary.layer
ll-cli run com.vividmark.app
```

构建流水线：`linglong.yaml`（入口）→ `linglong/build.sh`（容器内全部逻辑）→ `linglong/collect-deps.sh`（依赖收集）。

## 关键实现点（踩坑记录）

1. **构建容器 rootfs 只读**（/usr、/var 不可写，/opt 可写）：系统依赖不能 `apt install`，改为 apt 状态目录重定向（`Dir::State::Lists/status`、`Dir::Cache` 指向 /tmp）+ `--download-only` 下载 + `dpkg-deb -x` 解到 `/opt/deps`，编译用 `PKG_CONFIG_PATH` + `PKG_CONFIG_SYSROOT_DIR=$DEPS` 指向解包前缀。
2. **apt status 必须截断为空**（`: > status`，不能用 `touch`）：ll-builder 的 /tmp 跨构建持久，若沿用 base 的 dpkg status，已装的运行时库（libpango 等）会被跳过下载，导致 dev 包的 `.so` 符号链接悬空（`ld: cannot find -lpangocairo-1.0`）。
3. **base 的 ci.deepin.com 源已失效**：替换为 `https://community-packages.deepin.com/deepin/beige beige main community commercial`。
4. **npm -g 会读 PREFIX 环境变量**：ll-builder 的 `$PREFIX` 会被 npm 当成全局安装前缀，pnpm 会装进包里——必须显式 `npm install -g --prefix /opt/npm-global`。
5. **pnpm 10 的构建脚本白名单在 `pnpm-workspace.yaml`**（`allowBuilds`），package.json 的 `pnpm` 字段已废弃。
6. **私有库加载必须靠 wrapper 脚本设 `LD_LIBRARY_PATH`**：patchelf 设的 `DT_RUNPATH` 不递归，内置库的 NEEDED 会经 ld.so.cache 解析到 base 旧库（实测 gstreamer 1.24/1.22 混装崩 `gst_video_is_dma_drm_caps`）。wrapper 同时设 `WEBKIT_EXEC_PATH`、`GIO_EXTRA_MODULES`、`WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS`（WebKit bubblewrap 沙箱无法在玲珑容器内嵌套）。
7. **裸 `cargo build` 出来的是 dev 模式（白屏 "Could not connect to localhost"）**：tauri-build 以 `custom-protocol` feature 判定 dev/prod，必须 `cargo build --release --features tauri/custom-protocol`（feature 在 tauri 包上，不在应用包上；这正是 `tauri build` CLI 的内部行为）。
8. **窗口 resize/maximize SIGABRT（wayland + 无 GPU）**：容器内没有宿主 GPU 驱动（hisi/Mali），WebKitGTK 在窗口尺寸变化时走 EGL/合成路径断言 abort。需要两个环境变量同时上：`WEBKIT_DISABLE_COMPOSITING_MODE=1`（纯软件渲染）+ `GDK_BACKEND=x11`（强制 X11/XWayland 后端；单独禁合成不够，wayland 下仍崩）。X11 后端顺带修复了任务栏图标不对的问题。
9. **libwebkit2gtk 硬编码 libexecdir 需二进制补丁**：deepin 23 的 webkit2gtk（AppleWebKit 605.1.15）不支持 `WEBKIT_EXEC_PATH`，`collect-deps.sh` 把内嵌字符串 `/usr/lib/aarch64-linux-gnu/webkit2gtk-4.1\0` 等长改写为 `/opt/apps/com.vividmark.app/files/lib\0...`（ELF 位置敏感，只能等长替换+NUL 填充；WebKitWebProcess 里另有一处 `/injected-bundle/` 路径未改，仅产生无害警告）。
10. **ll-cli 1.5.6 运行 base 23.1 的兼容补丁**（宿主机一次性操作）：ll-box 要求 rootfs 存在 `/etc/ld.so.cache~` 挂载点，而该 base 没有。需手动补占位文件：
    ```bash
    sudo touch "/var/lib/linglong/layers/main/org.deepin.base/23.1.0.2/arm64/binary/files/etc/ld.so.cache~"
    ```
11. **图标/desktop**：构建时装入 `$PREFIX/share/applications|icons`，玲珑的 `entries/` 导出由 ll-builder 自动处理。

## 已知限制

- 包体积大（约 133MB layer，webkit 全家桶内置）；上游正在做内置 GTK/WebKit 的玲珑 Runtime（[linyaps#1374](https://github.com/OpenAtom-Linyaps/linyaps/issues/1374)），成熟后可大幅瘦身。
- 纯软件渲染 + X11(XWayland) 后端（稳定性优先的有意取舍，见踩坑 8），重度滚动性能一般。
- `injected bundle` 警告无害（wry 不使用 web extension）。
