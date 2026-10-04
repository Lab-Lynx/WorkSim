import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { registerSchema, type RegisterInput } from '@/schemas/auth.schemas';
import { useRegister } from '@/hooks/auth/useRegister';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { applyServerErrorToForm } from '@/lib/api/errors';
import { ROUTES } from '@/constants';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PasswordInput from '@/components/common/PasswordInput';
import FormRootError from '@/components/common/FormRootError';
import SubmitButton from '@/components/common/SubmitButton';

export default function RegisterPage(): React.JSX.Element {
  useDocumentTitle('Create account');

  const navigate = useNavigate();
  const register = useRegister();

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

  const onSubmit = async (values: RegisterInput) => {
    try {
      await register.mutateAsync(values);
      navigate(`${ROUTES.VERIFY_EMAIL}?email=${encodeURIComponent(values.email)}`, { replace: true });
    } catch (err: unknown) {
      const ui = applyServerErrorToForm(err, { setError }, 'register');
      if (ui.status === 409) {
        setFocus('email');
      }
    }
  };

  return (
    <div className="flex flex-col">
      <div className="mb-7">
        <h1
          tabIndex={-1}
          className="text-xl font-semibold tracking-tight text-foreground outline-none"
        >
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Please enter your details.</p>
      </div>

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
          className="mt-1 h-10 w-full rounded-lg bg-foreground text-background hover:bg-foreground/90"
        >
          Create account
        </SubmitButton>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          to={ROUTES.LOGIN}
          className="font-semibold text-foreground underline underline-offset-4 hover:text-foreground/80"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
