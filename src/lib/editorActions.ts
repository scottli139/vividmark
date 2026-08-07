import { open } from '@tauri-apps/plugin-dialog'
import { useEditorStore } from '../stores/editorStore'
import { selectLocalImage, createImageMarkdown } from './imageUtils'

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

/** 打开文件夹选择器并设为文件树根目录（Sidebar 入口与原生菜单「打开文件夹」共用） */
export async function openFolderFromPicker(): Promise<void> {
  const selected = await open({
    directory: true,
    multiple: false,
  })

  if (selected && typeof selected === 'string') {
    useEditorStore.getState().setOpenedFolder(selected)
  }
}
