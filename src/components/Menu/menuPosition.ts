/** 计算右键菜单面板位置：视口右/下边界溢出时向反方向翻转，并保证坐标不为负 */
export function resolveContextMenuPosition(
  x: number,
  y: number,
  menuWidth: number,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number
): { left: number; top: number } {
  let left = x
  let top = y
  if (left + menuWidth > viewportWidth) {
    left = Math.max(0, x - menuWidth)
  }
  if (top + menuHeight > viewportHeight) {
    top = Math.max(0, y - menuHeight)
  }
  return { left, top }
}
