import { invoke } from '@tauri-apps/api/core'
import { useEditorStore } from '../stores/editorStore'
import { fileOpsLogger } from './logger'

interface ExportPdfParams {
  htmlContent: string
  title?: string
}

interface ExportPdfResult {
  success: boolean
  error: string | null
}

/**
 * 使用 WebView 原生打印功能导出 PDF
 * 
 * 工作原理：
 * 1. 调用 Rust 后端的 print_pdf 命令
 * 2. Rust 在当前 WebView 中注入打印样式并执行 window.print()
 * 3. 系统弹出原生打印对话框，用户可选择"保存为 PDF"
 * 
 * 优点：
 * - 在应用内完成，无需跳转浏览器
 * - 使用系统原生打印对话框
 * - 支持实时预览当前渲染的内容
 */
export async function printToPdf(): Promise<boolean> {
  fileOpsLogger.time('printPdf')
  fileOpsLogger.info('Opening native print dialog')

  try {
    // 获取当前文件名
    const { fileName } = useEditorStore.getState()
    const baseFileName = fileName.replace(/\.[^/.]+$/, '') || 'document'

    const result = await invoke<ExportPdfResult>('print_pdf', {
      fileName: baseFileName,
    })

    if (result.success) {
      fileOpsLogger.timeEnd('printPdf')
      fileOpsLogger.info('Print dialog opened successfully')
      return true
    }

    fileOpsLogger.error('Failed to open print dialog:', result.error)
    return false
  } catch (error) {
    fileOpsLogger.error('Print PDF error:', error)
    return false
  }
}

/**
 * 导出当前文档为 PDF（使用浏览器方式，保留备用）
 * 
 * 工作原理：
 * 1. 将 Markdown 渲染后的 HTML 发送到 Rust 后端
 * 2. Rust 创建临时 HTML 文件并添加打印样式
 * 3. 使用系统默认浏览器打开 HTML 文件
 * 4. 用户可以在浏览器中使用"打印为 PDF"功能
 */
export async function exportToPdf(params: ExportPdfParams): Promise<boolean> {
  fileOpsLogger.time('exportPdf')
  fileOpsLogger.debug('Exporting to PDF:', { title: params.title, contentSize: params.htmlContent.length })

  try {
    const result = await invoke<ExportPdfResult>('export_pdf', {
      params: {
        html_content: params.htmlContent,
        title: params.title,
      },
    })

    if (result.success) {
      fileOpsLogger.timeEnd('exportPdf')
      fileOpsLogger.info('PDF export initiated successfully')
      return true
    }

    fileOpsLogger.error('PDF export failed:', result.error)
    return false
  } catch (error) {
    fileOpsLogger.error('PDF export error:', error)
    return false
  }
}

/**
 * 导出当前编辑器内容（使用新的原生打印方式）
 * 
 * @returns 是否成功
 */
export async function exportCurrentDocument(): Promise<boolean> {
  return printToPdf()
}
