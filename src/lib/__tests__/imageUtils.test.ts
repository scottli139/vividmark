import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isLocalPath,
  isUrl,
  extractImagePath,
  saveImageFileToAssets,
  createImageMarkdownFromFile,
} from '../imageUtils'
import { writeFile, mkdir, exists } from '@tauri-apps/plugin-fs'

// Mock Tauri API
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  copyFile: vi.fn(),
  mkdir: vi.fn(),
  exists: vi.fn(),
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn((...parts: string[]) => parts.join('/')),
  dirname: vi.fn((path: string) => path.substring(0, path.lastIndexOf('/'))),
  basename: vi.fn((path: string) => path.split('/').pop() || ''),
}))

const mockWriteFile = vi.mocked(writeFile)
const mockMkdir = vi.mocked(mkdir)
const mockExists = vi.mocked(exists)

describe('isLocalPath', () => {
  it('should return true for Unix absolute paths', () => {
    expect(isLocalPath('/Users/build/image.png')).toBe(true)
    expect(isLocalPath('/home/user/docs/photo.jpg')).toBe(true)
    expect(isLocalPath('/tmp/test.gif')).toBe(true)
  })

  it('should return true for relative paths', () => {
    expect(isLocalPath('./assets/image.png')).toBe(true)
    expect(isLocalPath('../images/photo.jpg')).toBe(true)
    expect(isLocalPath('./file.txt')).toBe(true)
  })

  it('should return true for Windows paths', () => {
    expect(isLocalPath('C:\\Users\\build\\image.png')).toBe(true)
    expect(isLocalPath('D:\\Projects\\file.jpg')).toBe(true)
    expect(isLocalPath('E:\\test.gif')).toBe(true)
  })

  it('should return false for HTTP URLs', () => {
    expect(isLocalPath('http://example.com/image.png')).toBe(false)
    expect(isLocalPath('https://example.com/photo.jpg')).toBe(false)
  })

  it('should return false for data URLs', () => {
    expect(isLocalPath('data:image/png;base64,abc123')).toBe(false)
    expect(isLocalPath('data:text/plain;base64,SGVsbG8=')).toBe(false)
  })

  it('should return false for protocol-relative URLs', () => {
    expect(isLocalPath('//example.com/image.png')).toBe(false)
    expect(isLocalPath('//cdn.example.com/img.jpg')).toBe(false)
  })
})

describe('isUrl', () => {
  it('should return true for HTTP URLs', () => {
    expect(isUrl('http://example.com/image.png')).toBe(true)
    expect(isUrl('https://example.com/photo.jpg')).toBe(true)
    expect(isUrl('https://cdn.example.com/path/to/file.gif')).toBe(true)
  })

  it('should return true for data URLs', () => {
    expect(isUrl('data:image/png;base64,abc123')).toBe(true)
    expect(isUrl('data:image/jpeg;base64,/9j/4AAQ')).toBe(true)
  })

  it('should return false for local paths', () => {
    expect(isUrl('/Users/build/image.png')).toBe(false)
    expect(isUrl('./assets/photo.jpg')).toBe(false)
    expect(isUrl('../images/test.gif')).toBe(false)
    expect(isUrl('C:\\Users\\file.png')).toBe(false)
  })

  it('should return false for plain text', () => {
    expect(isUrl('image.png')).toBe(false)
    expect(isUrl('just-some-text')).toBe(false)
  })

  it('should return true for protocol-relative URLs', () => {
    expect(isUrl('//example.com/image.png')).toBe(true)
    expect(isUrl('//cdn.example.com/img.jpg')).toBe(true)
  })
})

describe('extractImagePath', () => {
  it('should extract path from simple markdown image', () => {
    const result = extractImagePath('![alt text](./assets/image.png)')
    expect(result).toBe('./assets/image.png')
  })

  it('should extract absolute path', () => {
    const result = extractImagePath('![photo](/Users/build/photo.jpg)')
    expect(result).toBe('/Users/build/photo.jpg')
  })

  it('should extract URL path', () => {
    const result = extractImagePath('![image](https://example.com/img.png)')
    expect(result).toBe('https://example.com/img.png')
  })

  it('should extract path with spaces in alt text', () => {
    const result = extractImagePath('![my cool image](./assets/pic.png)')
    expect(result).toBe('./assets/pic.png')
  })

  it('should return null for non-image markdown', () => {
    const result = extractImagePath('[link text](https://example.com)')
    expect(result).toBeNull()
  })

  it('should return null for plain text', () => {
    const result = extractImagePath('just some text')
    expect(result).toBeNull()
  })

  it('should handle empty alt text', () => {
    const result = extractImagePath('![](./assets/image.png)')
    expect(result).toBe('./assets/image.png')
  })

  it('should extract data URL', () => {
    const result = extractImagePath('![image](data:image/png;base64,abc123)')
    expect(result).toBe('data:image/png;base64,abc123')
  })

  it('should handle multiple images and return first one', () => {
    const markdown = '![first](./img1.png) and ![second](./img2.png)'
    const result = extractImagePath(markdown)
    expect(result).toBe('./img1.png')
  })

  it('should handle paths with special characters', () => {
    const result = extractImagePath('![image](./assets/my-file_v2.png)')
    expect(result).toBe('./assets/my-file_v2.png')
  })
})

describe('saveImageFileToAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExists.mockResolvedValue(true)
    mockWriteFile.mockResolvedValue(undefined)
  })

  it('should write image bytes to assets dir and return relative path', async () => {
    const file = new File(['fake-png-bytes'], 'photo.png', { type: 'image/png' })

    const result = await saveImageFileToAssets(file, '/docs/note.md')

    expect(mockWriteFile).toHaveBeenCalledTimes(1)
    const [targetPath, bytes] = mockWriteFile.mock.calls[0]
    expect(targetPath).toMatch(/^\/docs\/assets\/\d+_photo\.png$/)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(result).toMatch(/^\.\/assets\/\d+_photo\.png$/)
  })

  it('should create assets dir when missing', async () => {
    mockExists.mockResolvedValue(false)
    mockMkdir.mockResolvedValue(undefined)
    const file = new File(['x'], 'pic.jpg', { type: 'image/jpeg' })

    const result = await saveImageFileToAssets(file, '/docs/note.md')

    expect(mockMkdir).toHaveBeenCalledWith('/docs/assets', { recursive: true })
    expect(result).toMatch(/^\.\/assets\/\d+_pic\.jpg$/)
  })

  it('should sanitize unsafe characters in file name', async () => {
    const file = new File(['x'], 'my photo (1).png', { type: 'image/png' })

    const result = await saveImageFileToAssets(file, '/docs/note.md')

    expect(result).toMatch(/^\.\/assets\/\d+_my_photo__1_\.png$/)
  })

  it('should return null when write fails', async () => {
    mockWriteFile.mockRejectedValue(new Error('disk full'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const file = new File(['x'], 'photo.png', { type: 'image/png' })

    const result = await saveImageFileToAssets(file, '/docs/note.md')

    expect(result).toBeNull()
    consoleSpy.mockRestore()
  })
})

describe('createImageMarkdownFromFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExists.mockResolvedValue(true)
    mockWriteFile.mockResolvedValue(undefined)
  })

  it('should use assets relative path when document is saved', async () => {
    const file = new File(['fake'], 'screenshot.png', { type: 'image/png' })

    const result = await createImageMarkdownFromFile(file, '/docs/note.md')

    expect(result).toMatch(/^!\[screenshot\]\(\.\/assets\/\d+_screenshot\.png\)$/)
  })

  it('should fall back to base64 data URL when document is unsaved', async () => {
    const file = new File(['fake'], 'screenshot.png', { type: 'image/png' })

    const result = await createImageMarkdownFromFile(file, null)

    expect(mockWriteFile).not.toHaveBeenCalled()
    expect(result).toMatch(/^!\[screenshot\]\(data:image\/png;base64,.+\)$/)
  })

  it('should fall back to base64 when assets write fails', async () => {
    mockWriteFile.mockRejectedValue(new Error('fail'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const file = new File(['fake'], 'photo.png', { type: 'image/png' })

    const result = await createImageMarkdownFromFile(file, '/docs/note.md')

    expect(result).toMatch(/^!\[photo\]\(data:image\/png;base64,.+\)$/)
    consoleSpy.mockRestore()
  })

  it('should strip extension for alt text', async () => {
    const file = new File(['fake'], 'my.image.jpeg', { type: 'image/jpeg' })

    const result = await createImageMarkdownFromFile(file, '/docs/note.md')

    expect(result).toMatch(/^!\[my\.image\]/)
  })
})
