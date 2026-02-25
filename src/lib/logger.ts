/**
 * Unified logging system for VividMark
 *
 * Provides structured logging with module identification,
 * log level filtering, and performance timing.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface Logger {
  debug(message: string, data?: unknown): void
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, error?: unknown): void
  time(label: string): void
  timeEnd(label: string): void
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// Development mode shows all logs, production only shows errors
const isDev = import.meta.env.DEV
const minLevel: LogLevel = isDev ? 'debug' : 'error'

// Store timing data
const timers = new Map<string, number>()

/**
 * Format log output with module name and level
 */
function formatOutput(module: string, level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8)
  return `[${timestamp}] [${module}] ${level.toUpperCase()}: ${message}`
}

/**
 * Create a logger instance for a specific module
 */
export function createLogger(module: string): Logger {
  const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVELS[level] >= LOG_LEVELS[minLevel]
  }

  return {
    debug(message: string, data?: unknown): void {
      if (shouldLog('debug')) {
        if (data !== undefined) {
          console.debug(formatOutput(module, 'debug', message), data)
        } else {
          console.debug(formatOutput(module, 'debug', message))
        }
      }
    },

    info(message: string, data?: unknown): void {
      if (shouldLog('info')) {
        if (data !== undefined) {
          console.info(formatOutput(module, 'info', message), data)
        } else {
          console.info(formatOutput(module, 'info', message))
        }
      }
    },

    warn(message: string, data?: unknown): void {
      if (shouldLog('warn')) {
        if (data !== undefined) {
          console.warn(formatOutput(module, 'warn', message), data)
        } else {
          console.warn(formatOutput(module, 'warn', message))
        }
      }
    },

    error(message: string, error?: unknown): void {
      if (shouldLog('error')) {
        if (error !== undefined) {
          console.error(formatOutput(module, 'error', message), error)
        } else {
          console.error(formatOutput(module, 'error', message))
        }
      }
    },

    time(label: string): void {
      if (isDev) {
        timers.set(`${module}:${label}`, performance.now())
      }
    },

    timeEnd(label: string): void {
      if (isDev) {
        const key = `${module}:${label}`
        const startTime = timers.get(key)
        if (startTime !== undefined) {
          const elapsed = performance.now() - startTime
          timers.delete(key)
          console.debug(formatOutput(module, 'debug', `${label}: ${elapsed.toFixed(2)}ms`))
        }
      }
    },
  }
}

// Pre-configured loggers for common modules
export const fileOpsLogger = createLogger('FileOps')
export const autoSaveLogger = createLogger('AutoSave')
export const editorLogger = createLogger('Editor')
export const dragDropLogger = createLogger('DragDrop')
