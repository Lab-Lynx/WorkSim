import React from "react";
import { Outlet } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useFocusPageHeading } from "@/hooks/useFocusPageHeading";

interface AuthLayoutProps {
  children?: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  useFocusPageHeading();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardContent>
          {/* Renders children when passed directly in tests, or Outlet for router context */}
          {children ?? <Outlet />}
        </CardContent>
      </Card>
    </div>
  );
}

export default AuthLayout;