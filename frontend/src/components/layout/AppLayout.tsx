// frontend/src/components/layout/AppLayout.tsx

import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu, LogOut, LayoutDashboard, Ticket, Settings, GitBranch, CreditCard, User } from 'lucide-react';

import { useFocusPageHeading } from '@/hooks/useFocusPageHeading';
import { useCurrentTicket } from '@/hooks/useCurrentTicket';
import { useLogout } from '@/hooks/useLogout';

import { cn } from '@/lib/utils';

interface AppLayoutProps {
    children: React.ReactNode;
}

// Banners defined before AppLayout so they are initialized when AppLayout renders
const EmailVerificationBanner = () => <div data-testid="email-verification-banner" />;
const SubscriptionBanner = () => <div data-testid="subscription-banner" />;

export default function AppLayout({ children }: AppLayoutProps) {
    useFocusPageHeading();

    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [logoutError, setLogoutError] = useState<string | null>(null);

    const { data: currentTicket, isLoading: isTicketLoading } = useCurrentTicket();
    const { mutate: logout, isPending: isLoggingOut } = useLogout();

    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    const handleLogout = () => {
        if (isLoggingOut) return;
        setLogoutError(null);

        logout(undefined, {
            onError: (error: any) => {
                if (error?.status !== 401) {
                    setLogoutError("Couldn't log out. Try again.");
                }
            },
        });
    };

    const navItems = [
        { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
        ...(currentTicket && !isTicketLoading
            ? [{ label: 'Current Ticket', to: `/tickets/${currentTicket.id}`, icon: Ticket }]
            : []),
        { label: 'GitHub Setup', to: '/github', icon: GitBranch },
        { label: 'Billing', to: '/billing', icon: CreditCard },
        { label: 'Profile', to: '/profile', icon: User },
        { label: 'Settings', to: '/settings', icon: Settings },
    ];

    const renderNavLinks = () => (
        <nav className="space-y-1" aria-label="Main navigation">
            {navItems.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                        cn(
                            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                            isActive
                                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                                : 'text-text-body'
                        )
                    }
                >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                </NavLink>
            ))}
        </nav>
    );

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            {/* Top Banners */}
            <div className="flex flex-col w-full z-40">
                <EmailVerificationBanner />
                <SubscriptionBanner />
            </div>

            {/* Logout Error Banner */}
            {logoutError && (
                <div role="alert" className="bg-destructive/15 text-destructive p-3 text-sm text-center">
                    {logoutError}
                </div>
            )}

            <div className="flex flex-1">
                {/* Desktop Sidebar */}
                <aside className="hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground px-4 py-6 justify-between">
                    <div className="space-y-6">
                        <div className="px-3 py-2">
                            <h2 className="text-lg font-bold tracking-tight text-text-heading">WorkSim</h2>
                        </div>
                        {renderNavLinks()}
                    </div>

                    <div className="border-t border-sidebar-border pt-4">
                        <button
                            type="button"
                            className="w-full justify-start text-text-muted hover:text-destructive hover:bg-sidebar-accent flex items-center px-3 py-2 text-sm rounded-md transition-colors"
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            aria-label="Log out"
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            {isLoggingOut ? 'Logging out...' : 'Log out'}
                        </button>
                    </div>
                </aside>

                {/* Mobile Shell */}
                <div className="flex-1 flex flex-col min-w-0">
                    <header className="md:hidden flex items-center justify-between border-b border-border px-4 py-3 bg-surface text-text-heading">
                        <h1 className="text-base font-bold">WorkSim</h1>
                        <button
                            type="button"
                            onClick={() => setMobileOpen(!mobileOpen)}
                            className="p-2 border border-border rounded-md hover:bg-surface-elevated transition-colors"
                            aria-label="Open navigation menu"
                        >
                            <Menu className="h-5 w-5 text-text-body" />
                        </button>
                    </header>

                    {mobileOpen && (
                        <div role="dialog" aria-label="Mobile Navigation" className="md:hidden border-b border-border p-4 bg-surface space-y-4">
                            {renderNavLinks()}
                            <div className="border-t border-border pt-4">
                                <button
                                    type="button"
                                    className="w-full justify-start text-text-muted hover:text-destructive hover:bg-surface-elevated flex items-center px-3 py-2 text-sm rounded-md transition-colors"
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                    aria-label="Log out"
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    {isLoggingOut ? 'Logging out...' : 'Log out'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Main Content Area */}
                    <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto bg-background text-foreground">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}