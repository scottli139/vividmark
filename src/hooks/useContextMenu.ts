import { useCallback, useState } from 'react'
import type { MouseEvent } from 'react'

export interface ContextMenuState<T> {
  x: number
  y: number
  /** 打开时刻捕获的上下文快照（选区状态、落点节点信息等） */
  data: T
}

/**
 * 右键菜单受控状态（编辑器三区域共用，与 FileTree 的模式一致）：
 * openMenu 绑定 onContextMenu（preventDefault + 记录视口坐标与上下文快照），
 * 父组件按 menu !== null 条件渲染 <ContextMenu>；closeMenu 需稳定引用（useCallback）。
 */
export function useContextMenu<T>() {
  const [menu, setMenu] = useState<ContextMenuState<T> | null>(null)

  const openMenu = useCallback((e: MouseEvent, data: T) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, data })
  }, [])

  const closeMenu = useCallback(() => setMenu(null), [])

  return { menu, openMenu, closeMenu }
}
