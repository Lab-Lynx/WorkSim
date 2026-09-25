// tests/components/layout/AppLayout.test.tsx

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AppLayout from '@/components/layout/AppLayout';

// Mutable state containers for dynamic mock returns
let logoutState: { mutate: vi.Mock; isPending: boolean };
let currentTicketState: { data: any; isLoading: boolean; isError: boolean; error: any };

const mockLogoutMutate = vi.fn();

// Updated mock paths to match imports in AppLayout.tsx
vi.mock('@/hooks/useLogout', () => ({
    useLogout: () => logoutState,
}));

vi.mock('@/hooks/useCurrentTicket', () => ({
    useCurrentTicket: () => currentTicketState,
}));

describe('AppLayout', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        currentTicketState = {
            data: null,
            isLoading: false,
            isError: false,
            error: null,
        };

        logoutState = {
            mutate: mockLogoutMutate,
            isPending: false,
        };
    });

    it('renders navigation links and main content', () => {
        render(
            <MemoryRouter>
                <AppLayout>
                    <div data-testid="test-content">Test Content</div>
                </AppLayout>
            </MemoryRouter>
        );

        expect(screen.getByTestId('test-content')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    });

    it('shows current-ticket link when a current ticket exists', () => {
        currentTicketState = {
            data: { id: 'ticket-123', code: 'A12' },
            isLoading: false,
            isError: false,
            error: null,
        };

        render(
            <MemoryRouter>
                <AppLayout>
                    <div>Content</div>
                </AppLayout>
            </MemoryRouter>
        );

        expect(screen.getByRole('link', { name: /current ticket/i })).toBeInTheDocument();
    });

    it('invokes useLogout and updates state on logout click', async () => {
        mockLogoutMutate.mockImplementation((_data, options) => {
            options?.onSuccess?.();
        });

        render(
            <MemoryRouter>
                <AppLayout>
                    <div>Content</div>
                </AppLayout>
            </MemoryRouter>
        );

        // Get desktop or mobile logout button
        const logoutButtons = screen.getAllByRole('button', { name: /log out/i });
        fireEvent.click(logoutButtons[0]);

        expect(mockLogoutMutate).toHaveBeenCalled();
    });

    it('shows exact error message when logout mutation fails', async () => {
        mockLogoutMutate.mockImplementation((_data, options) => {
            options?.onError?.({ status: 500, message: 'Server Error' });
        });

        render(
            <MemoryRouter>
                <AppLayout>
                    <div>Content</div>
                </AppLayout>
            </MemoryRouter>
        );

        const logoutButtons = screen.getAllByRole('button', { name: /log out/i });
        fireEvent.click(logoutButtons[0]);

        expect(mockLogoutMutate).toHaveBeenCalled();

        // AppLayout displays an inline role="alert" banner on logout error
        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent("Couldn't log out. Try again.");
        });
    });

    it('closes mobile Sheet drawer on route change / navigation', async () => {
        render(
            <MemoryRouter initialEntries={['/dashboard']}>
                <Routes>
                    <Route
                        path="/dashboard"
                        element={
                            <AppLayout>
                                <div data-testid="dashboard-content">Dashboard Content</div>
                            </AppLayout>
                        }
                    />
                    <Route path="/settings" element={<div>Navigated Target</div>} />
                </Routes>
            </MemoryRouter>
        );

        const openMenuButton = screen.getByRole('button', { name: /open navigation menu/i });
        fireEvent.click(openMenuButton);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();

        // Query exclusively within the mobile drawer dialog to prevent desktop sidebar collision
        const settingsLink = within(dialog).getByRole('link', { name: /settings/i });
        fireEvent.click(settingsLink);

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });
});