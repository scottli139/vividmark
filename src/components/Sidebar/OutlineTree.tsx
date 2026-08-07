import { useTranslation } from 'react-i18next'
import type { OutlineItem, OutlineNode } from '../../lib/outlineUtils'

interface OutlineTreeProps {
  nodes: OutlineNode[]
  /** 已折叠节点的 OutlineItem.index 集合 */
  collapsedSet: ReadonlySet<number>
  /** 当前高亮项的 OutlineItem.index（无高亮为 null） */
  activeIndex: number | null
  onToggle: (index: number) => void
  onHeadingClick: (heading: OutlineItem) => void
  /** 挂到当前高亮行上，供 Sidebar 做 scrollIntoView */
  activeItemRef: React.RefObject<HTMLDivElement | null>
}

/**
 * 大纲层级树：有子级的项显示 chevron 折叠/展开子级（默认全展开），
 * 点击文本照常派发跳转事件；activeIndex 命中的行高亮（active 背景 + accent 左边条）。
 */
export function OutlineTree(props: OutlineTreeProps) {
  return (
    <ul className="space-y-0.5">
      {props.nodes.map((node) => (
        <OutlineTreeNode key={node.index} node={node} {...props} />
      ))}
    </ul>
  )
}

function OutlineTreeNode({
  node,
  collapsedSet,
  activeIndex,
  onToggle,
  onHeadingClick,
  activeItemRef,
}: Omit<OutlineTreeProps, 'nodes'> & { node: OutlineNode }) {
  const { t } = useTranslation()
  const hasChildren = node.children.length > 0
  const isCollapsed = collapsedSet.has(node.index)
  const isActive = node.index === activeIndex

  return (
    <li>
      <div
        ref={isActive ? activeItemRef : undefined}
        onClick={() => onHeadingClick(node)}
        className={`
          flex items-center rounded-md border-l-2 text-sm transition-colors duration-150
          py-0.5 pr-1 cursor-pointer
          ${
            isActive
              ? 'bg-[var(--active-bg)] border-[var(--accent-color)]'
              : 'border-transparent text-[var(--color-text)] hover:bg-[var(--hover-bg)]'
          }
        `}
        style={{ paddingLeft: `${(node.level - 1) * 12}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggle(node.index)
            }}
            aria-label={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            title={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            className="w-4 h-4 flex-shrink-0 flex items-center justify-center
              text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <svg
              className={`w-3 h-3 transition-transform duration-150 ${isCollapsed ? '' : 'rotate-90'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          // 无子级的项保留同样宽度，文本与有子级的兄弟项对齐
          <span className="w-4 h-4 flex-shrink-0" />
        )}
        <span className="flex-1 min-w-0 truncate cursor-pointer" title={node.text}>
          {node.text}
        </span>
      </div>
      {hasChildren && !isCollapsed && (
        <ul className="space-y-0.5 mt-0.5">
          {node.children.map((child) => (
            <OutlineTreeNode
              key={child.index}
              node={child}
              collapsedSet={collapsedSet}
              activeIndex={activeIndex}
              onToggle={onToggle}
              onHeadingClick={onHeadingClick}
              activeItemRef={activeItemRef}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
