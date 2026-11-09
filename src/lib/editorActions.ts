import { useEditorStore } from '../stores/editorStore'
import { selectLocalImage, createImageMarkdown } from './imageUtils'
import { openFolderDialog } from './openFolderDialog'

/**
 * 编辑器动作共享入口：工具栏按钮与原生菜单（nativeMenu.ts）复用同一套流程，
 * 避免两边各自实现导致行为漂移。
 */

/** 打开本地图片选择器，把 markdown 图片语法经 editor-insert 事件送入编辑器 */
export async function insertImageFromPicker(): Promise<void> {
  const { filePath } = useEditorStore.getState()
  const imagePath = await selectLocalImage()
  if (!imagePath) return

  const fileName = imagePath.split(/[/\\]/).pop() || 'image'
  const altText = fileName.replace(/\.[^/.]+$/, '')
  const markdown = await createImageMarkdown(altText, imagePath, filePath, {
    copyToAssets: true,
    useBase64: false,
  })
  window.dispatchEvent(new CustomEvent('editor-insert', { detail: { text: markdown } }))
}

/** 原生菜单与快捷键复用统一的打开文件夹流程 */
export async function openFolderFromPicker(): Promise<void> {
  await openFolderDialog()
}
