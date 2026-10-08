import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGuestLogin, useGuestLoginAvailable } from '@/hooks/auth/useGuestLogin';
import { mapApiError } from '@/lib/api/errors';
import { getSafeRedirectPath } from '@/lib/navigation';
import { ROUTES } from '@/constants';
import SubmitButton from '@/components/common/SubmitButton';

export default function GuestLoginButton(): React.JSX.Element | null {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const availability = useGuestLoginAvailable();
  const guestLogin = useGuestLogin();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  if (!availability.data) {
    return null;
  }

  const handleClick = async () => {
    setErrorMessage(null);
    try {
      await guestLogin.mutateAsync();
      const destination = getSafeRedirectPath(searchParams.get('from'), ROUTES.DASHBOARD);
      navigate(destination, { replace: true });
    } catch (err: unknown) {
      setErrorMessage(mapApiError(err).message);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-3">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <SubmitButton
        type="button"
        variant="outline"
        isPending={guestLogin.isPending}
        pendingLabel="Signing in as guest…"
        onClick={handleClick}
        className="h-10 w-full rounded-lg"
      >
        Continue as guest
      </SubmitButton>

      <p className="text-xs text-muted-foreground">
        Explore with a shared demo account. No sign-up needed.
      </p>

      {errorMessage && (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
