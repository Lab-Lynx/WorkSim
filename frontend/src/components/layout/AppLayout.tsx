import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Menu,
  LogOut,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Ticket,
  Settings,
  GitBranch,
  CreditCard,
  Award,
  X,
} from 'lucide-react';

import { useFocusPageHeading } from '@/hooks/useFocusPageHeading';
import { useCurrentTicket } from '@/hooks/useCurrentTicket';
import { useLogout } from '@/hooks/auth/useLogout';
import { EmailVerificationBanner } from '@/components/layout/EmailVerificationBanner';
import { SubscriptionBanner } from '@/components/layout/SubscriptionBanner';
import { ROUTES } from '@/constants';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
}

const breadcrumbLabels: Record<string, string> = {
  [ROUTES.DASHBOARD]: 'Dashboard',
  [ROUTES.BILLING]: 'Billing',
  [ROUTES.BILLING_RETURN]: 'Checkout',
  [ROUTES.GITHUB]: 'GitHub',
  [ROUTES.PROFILE]: 'Experience Profile',
  [ROUTES.SETTINGS]: 'Settings',
};

export default function AppLayout({ children }: AppLayoutProps) {
  useFocusPageHeading();

  const location = useLocation();
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
    { label: 'Dashboard', to: ROUTES.DASHBOARD, icon: LayoutGrid },
    ...(currentTicket && !isTicketLoading && !isTicketError
      ? [{ label: 'Current Ticket', to: `/tickets/${currentTicket.id}`, icon: Ticket }]
      : []),
    { label: 'Experience Profile', to: ROUTES.PROFILE, icon: Award },
    { label: 'GitHub', to: ROUTES.GITHUB, icon: GitBranch },
    { label: 'Billing', to: ROUTES.BILLING, icon: CreditCard },
  ];

  const pageLabel =
    breadcrumbLabels[location.pathname] ??
    (location.pathname.startsWith('/tickets/') ? 'Current Ticket' : 'Workspace');

  const renderNavLinks = (collapsed = false) => (
    <nav className="space-y-1" aria-label="Main navigation">
      <p
        className={cn(
          'mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground',
          collapsed && 'sr-only',
        )}
      >
        Workspace
      </p>
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
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/80',
              collapsed && 'justify-center px-0',
            )
          }
        >
          <item.icon className="size-4 shrink-0" />
          <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
        </NavLink>
      ))}
      <p
        className={cn(
          'mb-2 mt-6 px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground',
          collapsed && 'sr-only',
        )}
      >
        Account
      </p>
      <NavLink
        to={ROUTES.SETTINGS}
        onClick={closeMobileMenu}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            isActive
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/80',
            collapsed && 'justify-center px-0',
          )
        }
      >
        <Settings className="size-4 shrink-0" />
        <span className={cn(collapsed && 'sr-only')}>Settings</span>
      </NavLink>
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="z-40 flex w-full flex-col">
        <EmailVerificationBanner />
        <SubscriptionBanner />
      </div>

      {logoutError && (
        <div role="alert" className="bg-destructive/15 p-3 text-center text-sm text-destructive">
          {logoutError}
        </div>
      )}

      <div className="flex flex-1">
        <aside
          className={cn(
            'hidden shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar py-4 text-sidebar-foreground transition-[width] duration-200 md:flex',
            sidebarCollapsed ? 'w-16 px-2' : 'w-64 px-3',
          )}
        >
          <div className="space-y-6">
            <div
              className={cn(
                'flex items-center gap-2 px-2 py-1',
                sidebarCollapsed ? 'flex-col justify-center' : 'justify-between',
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Ticket className="size-4" />
                </div>
                {!sidebarCollapsed && (
                  <div className="flex min-w-0 flex-col leading-none">
                    <span className="font-heading text-base font-medium tracking-tight">
                      Work Simulator
                    </span>
                    <span className="mt-0.5 text-xs text-muted-foreground">Practitioner Track</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="size-4" />
                ) : (
                  <PanelLeftClose className="size-4" />
                )}
              </button>
            </div>
            {renderNavLinks(sidebarCollapsed)}
          </div>

          <div className="border-t border-sidebar-border pt-3">
            <button
              type="button"
              className={cn(
                'flex w-full items-center rounded-md py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-destructive',
                sidebarCollapsed ? 'justify-center px-0' : 'justify-start px-3',
              )}
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Log out"
            >
              <LogOut className={cn('size-4', !sidebarCollapsed && 'mr-2')} />
              {!sidebarCollapsed && (isLoggingOut ? 'Logging out...' : 'Log out')}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="inline-flex size-8 items-center justify-center rounded-md border border-border md:hidden"
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
            <div className="hidden h-4 w-px bg-border md:block" />
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="hidden text-muted-foreground sm:inline">Workspace</span>
              <span className="hidden text-muted-foreground sm:inline">/</span>
              <span className="truncate font-medium text-foreground">{pageLabel}</span>
            </div>
          </header>

          {mobileOpen && (
            <div
              role="dialog"
              aria-label="Mobile Navigation"
              className="space-y-4 border-b border-border bg-sidebar p-4 md:hidden"
            >
              {renderNavLinks(false)}
              <div className="border-t border-border pt-4">
                <button
                  type="button"
                  className="flex w-full items-center rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-destructive"
                  onClick={() => {
                    closeMobileMenu();
                    handleLogout();
                  }}
                  disabled={isLoggingOut}
                  aria-label="Log out"
                >
                  <LogOut className="mr-2 size-4" />
                  {isLoggingOut ? 'Logging out...' : 'Log out'}
                </button>
              </div>
            </div>
          )}

          <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
