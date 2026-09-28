import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { useVerifyEmail } from '@/hooks/auth/useVerifyEmail';
import { useResendVerification } from '@/hooks/auth/useResendVerification';
import { useMe } from '@/hooks/auth/useMe';
import { mapApiError } from '@/lib/api/errors';

export function VerifyEmailPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const paramEmail = searchParams.get('email') || '';

    const { data: meUser } = useMe();
    const { mutateAsync: verifyEmail, isPending: isVerifying } = useVerifyEmail();
    const {
        resend,
        isPending: isResending,
        isCoolingDown,
        cooldownSecondsLeft,
        message: resendSuccessMessage,
        error: resendError,
    } = useResendVerification();

    const [emailInput, setEmailInput] = useState('');
    const [verificationSuccess, setVerificationSuccess] = useState(false);
    const [verificationError, setVerificationError] = useState<string | null>(null);

    const verifiedTokenRef = useRef<string | null>(null);

    useEffect(() => {
        const defaultEmail = paramEmail || meUser?.email || '';
        if (defaultEmail && !emailInput) {
            setEmailInput(defaultEmail);
        }
    }, [paramEmail, meUser?.email, emailInput]);

    useEffect(() => {
        if (!token || verifiedTokenRef.current === token) {
            return;
        }

        verifiedTokenRef.current = token;

        verifyEmail({ token })
            .then(() => {
                setVerificationSuccess(true);
                setVerificationError(null);
            })
            .catch((err: unknown) => {
                const message =
                    (err as { message?: string })?.message ||
                    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                    mapApiError(err).message ||
                    'Verification failed or link expired.';

                setVerificationError(message);
                setVerificationSuccess(false);
            });
    }, [token, verifyEmail]);

    const handleResend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!emailInput.trim()) return;
        await resend(emailInput.trim());
    };

    return (
        <div className="space-y-6">
            {token && isVerifying && (
                <div className="flex flex-col items-center justify-center text-center space-y-4 py-6" role="status">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <h1 className="text-xl font-bold text-foreground">Verifying Your Email...</h1>
                    <p className="text-sm text-muted-foreground">Please wait while we confirm your email address.</p>
                </div>
            )}

            {verificationSuccess && (
                <div className="flex flex-col items-center justify-center text-center space-y-4 py-4">
                    <CheckCircle2 className="h-12 w-12 text-primary" />
                    <h1 className="text-2xl font-bold text-foreground">Email Verified</h1>
                    <p className="text-sm text-muted-foreground">
                        Your email address has been verified successfully. You can now access all features.
                    </p>
                    <Button asChild className="w-full mt-4">
                        <Link to="/dashboard">Go to Dashboard</Link>
                    </Button>
                </div>
            )}

            {(!token || verificationError || (!isVerifying && !verificationSuccess)) && (
                <div className="space-y-6">
                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary mb-2">
                            <Mail className="h-6 w-6" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">Verify Your Email</h1>
                        <p className="text-sm text-muted-foreground">
                            We've sent a verification link to your email. Click the link to verify, or request a new link below.
                        </p>
                    </div>

                    {verificationError && (
                        <div className="rounded-lg border border-destructive/50 p-4 text-destructive flex items-start gap-3 bg-destructive/5">
                            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-semibold">Verification Error</p>
                                <p>{verificationError}</p>
                            </div>
                        </div>
                    )}

                    {resendError && (
                        <div className="rounded-lg border border-destructive/50 p-4 text-destructive flex items-start gap-3 bg-destructive/5">
                            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-semibold">Resend Failed</p>
                                <p>{resendError.message}</p>
                            </div>
                        </div>
                    )}

                    {resendSuccessMessage && (
                        <div className="rounded-lg border border-primary/50 p-4 text-primary flex items-start gap-3 bg-primary/5">
                            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-semibold">Success</p>
                                <p>{resendSuccessMessage}</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleResend} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="resend-email">Email Address</Label>
                            <Input
                                id="resend-email"
                                type="email"
                                placeholder="name@example.com"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                required
                                disabled={isResending}
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isResending || isCoolingDown || !emailInput.trim()}
                        >
                            {isResending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : isCoolingDown ? (
                                `Resend in ${cooldownSecondsLeft}s`
                            ) : (
                                'Resend Verification Email'
                            )}
                        </Button>
                    </form>

                    <div className="text-center text-sm text-muted-foreground pt-2">
                        <Link to="/login" className="hover:underline font-medium text-primary">
                            Return to Login
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}

export default VerifyEmailPage;