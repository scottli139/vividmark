import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  toggleFolder,
  findTreeItem,
  expandParentPaths,
  updateTreeItem,
  filterMarkdownFiles,
  getFileExtension,
  getFileIconType,
  type FileTreeItem,
} from '../fileTreeUtils'
import { resetTauriMocks, setupDefaultTauriMocks } from '../../test/mocks/tauri'

// Mock Tauri APIs - must define mock inside factory
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

describe('fileTreeUtils', () => {
  beforeEach(() => {
    resetTauriMocks()
    setupDefaultTauriMocks()
  })

  describe('toggleFolder', () => {
    it('should toggle folder expansion state', () => {
      const items: FileTreeItem[] = [
        {
          name: 'docs',
          path: '/docs',
          isDirectory: true,
          isExpanded: false,
          children: [],
        },
      ]

      const result = toggleFolder(items, '/docs')

      expect(result[0].isExpanded).toBe(true)
    })

    it('should collapse expanded folder', () => {
      const items: FileTreeItem[] = [
        {
          name: 'docs',
          path: '/docs',
          isDirectory: true,
          isExpanded: true,
          children: [],
        },
      ]

      const result = toggleFolder(items, '/docs')

      expect(result[0].isExpanded).toBe(false)
    })

    it('should toggle nested folder', () => {
      const items: FileTreeItem[] = [
        {
          name: 'root',
          path: '/root',
          isDirectory: true,
          children: [
            {
              name: 'nested',
              path: '/root/nested',
              isDirectory: true,
              isExpanded: false,
              children: [],
            },
          ],
        },
      ]

      const result = toggleFolder(items, '/root/nested')

      expect(result[0].children?.[0].isExpanded).toBe(true)
    })

    it('should not modify other items', () => {
      const items: FileTreeItem[] = [
        {
          name: 'docs',
          path: '/docs',
          isDirectory: true,
          isExpanded: false,
          children: [],
        },
        {
          name: 'src',
          path: '/src',
          isDirectory: true,
          isExpanded: false,
          children: [],
        },
      ]

      const result = toggleFolder(items, '/docs')

      expect(result[0].isExpanded).toBe(true)
      expect(result[1].isExpanded).toBe(false)
    })
  })

  describe('findTreeItem', () => {
    it('should find item at root level', () => {
      const items: FileTreeItem[] = [{ name: 'readme.md', path: '/readme.md', isDirectory: false }]

      const result = findTreeItem(items, '/readme.md')

      expect(result).toEqual(items[0])
    })

    it('should find nested item', () => {
      const items: FileTreeItem[] = [
        {
          name: 'src',
          path: '/src',
          isDirectory: true,
          children: [
            {
              name: 'main.ts',
              path: '/src/main.ts',
              isDirectory: false,
            },
          ],
        },
      ]

      const result = findTreeItem(items, '/src/main.ts')

      expect(result).toEqual(items[0].children?.[0])
    })

    it('should return undefined for non-existent path', () => {
      const items: FileTreeItem[] = [{ name: 'readme.md', path: '/readme.md', isDirectory: false }]

      const result = findTreeItem(items, '/non-existent.md')

      expect(result).toBeUndefined()
    })

    it('should return undefined for empty array', () => {
      const result = findTreeItem([], '/readme.md')

      expect(result).toBeUndefined()
    })
  })

  describe('expandParentPaths', () => {
    it('should expand parent folders of target path', () => {
      const items: FileTreeItem[] = [
        {
          name: 'root',
          path: '/root',
          isDirectory: true,
          isExpanded: false,
          children: [
            {
              name: 'nested',
              path: '/root/nested',
              isDirectory: true,
              isExpanded: false,
              children: [],
            },
          ],
        },
      ]

      const result = expandParentPaths(items, '/root/nested/file.md')

      expect(result[0].isExpanded).toBe(true)
      expect(result[0].children?.[0].isExpanded).toBe(true)
    })

    it('should expand target itself if it is a directory', () => {
      const items: FileTreeItem[] = [
        {
          name: 'docs',
          path: '/docs',
          isDirectory: true,
          isExpanded: false,
          children: [],
        },
      ]

      const result = expandParentPaths(items, '/docs')

      expect(result[0].isExpanded).toBe(true)
    })

    it('should handle multiple siblings correctly', () => {
      const items: FileTreeItem[] = [
        {
          name: 'a',
          path: '/a',
          isDirectory: true,
          isExpanded: false,
          children: [],
        },
        {
          name: 'b',
          path: '/b',
          isDirectory: true,
          isExpanded: false,
          children: [],
        },
      ]

      const result = expandParentPaths(items, '/b/file.md')

      expect(result[0].isExpanded).toBe(false)
      expect(result[1].isExpanded).toBe(true)
    })
  })

  describe('updateTreeItem', () => {
    it('should update item properties', () => {
      const items: FileTreeItem[] = [{ name: 'readme.md', path: '/readme.md', isDirectory: false }]

      const result = updateTreeItem(items, '/readme.md', { name: 'README.md' })

      expect(result[0].name).toBe('README.md')
      expect(result[0].path).toBe('/readme.md')
    })

    it('should update nested item', () => {
      const items: FileTreeItem[] = [
        {
          name: 'src',
          path: '/src',
          isDirectory: true,
          children: [{ name: 'main.ts', path: '/src/main.ts', isDirectory: false }],
        },
      ]

      const result = updateTreeItem(items, '/src/main.ts', { name: 'index.ts' })

      expect(result[0].children?.[0].name).toBe('index.ts')
    })

    it('should not modify other items', () => {
      const items: FileTreeItem[] = [
        { name: 'a.md', path: '/a.md', isDirectory: false },
        { name: 'b.md', path: '/b.md', isDirectory: false },
      ]

      const result = updateTreeItem(items, '/a.md', { name: 'A.md' })

      expect(result[0].name).toBe('A.md')
      expect(result[1].name).toBe('b.md')
    })
  })

  describe('filterMarkdownFiles', () => {
    it('should keep markdown files', () => {
      const items: FileTreeItem[] = [
        { name: 'readme.md', path: '/readme.md', isDirectory: false },
        { name: 'doc.markdown', path: '/doc.markdown', isDirectory: false },
        { name: 'note.txt', path: '/note.txt', isDirectory: false },
      ]

      const result = filterMarkdownFiles(items)

      expect(result).toHaveLength(3)
    })

    it('should filter out non-markdown files', () => {
      const items: FileTreeItem[] = [
        { name: 'readme.md', path: '/readme.md', isDirectory: false },
        { name: 'image.png', path: '/image.png', isDirectory: false },
        { name: 'script.js', path: '/script.js', isDirectory: false },
      ]

      const result = filterMarkdownFiles(items)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('readme.md')
    })

    it('should keep all directories', () => {
      const items: FileTreeItem[] = [
        {
          name: 'docs',
          path: '/docs',
          isDirectory: true,
          children: [
            { name: 'image.png', path: '/docs/image.png', isDirectory: false },
            { name: 'readme.md', path: '/docs/readme.md', isDirectory: false },
          ],
        },
      ]

      const result = filterMarkdownFiles(items)

      expect(result).toHaveLength(1)
      expect(result[0].children).toHaveLength(1)
      expect(result[0].children?.[0].name).toBe('readme.md')
    })

    it('should handle empty array', () => {
      const result = filterMarkdownFiles([])

      expect(result).toHaveLength(0)
    })

    it('should recursively filter nested directories', () => {
      const items: FileTreeItem[] = [
        {
          name: 'src',
          path: '/src',
          isDirectory: true,
          children: [
            {
              name: 'components',
              path: '/src/components',
              isDirectory: true,
              children: [
                { name: 'Button.tsx', path: '/src/components/Button.tsx', isDirectory: false },
                { name: 'readme.md', path: '/src/components/readme.md', isDirectory: false },
              ],
            },
          ],
        },
      ]

      const result = filterMarkdownFiles(items)

      expect(result[0].children?.[0].children).toHaveLength(1)
      expect(result[0].children?.[0].children?.[0].name).toBe('readme.md')
    })
  })

  describe('getFileExtension', () => {
    it('should return extension for file with extension', () => {
      expect(getFileExtension('document.md')).toBe('md')
      expect(getFileExtension('script.js')).toBe('js')
      expect(getFileExtension('archive.tar.gz')).toBe('gz')
    })

    it('should return empty string for file without extension', () => {
      expect(getFileExtension('Makefile')).toBe('')
      expect(getFileExtension('README')).toBe('')
    })

    it('should handle hidden files', () => {
      expect(getFileExtension('.gitignore')).toBe('')
      expect(getFileExtension('.env.local')).toBe('local')
    })

    it('should return lowercase extension', () => {
      expect(getFileExtension('Document.MD')).toBe('md')
      expect(getFileExtension('Script.JS')).toBe('js')
    })
  })

  describe('getFileIconType', () => {
    it('should return folder for closed directory', () => {
      const item: FileTreeItem = {
        name: 'docs',
        path: '/docs',
        isDirectory: true,
        isExpanded: false,
      }

      expect(getFileIconType(item)).toBe('folder')
    })

    it('should return folder-open for expanded directory', () => {
      const item: FileTreeItem = {
        name: 'docs',
        path: '/docs',
        isDirectory: true,
        isExpanded: true,
      }

      expect(getFileIconType(item)).toBe('folder-open')
    })

    it('should return markdown for markdown files', () => {
      const mdItem: FileTreeItem = {
        name: 'readme.md',
        path: '/readme.md',
        isDirectory: false,
      }
      const markdownItem: FileTreeItem = {
        name: 'doc.markdown',
        path: '/doc.markdown',
        isDirectory: false,
      }

      expect(getFileIconType(mdItem)).toBe('markdown')
      expect(getFileIconType(markdownItem)).toBe('markdown')
    })

    it('should return code for code files', () => {
      const jsItem: FileTreeItem = {
        name: 'script.js',
        path: '/script.js',
        isDirectory: false,
      }
      const tsItem: FileTreeItem = {
        name: 'main.ts',
        path: '/main.ts',
        isDirectory: false,
      }

      expect(getFileIconType(jsItem)).toBe('code')
      expect(getFileIconType(tsItem)).toBe('code')
    })

    it('should return image for image files', () => {
      const pngItem: FileTreeItem = {
        name: 'image.png',
        path: '/image.png',
        isDirectory: false,
      }
      const jpgItem: FileTreeItem = {
        name: 'photo.jpg',
        path: '/photo.jpg',
        isDirectory: false,
      }

      expect(getFileIconType(pngItem)).toBe('image')
      expect(getFileIconType(jpgItem)).toBe('image')
    })

    it('should return file for unknown extensions', () => {
      const item: FileTreeItem = {
        name: 'unknown.xyz',
        path: '/unknown.xyz',
        isDirectory: false,
      }

      expect(getFileIconType(item)).toBe('file')
    })
  })
})
