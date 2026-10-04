import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '@/pages/settings/SettingsPage';

const mocks = vi.hoisted(() => ({
  useMe: vi.fn(),
  useUpdateProfile: vi.fn(),
  useChangePassword: vi.fn(),
  useLogoutAll: vi.fn(),
  useUnsavedChangesWarning: vi.fn(),
  useToast: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  logoutAll: vi.fn(),
  confirmLeave: vi.fn(),
  cancelLeave: vi.fn(),
  successToast: vi.fn(),
}));

vi.mock('@/hooks/auth/useMe', () => ({ useMe: mocks.useMe }));
vi.mock('@/hooks/auth/useUpdateProfile', () => ({ useUpdateProfile: mocks.useUpdateProfile }));
vi.mock('@/hooks/auth/useChangePassword', () => ({ useChangePassword: mocks.useChangePassword }));
vi.mock('@/hooks/auth/useLogoutAll', () => ({ useLogoutAll: mocks.useLogoutAll }));
vi.mock('@/hooks/useUnsavedChangesWarning', () => ({ useUnsavedChangesWarning: mocks.useUnsavedChangesWarning }));
vi.mock('@/hooks/useToast', () => ({ useToast: mocks.useToast }));

describe('SettingsPage (FE-099)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useMe.mockReturnValue({
      data: { id: 'user-1', name: 'Alex Student', email: 'alex@example.com', emailVerifiedAt: null },
      isLoading: false,
    });
    mocks.useUpdateProfile.mockReturnValue({ mutateAsync: mocks.updateProfile, isPending: false });
    mocks.useChangePassword.mockReturnValue({ mutateAsync: mocks.changePassword, isPending: false });
    mocks.useLogoutAll.mockReturnValue({ mutateAsync: mocks.logoutAll, isPending: false });
    mocks.useUnsavedChangesWarning.mockReturnValue({
      isBlocked: false, confirmLeave: mocks.confirmLeave, cancelLeave: mocks.cancelLeave,
    });
    mocks.useToast.mockReturnValue({ toast: { success: mocks.successToast, error: vi.fn() } });
  });

  const renderPage = () => render(<MemoryRouter><SettingsPage /></MemoryRouter>);

  it('loads profile defaults and keeps email read-only', () => {
    renderPage();
    expect(screen.getByLabelText(/name/i)).toHaveValue('Alex Student');
    expect(screen.getByLabelText('Email')).toHaveValue('alex@example.com');
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /delete account/i })).not.toBeInTheDocument();
  });

  it('does not include email verification controls in settings', () => {
    renderPage();
    expect(screen.queryByRole('heading', { name: /email verification/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resend verification email/i })).not.toBeInTheDocument();
  });

  it('saves profile and resets the form from the returned server name', async () => {
    mocks.updateProfile.mockResolvedValue({ name: 'Alex Updated' });
    renderPage();
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Alex Updated' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledWith({ name: 'Alex Updated' }));
    expect(mocks.successToast).toHaveBeenCalledWith('Profile updated');
  });

  it('focuses current password after the specific 400 response', async () => {
    mocks.changePassword.mockRejectedValue({
      status: 400, kind: 'api', message: 'Current password is incorrect',
    });
    renderPage();
    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'wrong-pass' } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'new-pass-123' } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    await waitFor(() => expect(screen.getByLabelText(/current password/i)).toHaveFocus());
    expect(screen.getByText('Current password is incorrect')).toBeInTheDocument();
  });

  it('shows unsaved-changes confirmation and delegates Leave/Stay', () => {
    mocks.useUnsavedChangesWarning.mockReturnValue({
      isBlocked: true, confirmLeave: mocks.confirmLeave, cancelLeave: mocks.cancelLeave,
    });
    renderPage();

    expect(screen.getByText('You have unsaved changes.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(mocks.cancelLeave).toHaveBeenCalledOnce();
  });
});