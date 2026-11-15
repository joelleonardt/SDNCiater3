import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { isUserPendingVerification } from '@/services/userService'
import PendingVerificationList from '@/features/users/PendingVerificationList'
import type { Profile } from '@/types/database.types'

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'user-1',
    school_id: null,
    full_name: 'Quenzino Aaron',
    email: 'quenzino@example.com',
    role: 'Guru',
    requested_role: null,
    avatar_url: null,
    is_active: true,
    created_at: '2026-11-15T00:00:00Z',
    ...overrides,
  }
}

describe('isUserPendingVerification', () => {
  it('returns true for active accounts with null school_id', () => {
    expect(isUserPendingVerification(makeProfile({ school_id: null, is_active: true }))).toBe(true)
  })

  it('returns false for deactivated accounts even when school_id is null', () => {
    expect(isUserPendingVerification(makeProfile({ school_id: null, is_active: false }))).toBe(false)
  })

  it('returns true for linked accounts with differing requested_role', () => {
    expect(
      isUserPendingVerification(
        makeProfile({ school_id: 'school-1', role: 'Guru', requested_role: 'Staf_Admin' })
      )
    ).toBe(true)
  })

  it('returns false for linked accounts with no different requested_role', () => {
    expect(
      isUserPendingVerification(
        makeProfile({ school_id: 'school-1', role: 'Guru', requested_role: null })
      )
    ).toBe(false)
    expect(
      isUserPendingVerification(
        makeProfile({ school_id: 'school-1', role: 'Guru', requested_role: 'Guru' })
      )
    ).toBe(false)
  })
})

describe('PendingVerificationList', () => {
  it('allows admin to choose role and verify an unlinked new account', async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined)
    const onReject = vi.fn().mockResolvedValue(undefined)
    const newUser = makeProfile({
      id: 'user-new',
      full_name: 'Quenzino Aaron',
      school_id: null,
      role: 'Guru',
      requested_role: 'Guru',
    })

    render(
      <PendingVerificationList
        users={[newUser]}
        canManage
        onApprove={onApprove}
        onReject={onReject}
      />
    )

    expect(screen.getByText('Quenzino Aaron')).toBeInTheDocument()
    expect(screen.getByText('Akun Baru')).toBeInTheDocument()

    const select = screen.getByLabelText('Pilih peran untuk Quenzino Aaron') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'Kepala_Sekolah' } })

    fireEvent.click(screen.getByRole('button', { name: /Verifikasi & Setujui/i }))

    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledTimes(1)
      expect(onApprove).toHaveBeenCalledWith(newUser, 'Kepala_Sekolah')
    })

    fireEvent.click(screen.getByRole('button', { name: /Tolak/i }))
    await waitFor(() => {
      expect(onReject).toHaveBeenCalledWith(newUser)
    })
  })

  it('renders empty state and reload button when showWhenEmpty is true', () => {
    const onReload = vi.fn()
    render(
      <PendingVerificationList
        users={[]}
        canManage
        showWhenEmpty
        onReload={onReload}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    )

    expect(
      screen.getByText(/Belum ada akun baru atau pengajuan perubahan peran/i)
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Muat Ulang/i }))
    expect(onReload).toHaveBeenCalledTimes(1)
  })
})
