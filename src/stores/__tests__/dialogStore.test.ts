import { describe, it, expect, beforeEach } from 'vitest'
import { useDialogStore } from '../dialogStore'

describe('dialogStore', () => {
  beforeEach(() => {
    useDialogStore.setState({ current: null })
  })

  it('ask suspends until answer(true)', async () => {
    const promise = useDialogStore.getState().ask('confirm', 'Discard?')

    expect(useDialogStore.getState().current).toMatchObject({
      kind: 'confirm',
      message: 'Discard?',
    })

    useDialogStore.getState().answer(true)

    await expect(promise).resolves.toBe(true)
    expect(useDialogStore.getState().current).toBeNull()
  })

  it('answer(false) resolves with false', async () => {
    const promise = useDialogStore.getState().ask('confirm', 'Discard?')
    useDialogStore.getState().answer(false)

    await expect(promise).resolves.toBe(false)
    expect(useDialogStore.getState().current).toBeNull()
  })

  it('ask with alert kind resolves via answer', async () => {
    const promise = useDialogStore.getState().ask('alert', 'Something failed')

    expect(useDialogStore.getState().current?.kind).toBe('alert')

    useDialogStore.getState().answer(true)
    await expect(promise).resolves.toBe(true)
  })

  it('a second ask closes the previous dialog with false (no hanging promise)', async () => {
    const first = useDialogStore.getState().ask('confirm', 'first')
    const second = useDialogStore.getState().ask('confirm', 'second')

    // 第一个被以 false 关闭
    await expect(first).resolves.toBe(false)
    expect(useDialogStore.getState().current?.message).toBe('second')

    useDialogStore.getState().answer(true)
    await expect(second).resolves.toBe(true)
  })

  it('answer without an open dialog is a no-op', () => {
    expect(() => useDialogStore.getState().answer(true)).not.toThrow()
    expect(useDialogStore.getState().current).toBeNull()
  })
})
