import { useEditorStore } from '../../stores/editorStore'

export function Sidebar() {
  const { showSidebar, content } = useEditorStore()

  if (!showSidebar) return null

  // 简单的大纲提取
  const headings = content
    .split('\n')
    .filter(line => line.startsWith('#'))
    .map(line => {
      const level = line.match(/^#+/)?.[0].length || 1
      const text = line.replace(/^#+\s*/, '')
      return { level, text }
    })

  return (
    <div className="w-56 border-r border-[var(--editor-border)] bg-[var(--sidebar-bg)] flex flex-col">
      {/* 文件列表区域 */}
      <div className="p-3 border-b border-[var(--editor-border)]">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Files
        </h3>
        <div className="text-sm text-gray-400 italic">
          No files open
        </div>
      </div>

      {/* 大纲区域 */}
      <div className="p-3 flex-1 overflow-auto">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Outline
        </h3>
        {headings.length === 0 ? (
          <div className="text-sm text-gray-400 italic">
            No headings
          </div>
        ) : (
          <ul className="space-y-1">
            {headings.map((heading, index) => (
              <li
                key={index}
                className="text-sm text-gray-600 dark:text-gray-300 hover:text-[var(--accent-color)] cursor-pointer truncate"
                style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
              >
                {heading.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 底部统计 */}
      <div className="p-3 border-t border-[var(--editor-border)] text-xs text-gray-500">
        <div>Words: {content.split(/\s+/).filter(Boolean).length}</div>
        <div>Chars: {content.length}</div>
      </div>
    </div>
  )
}
