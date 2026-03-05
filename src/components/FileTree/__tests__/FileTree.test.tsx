import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FileTree } from '../FileTree'
import { useEditorStore } from '../../../stores/editorStore'

// Mock Tauri APIs - must be self-contained factory
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

// Mock fileOps
vi.mock('../../../lib/fileOps', () => ({
  openFileByPath: vi.fn().mockResolvedValue(true),
}))

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('FileTree', () => {
  beforeEach(() => {
    // Reset store
    useEditorStore.setState({
      openedFolder: null,
      filePath: null,
      isDirty: false,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('when no folder is opened', () => {
    it('should show open folder button', () => {
      render(<FileTree />)
      expect(screen.getByText('fileTree.openFolder')).toBeInTheDocument()
    })
  })
})
