#!/bin/bash
# 收集二进制的共享库依赖闭包到 $PREFIX/lib，并修正 RPATH。
# 用法: collect-deps.sh <binary> <dest-lib-dir>
# 排除规则: 玲珑 base (org.deepin.base) 自带的系统库不打包。
set -euo pipefail

BIN="$1"
DEST="$2"
mkdir -p "$DEST"

# base 里已有的库（glibc 家族、ld、libpthread 等）不收集
EXCLUDE_RE='^(ld-linux|libpthread|libdl|librt|libm\.|libm-|libc\.|libc-|libresolv|libnss_|libutil|libanl|libthread_db|libSegFault|libpcprofile|libmemusage|libBrokenLocale)'

declare -A SEEN
collect() {
    local target="$1"
    local deps
    deps=$(ldd "$target" 2>/dev/null | awk '/=> \// {print $3} /^\// {print $1}' || true)
    local d
    for d in $deps; do
        local base
        base=$(basename "$d")
        if [[ "$base" =~ $EXCLUDE_RE ]] || [[ -n "${SEEN[$base]:-}" ]]; then
            continue
        fi
        SEEN[$base]=1
        cp -aL "$d" "$DEST/"
        collect "$d"
    done
}

collect "$BIN"

# WebKitGTK 多进程辅助程序：随包携带并保持可被查找
# 搜索路径含 /opt/deps（构建依赖解包前缀，rootfs 只读约束下的安装位置）
for helper in WebKitWebProcess WebKitNetworkProcess WebKitStorageProcess; do
    found=$(find /opt/deps/usr/lib /opt/deps/usr/libexec /usr/lib /usr/libexec -name "$helper*" 2>/dev/null | head -1 || true)
    if [ -n "$found" ]; then
        cp -a "$found" "$DEST/" || true
        collect "$found"
    fi
done

patchelf --set-rpath '$ORIGIN/../lib' "$BIN"
for f in "$DEST"/WebKit*Process; do
    [ -e "$f" ] && patchelf --set-rpath '$ORIGIN' "$f" || true
done

# dlopen 加载的运行时组件（不在 ldd 闭包内，缺失会导致运行时功能异常）：
# gdk-pixbuf 图片加载器 + gio 网络扩展（TLS/代理）
for moddir in \
    /opt/deps/usr/lib/aarch64-linux-gnu/gdk-pixbuf-2.0 \
    /opt/deps/usr/lib/aarch64-linux-gnu/gio/modules \
    /usr/lib/aarch64-linux-gnu/gdk-pixbuf-2.0 \
    /usr/lib/aarch64-linux-gnu/gio/modules; do
    if [ -d "$moddir" ]; then
        rel=${moddir#/opt/deps/usr/lib/aarch64-linux-gnu/}
        rel=${rel#/usr/lib/aarch64-linux-gnu/}
        mkdir -p "$DEST/$rel"
        cp -a "$moddir/." "$DEST/$rel/" 2>/dev/null || true
    fi
done

# 二进制补丁：libwebkit2gtk 内嵌编译期 libexecdir（/usr/lib/aarch64-linux-gnu/webkit2gtk-4.1），
# 老版本不支持 WEBKIT_EXEC_PATH 环境变量，必须等长改写为包内路径（不足处补 NUL）。
# 注意 ELF 位置敏感，绝对不能用改变文件长度的 sed 替换。
APP_LIB_PATH="/opt/apps/com.vividmark.app/files/lib"
WKLIB=$(ls "$DEST"/libwebkit2gtk-4.1.so.0* 2>/dev/null | head -1)
if [ -n "$WKLIB" ]; then
    ORIG='/usr/lib/aarch64-linux-gnu/webkit2gtk-4.1'
    python3 - "$WKLIB" "$ORIG" "$APP_LIB_PATH" <<'PYEOF' 2>/dev/null || perl -pi -e '
        $orig = "/usr/lib/aarch64-linux-gnu/webkit2gtk-4.1";
        $new  = "/opt/apps/com.vividmark.app/files/lib";
        $pad  = length($orig) - length($new);
        die "new path longer" if $pad < 0;
        s/\Q$orig\E(\x00)/$new . ("\x00" x ($pad + 1)) /ge;
    ' "$WKLIB"
import sys
path, orig, new = sys.argv[1], sys.argv[2].encode(), sys.argv[3].encode()
data = open(path, 'rb').read()
pad = len(orig) - len(new)
assert pad >= 0, "new path longer than original"
n = data.count(orig + b'\x00')
data = data.replace(orig + b'\x00', new + b'\x00' * (pad + 1))
open(path, 'wb').write(data)
print(f"patched {n} occurrence(s) of webkit libexecdir in {path}")
PYEOF
fi

echo "collected $(ls "$DEST" | wc -l) files into $DEST"
