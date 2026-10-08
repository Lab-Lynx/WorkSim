import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useMe } from '../../hooks/auth/useMe';
import { useResendVerification } from '../../hooks/auth/useResendVerification';

export const EmailVerificationBanner: React.FC = () => {
  const { data: user, isLoading } = useMe();
  const { resend, isPending, cooldownSeconds, isCoolingDown, error, message } =
    useResendVerification();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || !user || user.emailVerifiedAt || dismissed) {
    return null;
  }

  const handleResend = () => {
    if (user.email) {
      resend(user.email);
    }
  };

  return (
    <div
      role="region"
      aria-label="Email Verification"
      className="fixed top-6 right-6 z-50 w-[calc(100%-3rem)] sm:w-auto max-w-md animate-in fade-in slide-in-from-top-6 rounded-xl border border-border bg-sidebar/80 px-4 py-3 text-sm text-muted-foreground backdrop-blur-3xl"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            Please verify your email address (
            <strong className="font-medium text-foreground/80">{user.email}</strong>) to ensure full account
            security.
          </span>
          {message && <span className="text-primary font-medium">{message}</span>}
          {error && <span className="text-destructive font-medium">{error.message}</span>}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleResend}
            disabled={isPending || isCoolingDown}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            {isPending
              ? 'Sending...'
              : isCoolingDown
                ? `Resend in ${cooldownSeconds}s`
                : 'Resend Email'}
          </button>
          
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close notification"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
