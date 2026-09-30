import React from 'react';
import { Outlet } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { useFocusPageHeading } from '@/hooks/useFocusPageHeading';

interface AuthLayoutProps {
  children?: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  useFocusPageHeading();

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4 py-8">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardContent className="p-6 sm:p-8">
          {/* Renders children when passed directly in tests, or Outlet for router context */}
          {children ?? <Outlet />}
        </CardContent>
      </Card>
    </div>
  );
}

export default AuthLayout;