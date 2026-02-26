import { useTranslation } from 'react-i18next'
import { useEditorStore, type RecentFile } from '../../stores/editorStore'
import { openFileByPath } from '../../lib/fileOps'

export function Sidebar() {
  const { t } = useTranslation()
  const { showSidebar, content, recentFiles, isDirty, fileName, clearRecentFiles } =
    useEditorStore()

  if (!showSidebar) return null

  // 简单的大纲提取
  const headings = content
    .split('\n')
    .filter((line) => line.startsWith('#'))
    .map((line) => {
      const level = line.match(/^#+/)?.[0].length || 1
      const text = line.replace(/^#+\s*/, '')
      return { level, text }
    })

  const handleRecentFileClick = async (file: RecentFile) => {
    if (isDirty) {
      if (!confirm(t('dialog.confirmDiscard'))) {
        return
      }
    }
    await openFileByPath(file.path)
  }

  // 统计字数（支持中英文）
  const wordCount = content
    .replace(/\s/g, '')
    .split('')
    .filter((c) => /\w|\p{Unified_Ideograph}/u.test(c)).length

  return (
    <div className="w-56 border-r border-[var(--editor-border)] bg-[var(--sidebar-bg)] flex flex-col">
      {/* 当前文件 */}
      <div className="p-3 border-b border-[var(--editor-border)]">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {t('sidebar.currentFile')}
        </h3>
        <div className="text-sm truncate flex items-center gap-1">
          <span className="truncate">{fileName}</span>
          {isDirty && <span className="text-[var(--accent-color)]">*</span>}
        </div>
      </div>

      {/* 最近文件 */}
      <div className="p-3 border-b border-[var(--editor-border)]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {t('sidebar.recentFiles')}
          </h3>
          {recentFiles.length > 0 && (
            <button
              onClick={clearRecentFiles}
              className="text-xs text-gray-400 hover:text-gray-600"
              title={t('sidebar.clearTooltip')}
            >
              {t('sidebar.clear')}
            </button>
          )}
        </div>
        {recentFiles.length === 0 ? (
          <div className="text-sm text-gray-400 italic">{t('sidebar.noRecentFiles')}</div>
        ) : (
          <ul className="space-y-1">
            {recentFiles.slice(0, 5).map((file) => (
              <li
                key={file.path}
                onClick={() => handleRecentFileClick(file)}
                className="text-sm text-gray-600 dark:text-gray-300 hover:text-[var(--accent-color)] cursor-pointer truncate flex items-center gap-1"
                title={file.path}
              >
                <svg
                  className="w-3 h-3 flex-shrink-0 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="truncate">{file.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 大纲区域 */}
      <div className="p-3 flex-1 overflow-auto">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {t('sidebar.outline')}
        </h3>
        {headings.length === 0 ? (
          <div className="text-sm text-gray-400 italic">{t('sidebar.noHeadings')}</div>
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
        <div>
          {t('sidebar.chars')} {wordCount}
        </div>
        <div>
          {t('sidebar.words')} {content.length}
        </div>
      </div>
    </div>
  )
}
