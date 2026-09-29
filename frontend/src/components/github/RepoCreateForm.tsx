import * as React from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createRepoSchema } from '@/schemas/github.schemas';
import { useCreateRepo } from '@/hooks/github/useCreateRepo';
import { applyServerErrorToForm } from '@/lib/api/errors';
import FormRootError from '@/components/common/FormRootError';
import SubmitButton from '@/components/common/SubmitButton';

export interface RepoCreateFormProps {
    onSuccess?: () => void;
    className?: string;
}

// Extract Zod input type (before preprocess) and output type (after preprocess)
type FormInput = z.input<typeof createRepoSchema>;
type FormOutput = z.output<typeof createRepoSchema>;

const TEMPLATE_OPTIONS = [
    { id: 'react', label: 'React (Vite + TypeScript)' },
    { id: 'node_express', label: 'Node.js (Express + TypeScript)' },
    { id: 'django', label: 'Python (Django)' },
] as const;

export default function RepoCreateForm({
    onSuccess,
    className = '',
}: RepoCreateFormProps): React.JSX.Element {
    const { mutate, isPending } = useCreateRepo();

    // Pass FormInput as input type, context, and FormOutput as output type
    const form = useForm<FormInput, unknown, FormOutput>({
        resolver: zodResolver(createRepoSchema),
        defaultValues: {
            starterTemplate: undefined,
            repoName: '',
        },
    });

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = form;

    // handleSubmit passes parsed/validated FormOutput to onSubmit
    const onSubmit: SubmitHandler<FormOutput> = (data) => {
        mutate(data, {
            onSuccess: () => {
                onSuccess?.();
            },
            onError: (error) => {
                applyServerErrorToForm(error, form);
            },
        });
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className={`space-y-6 ${className}`} noValidate>
            <FormRootError message={errors.root?.message} />

            <fieldset className="space-y-3">
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
                                disabled={isPending}
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

            <SubmitButton isPending={isPending} pendingLabel="Creating..." className="w-full">
                Create Repository
            </SubmitButton>
        </form>
    );
}