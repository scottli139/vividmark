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

## CI 构建（GitHub Actions）

`release.yml` 的 `build-linglong` job（`ubuntu-24.04-arm` runner，public 仓库免费）随 `v*` tag 或手动触发运行：

- 工具链装自官方 release 源 `ci.deepin.com/repo/obs/linglong:/CI:/release/Ubuntu_24.04/`（ll-builder 1.13.x，有 arm64 包）；注意官方 `linglong-builder-action` 内嵌的 `ppa.linyaps.org.cn` 源已失效，故不用该 action
- Ubuntu 24.04 需 `sysctl -w kernel.apparmor_restrict_unprivileged_userns=0` 放开 ll-box 的非特权 user namespace
- 包版本自动从 tag 同步（`v0.8.0` → `0.8.0.0`，sed 改写 `linglong.yaml`，仓库内不随 tag 手改）
- `~/.cache/linglong-builder`（base 镜像）走 actions/cache，二次构建显著提速
- 产物同时出两种格式：`.layer`（老设备如玲珑 1.5.6 用 `ll-cli install`）+ `.uab`（离线包，新系统双击安装/免安装运行/市场上架；**本机 1.5.6 无法验证 uab，兼容性未实测**）。tag 触发时两者直挂 Release draft；`workflow_dispatch` 手动触发只传 artifact（供验证构建）
- **base 版本必须写三位**（`org.deepin.base/23.1.0`）：ll-builder 1.13+ 拒绝四位版本（`base version is not valid`，纯本地格式校验），1.5.6 对三位做模糊匹配可解析到本地缓存的 23.1.0.2，两头兼容

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
11. **desktop 的 Exec 不能带 `%F` 等占位符**：ll-cli 1.5.6 安装期重写 desktop 文件时，若原 Exec 含 `%F`，会改写成 `ll-cli run <id> --file %F -- -- <bin> %%F`——无文件双击（开始菜单/桌面快捷方式）时 `%F` 展开为空，`--file` 缺参数直接报用法错误（rc=255）；有文件时内层多出的 `--` 又被当成命令执行（`--: command not found`），两条路径全废，app 完全无法从桌面环境启动。且该版本的 `--file` 并不会把文件路径代入命令行（实测内层 `%F` 不被替换、argv 无追加），app 的 Linux argv 打开也未实现——故 Exec 只写裸路径。不带占位符时重写结果为 `ll-cli run <id> -- <bin>`（探针包实测，双击/菜单均正常启动）。图标/desktop 装入 `$PREFIX/share/applications|icons`，`entries/` 导出由玲珑自动处理。
12. **文字「顶部对齐」（垂直居中全失效）**：内置的 beige webkit2gtk-4.1 实为 **2.46.3**，它对非字面安装的 font-family 名（`-apple-system`、`sans-serif` 等别名/通用名，fontconfig 模糊匹配到同一字体文件也照样中招）返回零度量字体——布局居中正确但墨迹从坍缩基线向上绘制，视觉上文字顶偏。修复：前端所有 font-family 栈在通用名之前补 Linux 实体字体名（正文 `'Noto Sans CJK SC'/'Source Han Sans SC'/…`，等宽 `'Noto Sans Mono CJK SC'/'DejaVu Sans Mono'/…`），WebKit 跳过非字面名命中实体名即正常。详见 `docs/implementation-notes.md`「已知问题」。
13. **ll-cli 1.5.6 安装新版不刷新 entries 导出**：`ll-cli install` 新版本后，`/var/lib/linglong/entries/` 下的 desktop/图标符号链接仍钉在**首次安装的那个版本**的 commit 目录上——desktop 内容变了也不会更新，菜单/桌面一直跑旧 Exec。换包验证前必须全量卸载：`ll-cli uninstall <id>` 和 `--all` 都只卸最新版，要逐版本 `ll-cli uninstall <id>/<version>`；最后一个版本卸掉后 entries 导出才会清除，再装新版即重建。
14. **桌面/开始菜单图标齿轮 + 无法启动的两个独立成因**（UOS 20 实测）：(a) 无法启动 = 踩坑 11 的 Exec 重写 bug；(b) 图标齿轮 = **dde-desktop 的进程级图标缓存过期**——Qt/PyQt5 与 GTK 对新装玲珑应用的图标都能正常解析（`/var/lib/linglong/entries/share/icons` 已在 XDG_DATA_DIRS），但 dde-desktop 进程启动早于图标出现就显示回退齿轮。`killall dde-desktop`（会被自动拉起）或重新登录后图标恢复。玲珑导出的 desktop 文件是符号链接，「发送到桌面」副本会丢执行位（644），补上 `chmod +x` 与系统自带快捷方式一致。

## 已知限制

- 包体积大（约 133MB layer，webkit 全家桶内置）；上游正在做内置 GTK/WebKit 的玲珑 Runtime（[linyaps#1374](https://github.com/OpenAtom-Linyaps/linyaps/issues/1374)），成熟后可大幅瘦身。
- 纯软件渲染 + X11(XWayland) 后端（稳定性优先的有意取舍，见踩坑 8），重度滚动性能一般。
- `injected bundle` 警告无害（wry 不使用 web extension）。
- ll-cli 1.5.6 在 UOS 20 上**起第二个实例会失败**（`ll-box exec` 走 `nsenter --wdns`，老 util-linux 不认识该选项）：换新包测试前先关掉旧实例。
- **双击 .md 文件关联打开不会携带文件路径**（只拉起空窗口）：desktop 的 Exec 不能带 `%F`（踩坑 11），且 1.5.6 的 `--file` 不会把路径代入容器内命令行；Linux argv 打开本身也未实现（见 AGENTS.md 文件关联一节）。MimeType 关联保留，仅作「打开方式」入口。

## 不要升级设备上的玲珑工具链（UOS 20 / kernel 5.4 实测结论）

官方 `uos_1070` 源（release = ll-cli 1.11.0 + ll-box 2.2.1；latest = ll-cli 1.12.1 + ll-box 1.8.1）在本机均**确定性破坏无 tty 启动**（桌面菜单双击场景），终端启动正常。根因有两个，都只在老内核/老系统组合上触发：

1. 新版 ll-box 的 `close_range` fallback（内核 <5.9 无 `close_range` 系统调用）遍历 `/proc/self/fd` 时对并发消失的 fd 直接抛 EBADF 中止容器启动（`clone failed: failed to set up close-on-exec to 6: Bad file descriptor`）；无 tty 时 ll-cli 走管道转发 IO，fd 布局恰好踩中。
2. ll-cli ≤1.12 给 ldconfig 缓存生成容器无条件 `terminal=true`，无控制终端时 ll-box 打开 `/dev/tty` 抛 ENXIO（`failed to generate ld cache`）。上游 master 已改为 `isatty(stdin)` 条件设置，但该修复未进入任何 uos_1070 源版本。

回退方法（升级到新版后想回 1.5.6）：删 `/etc/apt/sources.list.d/linglong.list` 后 `apt install --allow-downgrades linglong-bin=1.5.6.1-1 linglong-box=1.5.6.1-1 linglong-builder=1.5.6.1-1 fuse`，再手工恢复数据目录——新版会把 `/var/lib/linglong/config.yaml` 改写成 v2 schema（`repos` 为列表），1.5.6 的 `ll-package-manager` 解析失败 CrashLoop（`tl::expected ... has_value() 失败`），改回 v1 格式即可：

```yaml
defaultRepo: stable
repos:
  stable: https://mirror-repo-linglong.deepin.com
version: 1
```

升级时迁移的 layers（hash 目录布局）与 ostree 内容向后兼容，回退后已装应用无需重装；重打踩坑 10 的 `ld.so.cache~` 补丁后即可正常运行。`.uab` 双击安装（linglong-installer）因此暂时与本机无缘，等上游修复进入 uos_1070 源后再评估。
