import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
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
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function CheckoutReturnPage() {
    useDocumentTitle('Confirming payment');

    const navigate = useNavigate();
    const [timedOut, setTimedOut] = useState(false);
    const { data: subscription, isError, refetch } = useSubscription({
        refetchIntervalMs: timedOut ? false : CHECKOUT_POLL_INTERVAL_MS,
    });

    const isConfirmed =
        subscription?.subscription?.status === 'active' && subscription.hasAccess;

    useEffect(() => {
        if (isConfirmed || (isError && !subscription) || timedOut) {
            return;
        }

        const timeout = setTimeout(() => setTimedOut(true), CHECKOUT_POLL_MAX_MS);

        return () => clearTimeout(timeout);
    }, [isConfirmed, isError, subscription, timedOut]);

    const handleCheckAgain = () => {
        setTimedOut(false);
        void refetch();
    };

    if (isConfirmed) {
        return (
            <div className="container max-w-md mx-auto py-12 px-4">
                <Card className="text-center">
                    <CardHeader>
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <CardTitle>Subscription Confirmed</CardTitle>
                        <CardDescription>
                            Your subscription is active. You can connect GitHub to start setting up your workspace.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex flex-col justify-center gap-3 sm:flex-row">
                        <Button asChild>
                            <Link to={ROUTES.GITHUB}>Connect GitHub</Link>
                        </Button>
                        <Button variant="outline" onClick={() => navigate(ROUTES.DASHBOARD)}>
                            Go to Dashboard
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    if (isError && !subscription) {
        return (
            <div className="container max-w-md mx-auto py-12 px-4">
                <Card className="text-center">
                    <CardHeader>
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                            <AlertCircle className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <CardTitle>Unable to Verify Subscription</CardTitle>
                        <CardDescription>
                            We could not load your subscription status. Try again, or continue to GitHub setup.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex flex-col justify-center gap-3 sm:flex-row">
                        <Button onClick={handleCheckAgain}>Try again</Button>
                        <Button variant="outline" asChild>
                            <Link to={ROUTES.GITHUB}>Connect GitHub</Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    if (timedOut) {
        return (
            <div className="container max-w-md mx-auto py-12 px-4">
                <Card className="text-center">
                    <CardHeader>
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-6 w-6" />
                        </div>
                        <CardTitle>
                            Verification Taking Longer Than Expected
                        </CardTitle>
                        <CardDescription>
                            Your access may take a little longer to update. If you canceled at checkout, no subscription will be activated.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                        <Button onClick={handleCheckAgain}>Check again</Button>
                        <Button variant="outline" asChild>
                            <Link to={ROUTES.GITHUB}>Connect GitHub</Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

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