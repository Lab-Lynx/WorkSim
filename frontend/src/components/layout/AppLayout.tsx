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
  Layers2,
  X,
} from 'lucide-react';

import { useFocusPageHeading } from '@/hooks/useFocusPageHeading';
import { useCurrentTicket } from '@/hooks/tickets/useCurrentTicket';
import { useLogout } from '@/hooks/auth/useLogout';
import { EmailVerificationBanner } from '@/components/layout/EmailVerificationBanner';
import { SubscriptionBanner } from '@/components/layout/SubscriptionBanner';
import ThemeToggle from '@/components/common/ThemeToggle';
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
  [ROUTES.SUBMISSIONS]: 'Submissions',
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

  const ticketPathMatch = location.pathname.match(/^\/tickets\/([^/]+)/);
  const ticketIdFromPath = ticketPathMatch?.[1];
  const activeTicketId = currentTicket?.id ?? ticketIdFromPath;

  const navItems = [
    { label: 'Dashboard', to: ROUTES.DASHBOARD, icon: LayoutGrid },
    {
      label: 'Current Ticket',
      to: activeTicketId ? `/tickets/${activeTicketId}` : ROUTES.DASHBOARD,
      icon: Ticket,
      ticketNav: true as const,
    },
    { label: 'Submissions', to: ROUTES.SUBMISSIONS, icon: Layers2 },
    { label: 'Experience Profile', to: ROUTES.PROFILE, icon: Award },
    { label: 'GitHub', to: ROUTES.GITHUB, icon: GitBranch },
    { label: 'Billing', to: ROUTES.BILLING, icon: CreditCard },
  ];

  const pageLabel =
    breadcrumbLabels[location.pathname] ??
    (location.pathname.startsWith('/tickets/') ? 'Current Ticket' : 'Workspace');

  const navLinkClass = ({ isActive }: { isActive: boolean }, collapsed = false) =>
    cn(
      'flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-all duration-200 ease-out',
      'hover:bg-white/50 hover:text-sidebar-accent-foreground',
      isActive
        ? 'bg-card text-foreground shadow-sm ring-1 ring-border/60'
        : 'text-sidebar-foreground/80',
      collapsed && 'justify-center px-0',
    );

  const renderWorkspaceNav = (collapsed = false) => (
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
          key={item.label}
          to={item.to}
          end={item.label === 'Dashboard'}
          onClick={closeMobileMenu}
          className={({ isActive }) =>
            navLinkClass(
              {
                isActive: item.ticketNav
                  ? location.pathname.startsWith('/tickets/')
                  : isActive,
              },
              collapsed,
            )
          }
        >
          <item.icon className="size-4 shrink-0" />
          <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );

  const renderAccountFooter = (collapsed = false) => (
    <div className="space-y-1">
      <p
        className={cn(
          'mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground',
          collapsed && 'sr-only',
        )}
      >
        Account
      </p>
      <NavLink
        to={ROUTES.SETTINGS}
        onClick={closeMobileMenu}
        className={(args) => navLinkClass(args, collapsed)}
      >
        <Settings className="size-4 shrink-0" />
        <span className={cn(collapsed && 'sr-only')}>Settings</span>
      </NavLink>
      <ThemeToggle collapsed={collapsed} />
      <button
        type="button"
        className={cn(
          'flex w-full items-center rounded-2xl py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-destructive',
          collapsed ? 'justify-center px-0' : 'justify-start gap-3 px-3',
        )}
        onClick={handleLogout}
        disabled={isLoggingOut}
        aria-label="Log out"
      >
        <LogOut className="size-4 shrink-0" />
        {!collapsed && (isLoggingOut ? 'Logging out...' : 'Log out')}
      </button>
    </div>
  );

  return (
    <div className="flex h-svh flex-col overflow-hidden overscroll-none bg-sidebar text-foreground">
      <div className="z-40 flex w-full shrink-0 flex-col">
        <EmailVerificationBanner />
        <SubscriptionBanner />
      </div>

      {logoutError && (
        <div role="alert" className="shrink-0 bg-destructive/15 p-3 text-center text-sm text-destructive">
          {logoutError}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={cn(
            'hidden min-h-0 shrink-0 flex-col overflow-hidden py-4 text-sidebar-foreground transition-[width] duration-300 ease-out md:flex',
            sidebarCollapsed ? 'w-16 px-2' : 'w-64 px-3',
          )}
        >
          <div
            className={cn(
              'mb-6 flex shrink-0 items-center gap-2 px-2 py-1',
              sidebarCollapsed ? 'flex-col justify-center' : 'justify-between',
            )}
          >
            <div className="flex min-w-0 items-center">
              {sidebarCollapsed ? (
                <img
                  src="/icon.png"
                  alt="WorkSim"
                  className="size-9 object-contain dark:invert"
                />
              ) : (
                <img
                  src="/logo.png"
                  alt="WorkSim"
                  className="h-10 w-auto object-contain object-left dark:invert"
                />
              )}
            </div>
            <button
              type="button"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-transparent">
            {renderWorkspaceNav(sidebarCollapsed)}
          </div>

          <div className="mt-auto shrink-0 pt-4">{renderAccountFooter(sidebarCollapsed)}</div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 md:p-4">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-border/50 animate-in fade-in duration-500">
            <header className="z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border/40 bg-card px-4">
              <button
                type="button"
                onClick={() => setMobileOpen(!mobileOpen)}
                className="inline-flex size-8 items-center justify-center rounded-md border border-border transition-colors duration-200 md:hidden"
                aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              >
                {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              </button>
              <div className="hidden h-4 w-px bg-border md:block" />
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span className="hidden text-muted-foreground sm:inline">Workspace</span>
                <span className="hidden text-muted-foreground sm:inline">/</span>
                <span
                  key={pageLabel}
                  className="truncate font-medium text-foreground animate-in fade-in slide-in-from-bottom-1 duration-300"
                >
                  {pageLabel}
                </span>
              </div>
            </header>

            {mobileOpen && (
              <div
                role="dialog"
                aria-label="Mobile Navigation"
                className="space-y-4 border-b border-border bg-sidebar p-4 animate-in slide-in-from-top-2 fade-in duration-200 md:hidden"
              >
                {renderWorkspaceNav(false)}
                <div className="border-t border-border pt-4">{renderAccountFooter(false)}</div>
              </div>
            )}

            <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-transparent p-4 md:p-8">
              <div
                key={location.pathname}
                className="flex min-h-0 flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-400 fill-mode-both"
              >
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
