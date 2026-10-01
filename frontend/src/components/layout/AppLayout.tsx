// frontend/src/components/layout/AppLayout.tsx

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Menu,
  LogOut,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Ticket,
  Settings,
  GitBranch,
  CreditCard,
  User,
} from 'lucide-react';

import { useFocusPageHeading } from '@/hooks/useFocusPageHeading';
import { useCurrentTicket } from '@/hooks/useCurrentTicket';
import { useLogout } from '@/hooks/auth/useLogout';
import { EmailVerificationBanner } from '@/components/layout/EmailVerificationBanner';
import { SubscriptionBanner } from '@/components/layout/SubscriptionBanner';

import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  useFocusPageHeading();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const {
    data: currentTicket,
    isLoading: isTicketLoading,
    isError: isTicketError,
  } = useCurrentTicket();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  const closeMobileMenu = () => setMobileOpen(false);

  const handleLogout = () => {
    if (isLoggingOut) return;
    setLogoutError(null);

    logout(undefined, {
      onError: (error: unknown) => {
        const status =
          typeof error === 'object' && error !== null && 'status' in error
            ? (error as { status?: number }).status
            : undefined;

        if (status !== 401) {
          setLogoutError("Couldn't log out. Try again.");
        }
      },
    });
  };

  const navItems = [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    ...(currentTicket && !isTicketLoading && !isTicketError
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
          onClick={closeMobileMenu}
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
          <span className={cn(sidebarCollapsed && 'md:sr-only')}>{item.label}</span>
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
        <aside className={cn('hidden md:flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground py-6 justify-between transition-[width] duration-200', sidebarCollapsed ? 'w-16 px-2' : 'w-64 px-4')}>
          <div className="space-y-6">
            <div className={cn('flex items-center py-2', sidebarCollapsed ? 'flex-col justify-center gap-3' : 'justify-between px-3')}>
              <div className="flex min-w-0 items-center gap-2">
                <img
                  src="/worksim-logo.svg"
                  alt={sidebarCollapsed ? 'WorkSim' : ''}
                  className="h-9 w-auto shrink-0 object-contain dark:invert"
                />
                {!sidebarCollapsed && <h2 className="text-lg font-bold tracking-tight text-text-heading">WorkSim</h2>}
              </div>
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
              </button>
            </div>
            {renderNavLinks()}
          </div>

          <div className="border-t border-sidebar-border pt-4">
            <button
              type="button"
              className={cn('w-full text-text-muted hover:text-destructive hover:bg-sidebar-accent flex items-center py-2 text-sm rounded-md transition-colors', sidebarCollapsed ? 'justify-center px-0' : 'justify-start px-3')}
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Log out"
            >
              <LogOut className={cn('h-4 w-4', !sidebarCollapsed && 'mr-2')} />
              {!sidebarCollapsed && (isLoggingOut ? 'Logging out...' : 'Log out')}
            </button>
          </div>
        </aside>

        {/* Mobile Shell */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="md:hidden flex items-center justify-between border-b border-border px-4 py-3 bg-surface text-text-heading">
            <div className="flex items-center gap-2">
              <img src="/worksim-logo.svg" alt="" className="h-8 w-auto object-contain dark:invert" />
              <h1 className="text-base font-bold">WorkSim</h1>
            </div>
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
            <div
              role="dialog"
              aria-label="Mobile Navigation"
              className="md:hidden border-b border-border p-4 bg-surface space-y-4"
            >
              {renderNavLinks()}
              <div className="border-t border-border pt-4">
                <button
                  type="button"
                  className="w-full justify-start text-text-muted hover:text-destructive hover:bg-surface-elevated flex items-center px-3 py-2 text-sm rounded-md transition-colors"
                  onClick={() => {
                    closeMobileMenu();
                    handleLogout();
                  }}
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
