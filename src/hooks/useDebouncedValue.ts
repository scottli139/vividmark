import { useEffect, useState } from 'react'

/**
 * 通用防抖 Hook：value 停止变化 delay 毫秒后才更新返回值
 *
 * 用于大纲/字数统计等派生计算，避免每次按键全量重算
 */
export function useDebouncedValue<T>(value: T, delay = 200): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
