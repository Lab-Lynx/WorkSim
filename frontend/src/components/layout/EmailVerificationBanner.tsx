import React from 'react';
import { useMe } from '../../hooks/auth/useMe';
import { useResendVerification } from '../../hooks/auth/useResendVerification';

export const EmailVerificationBanner: React.FC = () => {
    const { data: user, isLoading } = useMe();
    const { resend, isPending, cooldownSeconds, isCoolingDown, error, message } = useResendVerification();

    if (isLoading || !user || user.emailVerifiedAt) {
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
            className="w-full bg-status-in-progress-bg border-b border-border text-status-in-progress-text px-4 py-2.5 text-sm"
        >
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span>
                        Please verify your email address (<strong className="text-text-heading">{user.email}</strong>) to ensure full account security.
                    </span>
                    {message && <span className="text-primary font-medium ml-2">{message}</span>}
                    {error && <span className="text-destructive font-medium ml-2">{error.message}</span>}
                </div>

                <button
                    type="button"
                    onClick={handleResend}
                    disabled={isPending || isCoolingDown}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary-hover px-3 py-1.5"
                >
                    {isPending
                        ? 'Sending...'
                        : isCoolingDown
                            ? `Resend in ${cooldownSeconds}s`
                            : 'Resend Verification Email'}
                </button>
            </div>
        </div>
    );
};