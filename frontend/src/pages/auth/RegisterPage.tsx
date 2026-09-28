import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { registerSchema, type RegisterInput } from '@/schemas/auth.schemas';
import { useRegister } from '@/hooks/auth/useRegister';
import { useResendVerification } from '@/hooks/auth/useResendVerification';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { applyServerErrorToForm } from '@/lib/api/errors';
import { ROUTES } from '@/constants';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import PasswordInput from '@/components/common/PasswordInput';
import FormRootError from '@/components/common/FormRootError';
import SubmitButton from '@/components/common/SubmitButton';

export default function RegisterPage(): React.JSX.Element {
  useDocumentTitle('Create account');

  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const successHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const register = useRegister();
  const resend = useResendVerification();

  const {
    register: registerField,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  useEffect(() => {
    if (registeredEmail && successHeadingRef.current) {
      successHeadingRef.current.focus();
    }
  }, [registeredEmail]);

  const onSubmit = async (values: RegisterInput) => {
    try {
      await register.mutateAsync(values);
      setRegisteredEmail(values.email);
    } catch (err: unknown) {
      const ui = applyServerErrorToForm(err, { setError }, 'register');
      if (ui.status === 409) {
        setFocus('email');
      }
    }
  };

  const handleResend = () => {
    if (registeredEmail) {
      resend.resend(registeredEmail);
    }
  };

  if (registeredEmail) {
    return (
      <div className="flex flex-col">
        <h1
          ref={successHeadingRef}
          tabIndex={-1}
          className="text-xl font-semibold tracking-tight text-foreground outline-none mb-2"
        >
          Check your email
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          We&apos;ve sent a verification link to{' '}
          <strong className="font-medium text-foreground">{registeredEmail}</strong>. If it
          doesn&apos;t arrive, you can send it again.
        </p>

        {resend.message && (
          <div className="mb-4 rounded-md border border-primary/20 bg-primary/10 p-3 text-sm text-primary font-medium">
            {resend.message}
          </div>
        )}

        {resend.error && (
          <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive font-medium">
            {resend.error.message}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleResend}
            disabled={resend.isPending || resend.isCoolingDown}
            className="w-full"
          >
            {resend.isPending
              ? 'Sending...'
              : resend.isCoolingDown
                ? `Resend in ${resend.cooldownSeconds}s`
                : 'Resend verification email'}
          </Button>
          <Button asChild className="w-full">
            <Link to={ROUTES.DASHBOARD}>Go to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <h1
        tabIndex={-1}
        className="text-xl font-semibold tracking-tight text-foreground outline-none mb-6"
      >
        Create your account
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Jane Doe"
            disabled={register.isPending}
            aria-describedby={errors.name ? 'name-error' : undefined}
            aria-invalid={errors.name ? 'true' : 'false'}
            {...registerField('name')}
          />
          {errors.name && (
            <p id="name-error" className="text-xs text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="jane@example.com"
            disabled={register.isPending}
            aria-describedby={errors.email ? 'email-error' : undefined}
            aria-invalid={errors.email ? 'true' : 'false'}
            {...registerField('email')}
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
            autoComplete="new-password"
            placeholder="••••••••"
            disabled={register.isPending}
            aria-describedby={errors.password ? 'password-error' : 'password-hint'}
            aria-invalid={errors.password ? 'true' : 'false'}
            {...registerField('password')}
          />
          <p id="password-hint" className="text-xs text-muted-foreground">
            At least 8 characters
          </p>
          {errors.password && (
            <p id="password-error" className="text-xs text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        <FormRootError message={errors.root?.message} />

        <SubmitButton
          isPending={register.isPending}
          pendingLabel="Creating account…"
          className="w-full mt-2"
        >
          Create account
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Already have an account?{' '}
        <Link to={ROUTES.LOGIN} className="text-primary underline underline-offset-4 hover:text-primary/90">
          Log in
        </Link>
      </p>
    </div>
  );
}
