/* eslint-disable react-refresh/only-export-components */
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/schemas/auth.schemas';
import { useForgotPassword } from '@/hooks/auth/useForgotPassword';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { applyServerErrorToForm } from '@/lib/api/errors';
import { ROUTES } from '@/constants';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FormRootError from '@/components/common/FormRootError';
import SubmitButton from '@/components/common/SubmitButton';

export default function ForgotPasswordPage(): React.JSX.Element {
    useDocumentTitle('Forgot Password');

    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const forgotPassword = useForgotPassword();

    const {
        register,
        handleSubmit,
        setError,
        formState: { errors },
    } = useForm<ForgotPasswordInput>({
        resolver: zodResolver(forgotPasswordSchema),
        mode: 'onSubmit',
        reValidateMode: 'onChange',
    });

    const onSubmit = async (values: ForgotPasswordInput) => {
        try {
            const response = await forgotPassword.mutateAsync(values);
            // Success view shows the server message unchanged with no wording hinting if the account exists
            setSuccessMessage(response.message);
        } catch (err: unknown) {
            applyServerErrorToForm(err, { setError });
        }
    };

    return (
        <div className="flex flex-col">
            <h1
                tabIndex={-1}
                className="text-xl font-semibold tracking-tight text-foreground outline-none mb-6"
            >
                Forgot Password
            </h1>

            {successMessage ? (
                <div className="flex flex-col gap-4">
                    <div
                        role="status"
                        className="rounded-md border border-primary/20 bg-primary/10 p-4 text-sm text-primary font-medium"
                    >
                        {successMessage}
                    </div>
                    <div className="text-center mt-2">
                        <Link
                            to={ROUTES.LOGIN}
                            className="text-sm text-primary underline underline-offset-4 hover:text-primary/90"
                        >
                            Back to log in
                        </Link>
                    </div>
                </div>
            ) : (
                <>
                    <p className="text-sm text-muted-foreground mb-4">
                        Enter your email address and we&apos;ll send you a link to reset your password.
                    </p>

                    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                autoComplete="email"
                                placeholder="jane@example.com"
                                disabled={forgotPassword.isPending}
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

                        <FormRootError message={errors.root?.message} />

                        <SubmitButton
                            isPending={forgotPassword.isPending}
                            pendingLabel="Sending reset link…"
                            className="w-full mt-2"
                        >
                            Send reset link
                        </SubmitButton>
                    </form>

                    <div className="text-center mt-4">
                        <Link
                            to={ROUTES.LOGIN}
                            className="text-sm text-primary underline underline-offset-4 hover:text-primary/90"
                        >
                            Back to log in
                        </Link>
                    </div>
                </>
            )}
        </div>
    );
}