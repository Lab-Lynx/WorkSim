/* eslint-disable react-refresh/only-export-components */
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPasswordSchema, type ResetPasswordInput } from '@/schemas/auth.schemas';
import { useResetPassword } from '@/hooks/auth/useResetPassword';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { applyServerErrorToForm } from '@/lib/api/errors';
import { ROUTES } from '@/constants';
import { Label } from '@/components/ui/label';
import PasswordInput from '@/components/common/PasswordInput';
import FormRootError from '@/components/common/FormRootError';
import SubmitButton from '@/components/common/SubmitButton';

export default function ResetPasswordPage(): React.JSX.Element {
    useDocumentTitle('Reset password');

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [isTokenInvalid, setIsTokenInvalid] = useState(!token);

    const resetPassword = useResetPassword();

    const {
        register,
        handleSubmit,
        setError,
        formState: { errors },
    } = useForm<ResetPasswordInput>({
        resolver: zodResolver(resetPasswordSchema),
        mode: 'onSubmit',
        reValidateMode: 'onChange',
    });

    const onSubmit = async (values: ResetPasswordInput) => {
        if (!token) {
            setIsTokenInvalid(true);
            return;
        }

        try {
            await resetPassword.mutateAsync({
                token,
                newPassword: values.newPassword,
            });

            navigate(ROUTES.LOGIN, {
                replace: true,
                state: { notice: 'password_reset' },
            });
        } catch (err: unknown) {
            const ui = applyServerErrorToForm(err, { setError });
            if (ui.status === 410 || ui.action === 'request_new_link') {
                setIsTokenInvalid(true);
            }
        }
    };

    if (isTokenInvalid || !token) {
        return (
            <div className="flex flex-col text-center">
                <h1
                    tabIndex={-1}
                    className="text-xl font-semibold tracking-tight text-foreground outline-none mb-2"
                >
                    Invalid or expired link
                </h1>
                <p className="text-sm text-muted-foreground mb-6">
                    This password reset link is invalid or has expired. Please request a new one.
                </p>
                <div>
                    <Link
                        to="/forgot-password"
                        className="text-sm text-primary underline underline-offset-4 hover:text-primary/90"
                    >
                        Request a new link
                    </Link>
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
                Reset password
            </h1>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <Label htmlFor="newPassword">New password</Label>
                    <PasswordInput
                        id="newPassword"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        disabled={resetPassword.isPending}
                        aria-describedby={errors.newPassword ? 'newPassword-error' : undefined}
                        aria-invalid={errors.newPassword ? 'true' : 'false'}
                        {...register('newPassword')}
                    />
                    {errors.newPassword && (
                        <p id="newPassword-error" className="text-xs text-destructive">
                            {errors.newPassword.message}
                        </p>
                    )}
                </div>

                <FormRootError message={errors.root?.message} />

                <SubmitButton
                    isPending={resetPassword.isPending}
                    pendingLabel="Resetting password…"
                    className="w-full mt-2"
                >
                    Reset password
                </SubmitButton>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-4">
                Remembered your password?{' '}
                <Link
                    to={ROUTES.LOGIN}
                    className="text-primary underline underline-offset-4 hover:text-primary/90"
                >
                    Log in
                </Link>
            </p>
        </div>
    );
}