import { describe, it, expect, vi } from 'vitest'
import { isLocalPath, isUrl, extractImagePath } from '../imageUtils'

// Mock Tauri API
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn(),
  copyFile: vi.fn(),
  mkdir: vi.fn(),
  exists: vi.fn(),
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn((...parts: string[]) => parts.join('/')),
  dirname: vi.fn((path: string) => path.substring(0, path.lastIndexOf('/'))),
  basename: vi.fn((path: string) => path.split('/').pop() || ''),
}))

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
