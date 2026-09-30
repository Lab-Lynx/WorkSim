import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CreditCard, GitBranch, LayoutDashboard, LogOut, Menu, Settings, Sparkles, UserRound } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/github', label: 'Workspace', icon: GitBranch },
  { to: '/billing', label: 'Billing', icon: CreditCard },
  { to: '/profile', label: 'Experience', icon: UserRound },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const isDashboard = pathname === '/' || pathname === '/dashboard';
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className={cn('mx-auto flex min-h-screen w-full', isDashboard ? 'max-w-none' : 'max-w-[1480px]')}>
        <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-sidebar px-5 py-6 transition-transform md:static md:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
          <div className="flex items-center gap-3 px-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><Sparkles className="size-5" /></div>
            <div><p className="text-base font-bold tracking-tight">WorkSim</p><p className="text-xs text-muted-foreground">Your first job, simulated.</p></div>
          </div>
          <div className="mt-10 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace</div>
          <nav className="mt-3 flex flex-col gap-1" aria-label="Main navigation">
            {navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors', isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}><Icon className="size-4" />{label}</NavLink>)}
          </nav>
          <div className="mt-auto rounded-2xl border border-border bg-muted/60 p-4"><p className="text-xs font-semibold text-foreground">Keep your momentum</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Complete tickets to build a portfolio of real work samples.</p></div>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4"><div className="min-w-0"><p className="truncate text-sm font-semibold">{user?.name || 'Developer'}</p><p className="truncate text-xs text-muted-foreground">{user?.email}</p></div><Button variant="ghost" size="icon" onClick={logout} aria-label="Log out"><LogOut className="size-4" /></Button></div>
        </aside>
        {open && <button className="fixed inset-0 z-30 bg-black/20 md:hidden" aria-label="Close navigation" onClick={() => setOpen(false)} />}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/80 bg-background/90 px-5 backdrop-blur md:px-10"><Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu className="size-5" /></Button><div className="hidden md:block"><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Developer workspace</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-emerald-500" /> All systems ready</div></header>
          <main className={cn('mx-auto', isDashboard ? 'w-full max-w-none p-0' : 'max-w-6xl px-5 py-8 md:px-10 md:py-10')}><Outlet /></main>
        </div>
      </div>
    </div>
  );
}
