import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useSubscription } from '@/hooks/billing/useSubscription';
import {
    CHECKOUT_POLL_INTERVAL_MS,
    CHECKOUT_POLL_MAX_MS,
} from '@/config/app.config';
import { ROUTES } from '@/constants';

export function CheckoutReturnPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');

    const [timedOut, setTimedOut] = useState(false);
    const startTimeRef = useRef<number>(Date.now());

    const { data: subscription, isError } = useSubscription({
        refetchIntervalMs: timedOut ? false : CHECKOUT_POLL_INTERVAL_MS,
    });

    const isSuccess = Boolean(subscription?.hasAccess);

    useEffect(() => {
        if (isSuccess || isError || timedOut) {
            return;
        }

        const interval = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            if (elapsed >= CHECKOUT_POLL_MAX_MS) {
                setTimedOut(true);
                clearInterval(interval);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isSuccess, isError, timedOut]);

    // Missing session ID state
    if (!sessionId) {
        return (
            <div className="container max-w-md mx-auto py-12 px-4">
                <Card className="text-center">
                    <CardHeader>
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                            <AlertCircle className="h-6 w-6" />
                        </div>
                        <CardTitle>Invalid Checkout Session</CardTitle>
                        <CardDescription>
                            No checkout session ID was found in the URL.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="justify-center">
                        <Button onClick={() => navigate(ROUTES.DASHBOARD)}>
                            Return to Dashboard
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    // Active Success state
    if (isSuccess) {
        return (
            <div className="container max-w-md mx-auto py-12 px-4">
                <Card className="text-center">
                    <CardHeader>
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <CardTitle>Subscription Confirmed!</CardTitle>
                        <CardDescription>
                            Thank you for subscribing. Your account has been activated and you now have full access.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="justify-center">
                        <Button onClick={() => navigate(ROUTES.DASHBOARD)}>
                            Go to Dashboard
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    // Error or Timeout state
    if (isError || timedOut) {
        return (
            <div className="container max-w-md mx-auto py-12 px-4">
                <Card className="text-center">
                    <CardHeader>
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-6 w-6" />
                        </div>
                        <CardTitle>
                            {timedOut ? 'Verification Taking Longer Than Expected' : 'Unable to Verify Subscription'}
                        </CardTitle>
                        <CardDescription>
                            {timedOut
                                ? 'We are still processing your payment webhook. Your access will update automatically shortly.'
                                : 'There was an issue verifying your payment status. Please check your billing settings or try again.'}
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                        <Button variant="outline" onClick={() => navigate(ROUTES.DASHBOARD)}>
                            Go to Dashboard
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    // Polling / Loading state
    return (
        <div className="container max-w-md mx-auto py-12 px-4">
            <Card className="text-center">
                <CardHeader>
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                    <CardTitle>Verifying Your Payment</CardTitle>
                    <CardDescription>
                        Please wait while we confirm your subscription details...
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
}

export default CheckoutReturnPage;