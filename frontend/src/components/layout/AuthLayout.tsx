import React from 'react';
import { Outlet } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  CircleArrowUp,
  Map,
  Users,
} from 'lucide-react';
import { useFocusPageHeading } from '@/hooks/useFocusPageHeading';
import { ROUTES } from '@/constants';

interface AuthLayoutProps {
  children?: React.ReactNode;
}

const resourceLinks = [
  {
    title: 'See how WorkSim works',
    description: 'Walk through tickets, PRs, and reviews.',
    href: `${ROUTES.HOME}#how-it-works`,
    Icon: BookOpen,
  },
  {
    title: 'View pricing plans',
    description: 'Choose the track that fits your practice.',
    href: `${ROUTES.HOME}#pricing`,
    Icon: Map,
  },
  {
    title: 'Explore the features',
    description: 'Mentor guidance, evaluation, and profiles.',
    href: `${ROUTES.HOME}#features`,
    Icon: CircleArrowUp,
  },
  {
    title: 'About credentials',
    description: 'Understand what practice experience means.',
    href: `${ROUTES.HOME}#credentials`,
    Icon: Users,
  },
] as const;

export function AuthLayout({ children }: AuthLayoutProps) {
  useFocusPageHeading();

  return (
    <div className="flex h-svh flex-col items-center justify-center overflow-hidden bg-background px-4 py-5">
      <div className="flex h-full max-h-[640px] w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
        {/* Form panel */}
        <div className="flex w-full flex-col overflow-y-auto scrollbar-transparent bg-card p-5 sm:w-1/2 sm:p-7 md:p-8">
          <div className="mb-6 flex justify-center">
            <img
              src="/logo.png"
              alt="WorkSim"
              className="h-12 w-auto object-contain dark:invert sm:h-14"
            />
          </div>

          <div className="flex flex-1 flex-col justify-center">{children ?? <Outlet />}</div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Real tickets. Real practice.
          </p>
        </div>

        {/* Info panel */}
        <div className="relative hidden w-1/2 flex-col justify-center overflow-hidden bg-neutral-950 px-7 py-8 text-white sm:flex md:px-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-24 size-56 rounded-full bg-white/10 blur-3xl"
          />
          <nav aria-label="Helpful links" className="relative z-10">
            <ul className="divide-y divide-white/10">
              {resourceLinks.map(({ title, description, href, Icon }) => (
                <li key={title}>
                  <a
                    href={href}
                    className="group flex items-center gap-3.5 py-4 transition-colors hover:bg-white/[0.03]"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/80">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-white">{title}</span>
                      <span className="mt-0.5 block text-xs text-white/50">{description}</span>
                    </span>
                    <ArrowUpRight
                      className="size-4 shrink-0 text-white/40 transition-colors group-hover:text-white/80"
                      aria-hidden
                    />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
