import { useTranslation } from 'react-i18next'
import { openFolderDialog } from '../lib/openFolderDialog'
import { Button } from './ui'

/** Sidebar 最近文件视图与 FileTree 空态共用的次要操作按钮。 */
export function OpenFolderButton() {
  const { t } = useTranslation()

  return (
    <Button
      variant="secondary"
      onClick={() => void openFolderDialog()}
      className="w-full text-secondary hover:text-foreground"
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
    </Button>
  )
}
