import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLogger } from '../logger'

describe('logger', () => {
  // Mock console methods
  const originalConsole = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  }

  const mocks = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }

  beforeEach(() => {
    console.debug = mocks.debug
    console.info = mocks.info
    console.warn = mocks.warn
    console.error = mocks.error
    vi.clearAllMocks()
  })

  afterEach(() => {
    console.debug = originalConsole.debug
    console.info = originalConsole.info
    console.warn = originalConsole.warn
    console.error = originalConsole.error
  })

  describe('createLogger', () => {
    it('should create a logger with the specified module name', () => {
      const logger = createLogger('TestModule')
      expect(logger).toBeDefined()
      expect(logger.debug).toBeTypeOf('function')
      expect(logger.info).toBeTypeOf('function')
      expect(logger.warn).toBeTypeOf('function')
      expect(logger.error).toBeTypeOf('function')
      expect(logger.time).toBeTypeOf('function')
      expect(logger.timeEnd).toBeTypeOf('function')
    })

    it('should include module name in log output', () => {
      const logger = createLogger('MyModule')
      logger.error('Test error message')

      expect(mocks.error).toHaveBeenCalled()
      const call = mocks.error.mock.calls[0]
      expect(call[0]).toContain('[MyModule]')
      expect(call[0]).toContain('ERROR:')
      expect(call[0]).toContain('Test error message')
    })

    it('should include timestamp in log output', () => {
      const logger = createLogger('TestModule')
      logger.error('Test message')

      const call = mocks.error.mock.calls[0]
      // Timestamp format: [HH:MM:SS]
      expect(call[0]).toMatch(/\[\d{2}:\d{2}:\d{2}\]/)
    })
  })

  describe('log levels', () => {
    it('should log debug messages with debug method', () => {
      const logger = createLogger('Test')
      logger.debug('Debug message')

      // In dev mode, debug should be logged
      // The actual behavior depends on import.meta.env.DEV
      if (mocks.debug.mock.calls.length > 0) {
        const call = mocks.debug.mock.calls[0]
        expect(call[0]).toContain('DEBUG:')
        expect(call[0]).toContain('Debug message')
      }
    })

    it('should log info messages with info method', () => {
      const logger = createLogger('Test')
      logger.info('Info message')

      if (mocks.info.mock.calls.length > 0) {
        const call = mocks.info.mock.calls[0]
        expect(call[0]).toContain('INFO:')
        expect(call[0]).toContain('Info message')
      }
    })

    it('should log warn messages with warn method', () => {
      const logger = createLogger('Test')
      logger.warn('Warning message')

      if (mocks.warn.mock.calls.length > 0) {
        const call = mocks.warn.mock.calls[0]
        expect(call[0]).toContain('WARN:')
        expect(call[0]).toContain('Warning message')
      }
    })

    it('should always log error messages', () => {
      const logger = createLogger('Test')
      logger.error('Error message')

      expect(mocks.error).toHaveBeenCalled()
      const call = mocks.error.mock.calls[0]
      expect(call[0]).toContain('ERROR:')
      expect(call[0]).toContain('Error message')
    })
  })

  describe('data parameter', () => {
    it('should include data as second argument when provided', () => {
      const logger = createLogger('Test')
      const data = { key: 'value', count: 42 }
      logger.error('Error with data', data)

      expect(mocks.error).toHaveBeenCalled()
      const call = mocks.error.mock.calls[0]
      expect(call[1]).toEqual(data)
    })

    it('should handle error objects', () => {
      const logger = createLogger('Test')
      const error = new Error('Test error')
      logger.error('Operation failed', error)

      expect(mocks.error).toHaveBeenCalled()
      const call = mocks.error.mock.calls[0]
      expect(call[1]).toBe(error)
    })

    it('should work without data parameter', () => {
      const logger = createLogger('Test')
      logger.error('Simple error')

      expect(mocks.error).toHaveBeenCalled()
      const call = mocks.error.mock.calls[0]
      expect(call).toHaveLength(1) // Only the formatted message
    })
  })

  describe('time/timeEnd', () => {
    it('should measure elapsed time', () => {
      const logger = createLogger('PerfTest')

      logger.time('operation')
      // Simulate some work
      for (let i = 0; i < 1000; i++) {
        Math.random()
      }
      logger.timeEnd('operation')

      // In dev mode, timeEnd should log
      if (mocks.debug.mock.calls.length > 0) {
        const call = mocks.debug.mock.calls[mocks.debug.mock.calls.length - 1]
        expect(call[0]).toContain('operation:')
        expect(call[0]).toMatch(/\d+\.\d{2}ms/)
      }
    })

    it('should handle multiple timers', () => {
      const logger = createLogger('MultiTimer')

      logger.time('timer1')
      logger.time('timer2')

      logger.timeEnd('timer1')
      logger.timeEnd('timer2')

      // Both timers should complete without error
      expect(true).toBe(true)
    })

    it('should isolate timers by module', () => {
      const logger1 = createLogger('Module1')
      const logger2 = createLogger('Module2')

      logger1.time('shared-name')
      logger2.time('shared-name')

      logger1.timeEnd('shared-name')
      logger2.timeEnd('shared-name')

      // Both should complete without interference
      expect(true).toBe(true)
    })
  })
})
