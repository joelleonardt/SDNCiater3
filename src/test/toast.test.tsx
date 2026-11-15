import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast } from '@/components/ui/Toast/useToast'
import { useUIStore } from '@/stores/uiStore'

describe('useToast & uiStore regression', () => {
  beforeEach(() => {
    useUIStore.setState({ toasts: [] })
  })

  it('keeps toast callbacks referentially stable across re-renders', () => {
    const { result, rerender } = renderHook(() => useToast())
    const first = result.current

    act(() => {
      first.toastError('Gagal memuat pengaturan', 'TypeError: Failed to fetch')
    })
    rerender()

    const second = result.current
    expect(second).toBe(first)
    expect(second.toastError).toBe(first.toastError)
    expect(second.toastSuccess).toBe(first.toastSuccess)
    expect(second.toast).toBe(first.toast)
    expect(second.dismissToast).toBe(first.dismissToast)
  })

  it('deduplicates identical active toasts and caps stack to 4', () => {
    const { pushToast } = useUIStore.getState()

    pushToast({ title: 'Gagal memuat pengaturan', description: 'TypeError: Failed to fetch', variant: 'destructive' })
    pushToast({ title: 'Gagal memuat pengaturan', description: 'TypeError: Failed to fetch', variant: 'destructive' })
    pushToast({ title: 'Gagal memuat pengaturan', description: 'TypeError: Failed to fetch', variant: 'destructive' })

    expect(useUIStore.getState().toasts).toHaveLength(1)

    for (let i = 1; i <= 6; i++) {
      pushToast({ title: `Error ${i}`, variant: 'destructive' })
    }

    const toasts = useUIStore.getState().toasts
    expect(toasts).toHaveLength(4)
    expect(toasts.map((t) => t.title)).toEqual(['Error 3', 'Error 4', 'Error 5', 'Error 6'])
  })
})
