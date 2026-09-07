import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../../stores/editorStore'
import { buildMenuBarMenus } from '../../lib/menuBar'
import { handleMenuAction } from '../../lib/nativeMenu'
import { createLogger } from '../../lib/logger'
import { MenuPanel } from './MenuPanel'

const logger = createLogger('MenuBar')

/**
 * 自绘菜单栏（VS Code 风格，内嵌 Toolbar 行）：Windows 桌面端（无原生菜单）
 * 与浏览器 dev/E2E 使用；macOS/Linux 桌面端保留原生菜单不渲染本组件。
 *
 * 交互：点击开合；打开后 hover 平移切换相邻菜单；Escape / 外部点击关闭。
 * 菜单项构建是纯函数（lib/menuBar.ts），checked/disabled 响应式取自 store；
 * 点击统一经 nativeMenu.ts handleMenuAction 分发（与原生菜单同源 id）。
 */
export function MenuBar() {
  const { t } = useTranslation()
  const barRef = useRef<HTMLDivElement>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  // 只订阅构建所需字段，避免 content 每次击键都重渲染菜单栏
  const viewMode = useEditorStore((s) => s.viewMode)
  const themeMode = useEditorStore((s) => s.themeMode)
  const sidebarTab = useEditorStore((s) => s.sidebarTab)
  const canUndo = useEditorStore((s) => s.canUndo)
  const canRedo = useEditorStore((s) => s.canRedo)
  const filePath = useEditorStore((s) => s.filePath)
  const openedFolder = useEditorStore((s) => s.openedFolder)
  const recentFiles = useEditorStore((s) => s.recentFiles)

  const menus = buildMenuBarMenus(t, {
    viewMode,
    themeMode,
    sidebarTab,
    canUndo,
    canRedo,
    filePath,
    openedFolder,
    recentFiles,
  })

  const close = useCallback(() => setOpenId(null), [])

  // 打开期间：外部点击 / Escape 关闭
  useEffect(() => {
    if (openId === null) return
    const handleMouseDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) close()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openId, close])

  const handleSelect = useCallback(
    (id: string) => {
      close()
      void handleMenuAction(id).catch((e) => logger.error(`Menu action failed: ${id}`, e))
    },
    [close]
  )

  return (
    <div ref={barRef} role="menubar" className="flex items-center" data-testid="menu-bar">
      {menus.map((menu) => (
        <div key={menu.id} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={openId === menu.id}
            onClick={() => setOpenId(openId === menu.id ? null : menu.id)}
            // 经典 menubar 行为：任一菜单打开后，hover 平移即切换
            onMouseEnter={() => {
              if (openId !== null && openId !== menu.id) setOpenId(menu.id)
            }}
            className={`px-2.5 py-1 text-sm rounded-md transition-colors text-[var(--color-text-secondary)] hover:bg-[var(--hover-bg)] ${
              openId === menu.id ? 'bg-[var(--hover-bg)] text-[var(--color-text)]' : ''
            }`}
          >
            {menu.label}
          </button>
          {openId === menu.id && (
            // 面板左缘与菜单项左缘对齐（原生菜单弹窗位置不可控的替代）
            <MenuPanel
              items={menu.items}
              onSelect={handleSelect}
              className="absolute left-0 top-full mt-0.5 min-w-56"
            />
          )}
        </div>
      ))}
    </div>
  )
}
