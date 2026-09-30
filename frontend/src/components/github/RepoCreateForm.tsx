import * as React from 'react';
import { useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { createRepoSchema, type CreateRepoInput } from '@/schemas/github.schemas';
import type { UiError } from '@/lib/api/errors';
import FormRootError from '@/components/common/FormRootError';
import SubmitButton from '@/components/common/SubmitButton';

export interface RepoCreateFormProps {
    onSubmit: (values: CreateRepoInput) => Promise<void>;
    isPending: boolean;
    error: UiError | null;
    blocked: { message: string; linkTo: string; linkLabel: string } | null;
}

const TEMPLATE_OPTIONS = [
    { id: 'react', label: 'React (Vite + TypeScript)' },
    { id: 'node_express', label: 'Node.js (Express + TypeScript)' },
    { id: 'django', label: 'Python (Django)' },
] as const;

export default function RepoCreateForm({
    onSubmit,
    isPending,
    error,
    blocked,
}: RepoCreateFormProps): React.JSX.Element {
    const form = useForm<z.input<typeof createRepoSchema>, unknown, CreateRepoInput>({
        resolver: zodResolver(createRepoSchema),
        defaultValues: {
            starterTemplate: undefined,
            repoName: 'work-simulator',
        },
    });

    const {
        register,
        handleSubmit,
        setFocus,
        formState: { errors },
    } = form;

    useEffect(() => {
        if (error?.status === 409) {
            setFocus('repoName');
        }
    }, [error?.status, setFocus]);

    const submit: SubmitHandler<CreateRepoInput> = async (values) => {
        await onSubmit(values);
    };

    if (blocked) {
        return (
            <div role="status" className="rounded-md border border-border bg-muted/40 p-4 text-sm">
                <span>{blocked.message}</span>{' '}
                {blocked.linkTo.startsWith('#') ? (
                    <a href={blocked.linkTo} className="font-medium text-primary underline">
                        {blocked.linkLabel}
                    </a>
                ) : (
                    <Link to={blocked.linkTo} className="font-medium text-primary underline">
                        {blocked.linkLabel}
                    </Link>
                )}
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit(submit)} className="space-y-6" noValidate>
            <FormRootError message={error?.message || errors.root?.message} />

            <fieldset disabled={isPending} className="space-y-3">
                <legend className="text-sm font-semibold text-foreground">
                    Starter Template <span className="text-destructive">*</span>
                </legend>
                <div className="space-y-2">
                    {TEMPLATE_OPTIONS.map((option) => (
                        <label
                            key={option.id}
                            htmlFor={`template-${option.id}`}
                            className="flex items-center gap-3 rounded-lg border border-input p-3 hover:bg-accent hover:text-accent-foreground cursor-pointer"
                        >
                            <input
                                type="radio"
                                id={`template-${option.id}`}
                                value={option.id}
                                {...register('starterTemplate')}
                                className="h-4 w-4 text-primary border-input focus:ring-primary"
                            />
                            <span className="text-sm font-medium">{option.label}</span>
                        </label>
                    ))}
                </div>
                {errors.starterTemplate?.message && (
                    <p className="text-sm text-destructive font-medium">
                        {errors.starterTemplate.message}
                    </p>
                )}
            </fieldset>

            <div className="space-y-2">
                <label htmlFor="repoName" className="block text-sm font-semibold text-foreground">
                    Repository Name <span className="text-xs text-muted-foreground">(Optional)</span>
                </label>
                <input
                    id="repoName"
                    type="text"
                    disabled={isPending}
                    placeholder="e.g. my-awesome-project"
                    {...register('repoName')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                />
                {errors.repoName?.message && (
                    <p className="text-sm text-destructive font-medium">{errors.repoName.message}</p>
                )}
            </div>

            <SubmitButton isPending={isPending} pendingLabel="Creating repository…" className="w-full">
                Create repository
            </SubmitButton>
        </form>
    );
}