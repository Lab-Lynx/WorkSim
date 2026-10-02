import React from 'react';
import { Outlet } from 'react-router-dom';
import { useFocusPageHeading } from '@/hooks/useFocusPageHeading';

interface AuthLayoutProps {
  children?: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  useFocusPageHeading();

  return (
    <div className="flex h-svh flex-col items-center justify-center overflow-hidden bg-background px-4 py-6">
      <div className="flex w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <div className="hidden w-1/2 flex-col items-center justify-center border-r border-border bg-card p-10 sm:flex">
          <img
            src="/worksim-logo.svg"
            alt=""
            className="h-16 w-auto object-contain dark:invert"
          />
          <span className="mt-4 text-xl font-semibold tracking-tight text-foreground">WorkSim</span>
        </div>

        <div className="flex w-full flex-col justify-between overflow-y-auto scrollbar-transparent p-6 sm:w-1/2 sm:p-8 md:p-10">
          <div className="mb-6 flex items-center justify-center sm:hidden">
            <img
              src="/worksim-logo.svg"
              alt="WorkSim"
              className="h-8 w-auto object-contain dark:invert"
            />
          </div>

          <div className="flex flex-1 flex-col justify-center">
            {children ?? <Outlet />}
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Real tickets. Real practice.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
