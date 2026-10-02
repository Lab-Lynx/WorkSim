/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { loginSchema, type LoginInput } from '@/schemas/auth.schemas';
import { useLogin } from '@/hooks/auth/useLogin';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { applyServerErrorToForm } from '@/lib/api/errors';
import { getSafeRedirectPath } from '@/lib/navigation';
import { ROUTES } from '@/constants';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PasswordInput from '@/components/common/PasswordInput';
import FormRootError from '@/components/common/FormRootError';
import SubmitButton from '@/components/common/SubmitButton';

export const LOGIN_NOTICE_MESSAGES: Record<string, string> = {
  session_expired: 'Your session expired. Log in again.',
  password_reset: 'Password reset. Log in with your new password.',
  logged_out_all: "You've been logged out of all devices.",
};

export default function LoginPage(): React.JSX.Element {
  useDocumentTitle('Log in');

  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const noticeKey = (location.state as { notice?: string } | null)?.notice;
  const noticeMessage = noticeKey ? LOGIN_NOTICE_MESSAGES[noticeKey] : null;

  const login = useLogin();

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    resetField,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const onSubmit = async (values: LoginInput) => {
    try {
      await login.mutateAsync(values);
      const from = searchParams.get('from');
      const destination = getSafeRedirectPath(from, ROUTES.DASHBOARD);
      navigate(destination, { replace: true });
    } catch (err: unknown) {
      const ui = applyServerErrorToForm(err, { setError });
      if (ui.status === 401) {
        resetField('password');
        setFocus('password');
      }
    }
  };

  return (
    <div className="flex flex-col">
      {noticeMessage && (
        <div
          role="status"
          className="mb-4 rounded-md border border-border bg-muted p-3 text-sm font-medium text-foreground"
        >
          {noticeMessage}
        </div>
      )}

      <div className="mb-7">
        <h1
          tabIndex={-1}
          className="text-xl font-semibold tracking-tight text-foreground outline-none"
        >
          Welcome back
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Please enter your details.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="jane@example.com"
            disabled={login.isPending}
            aria-describedby={errors.email ? 'email-error' : undefined}
            aria-invalid={errors.email ? 'true' : 'false'}
            {...register('email')}
          />
          {errors.email && (
            <p id="email-error" className="text-xs text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••"
            disabled={login.isPending}
            aria-describedby={errors.password ? 'password-error' : undefined}
            aria-invalid={errors.password ? 'true' : 'false'}
            {...register('password')}
          />
          {errors.password && (
            <p id="password-error" className="text-xs text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Link
            to={ROUTES.FORGOT_PASSWORD}
            className="text-sm text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            Forgot Password?
          </Link>
        </div>

        <FormRootError message={errors.root?.message} />

        <SubmitButton
          isPending={login.isPending}
          pendingLabel="Logging in…"
          className="mt-1 h-10 w-full rounded-lg bg-foreground text-background hover:bg-foreground/90"
        >
          Log in
        </SubmitButton>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link
          to={ROUTES.REGISTER}
          className="font-semibold text-foreground underline underline-offset-4 hover:text-foreground/80"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
