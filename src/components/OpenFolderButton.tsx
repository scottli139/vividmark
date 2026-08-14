import { useTranslation } from 'react-i18next'
import { openFolderDialog } from '../lib/openFolderDialog'

/**
 * 「打开文件夹」入口按钮（幽灵样式）：中性边框 + 弱化文字，避免实心 accent 按钮在
 * 侧边栏中过于突兀。Sidebar 最近文件视图与 FileTree 空态共用，保证两处观感一致。
 */
export function OpenFolderButton() {
  const { t } = useTranslation()

  return (
    <button
      onClick={() => void openFolderDialog()}
      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5
        text-[13px] text-[var(--color-text-secondary)]
        border border-[var(--editor-border)] rounded-md
        hover:bg-[var(--hover-bg)] hover:text-[var(--color-text)]
        transition-colors duration-150"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        />
      </svg>
      {t('fileTree.openFolder')}
    </button>
  )
}
