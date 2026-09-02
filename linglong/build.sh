#!/bin/bash
# VividMark 玲珑构建脚本：在 ll-builder 容器（Deepin 23 base，rootfs 只读）内执行。
# 只读 rootfs 约束下，系统依赖用 apt 重定向状态目录下载后 dpkg-deb -x 解到 /opt/deps，
# 编译时经 PKG_CONFIG_SYSROOT_DIR 指向该前缀；运行库随包收集进 $PREFIX/lib（RPATH）。
set -euo pipefail

DEPS=/opt/deps
APT_STATE=/tmp/apt
APPID=com.vividmark.app

# ---------- 1. apt 重定向 + 更换有效源 ----------
mkdir -p $APT_STATE/lists/partial $APT_STATE/cache/archives/partial $APT_STATE/state
# status 必须为空文件（且 /tmp 跨构建持久，touch 不会清空旧内容，必须截断）：
# 若沿用 base 的 dpkg status，已装的运行时库会被跳过下载，
# 导致 /opt/deps 里 dev 包的 .so 符号链接悬空（ld 找不到 -lpango 等）
: > $APT_STATE/state/status
echo "deb [trusted=yes] https://community-packages.deepin.com/deepin/beige beige main community commercial" > $APT_STATE/sources.list
APT="apt-get
  -o Dir::State::Lists=$APT_STATE/lists
  -o Dir::State::status=$APT_STATE/state/status
  -o Dir::Cache=$APT_STATE/cache
  -o Dir::Etc::SourceList=$APT_STATE/sources.list
  -o Dir::Etc::SourceParts=-
  -o Debug::NoLocking=1
  -o APT::Get::List-Cleanup=0"
$APT update -qq

# ---------- 2. 下载并解包构建/运行依赖 ----------
$APT install -y --download-only \
    build-essential pkg-config \
    libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev libgtk-3-dev \
    libglib2.0-dev libsoup-3.0-dev libssl-dev \
    libayatana-appindicator3-dev librsvg2-dev libxdo-dev
mkdir -p $DEPS
for deb in $APT_STATE/cache/archives/*.deb; do
    dpkg-deb -x "$deb" $DEPS
done

LIBDIR=$DEPS/usr/lib/aarch64-linux-gnu
export PATH=$DEPS/usr/bin:$PATH
export PKG_CONFIG_PATH=$LIBDIR/pkgconfig:$DEPS/usr/share/pkgconfig
export PKG_CONFIG_SYSROOT_DIR=$DEPS
export LD_LIBRARY_PATH=$LIBDIR

# ---------- 3. Node.js ----------
if [ ! -x /opt/node/bin/node ]; then
    mkdir -p /opt/node
    curl -fsSL https://nodejs.org/dist/v24.20.0/node-v24.20.0-linux-arm64.tar.xz \
        | tar -xJ --strip-components=1 -C /opt/node
fi
export PATH=/opt/node/bin:$PATH

# ---------- 4. Rust ----------
export RUSTUP_HOME=/opt/rustup CARGO_HOME=/opt/cargo
if [ ! -x /opt/cargo/bin/cargo ]; then
    curl -fsSL https://rsproxy.cn/rustup/dist/aarch64-unknown-linux-gnu/rustup-init -o /tmp/rustup-init
    chmod +x /tmp/rustup-init
    RUSTUP_DIST_SERVER=https://rsproxy.cn RUSTUP_UPDATE_ROOT=https://rsproxy.cn/rustup \
        /tmp/rustup-init -y --no-modify-path --default-toolchain stable --profile minimal
fi
export PATH=/opt/cargo/bin:$PATH
printf '[source.crates-io]\nreplace-with = "rsproxy-sparse"\n[source.rsproxy-sparse]\nregistry = "sparse+https://rsproxy.cn/index/"\n[net]\ngit-fetch-with-cli = true\n' > $CARGO_HOME/config.toml

# ---------- 5. 前端 + Rust 构建 ----------
cd /project
export CI=true  # 无 TTY，允许 pnpm 直接重建 node_modules
# npm 全局安装默认读 PREFIX 环境变量，会污染玲珑包目录，显式指定独立前缀
npm install -g --prefix /opt/npm-global pnpm --registry=https://registry.npmmirror.com --force
export PATH=/opt/npm-global/bin:$PATH
pnpm config set registry https://registry.npmmirror.com
pnpm install --fetch-retries=5 --fetch-timeout=300000
pnpm build
cd src-tauri
# 必须显式开 custom-protocol feature：tauri-build 以 custom-protocol 判定 dev/prod，
# 裸 cargo build 不带它会变成 dev 模式，运行时去连 devUrl（localhost:5173）导致白屏报错
cargo build --release --features tauri/custom-protocol
cd /project

# ---------- 6. 安装产物 ----------
# 清理可能由上次构建残留的内容（如 npm -g 误用 PREFIX 留下的 pnpm 文件）
rm -rf "$PREFIX/bin" "$PREFIX/lib" "$PREFIX/share"
# Cargo.toml 包名为 app，二进制即 target/release/app
install -D src-tauri/target/release/app "$PREFIX/bin/vividmark.bin"
chmod +x linglong/collect-deps.sh
bash linglong/collect-deps.sh "$PREFIX/bin/vividmark.bin" "$PREFIX/lib"

# 包装启动器：
# - LD_LIBRARY_PATH 指向私有库目录。仅靠主二进制的 DT_RUNPATH 不够——RUNPATH 不递归，
#   内置库自身的 NEEDED 会经 ld.so.cache 解析到 base 里的旧版库（实测 gstreamer 1.24 vs 1.22
#   混装导致 undefined symbol: gst_video_is_dma_drm_caps）。
# - WEBKIT_EXEC_PATH 指向随包的 WebKit 多进程辅助程序（WebKitWebProcess 等），
#   否则 webkit2gtk 按编译期 libexecdir 到 base 里找（那里没有 webkit）。
cat > "$PREFIX/bin/vividmark" <<'EOF'
#!/bin/bash
HERE=$(dirname "$(readlink -f "$0")")
export LD_LIBRARY_PATH="$HERE/../lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export WEBKIT_EXEC_PATH="$HERE/../lib"
export GIO_EXTRA_MODULES="$HERE/../lib/gio/modules"
# WebKit 的 bubblewrap 沙箱无法在玲珑容器（自身已是命名空间沙箱）内嵌套运行
export WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1
# 容器内无 GPU 驱动，禁用合成加速走纯软件渲染，避免窗口 resize 时 EGL 断言 SIGABRT
export WEBKIT_DISABLE_COMPOSITING_MODE=1
# wayland 下 WebKitGTK 2.38 系在 resize 时仍会 SIGABRT，强制走 X11（XWayland）后端
export GDK_BACKEND=x11
exec "$HERE/vividmark.bin" "$@"
EOF
chmod +x "$PREFIX/bin/vividmark"

mkdir -p "$PREFIX/share/applications" "$PREFIX/share/icons/hicolor/128x128/apps"
cp src-tauri/icons/128x128.png "$PREFIX/share/icons/hicolor/128x128/apps/$APPID.png"
cat > "$PREFIX/share/applications/$APPID.desktop" <<EOF
[Desktop Entry]
Name=VividMark
Comment=Lightweight Markdown editor
Exec=/opt/apps/$APPID/files/bin/vividmark %F
Icon=$APPID
Type=Application
Categories=Utility;TextEditor;
MimeType=text/markdown;
EOF

echo "=== build done ==="
du -sh "$PREFIX/bin" "$PREFIX/lib"
