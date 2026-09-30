import { useEffect, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMe } from '@/hooks/auth/useMe';
import { useUpdateProfile } from '@/hooks/auth/useUpdateProfile';
import { useChangePassword } from '@/hooks/auth/useChangePassword';
import { useLogoutAll } from '@/hooks/auth/useLogoutAll';
import { useResendVerification } from '@/hooks/auth/useResendVerification';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { useToast } from '@/hooks/useToast';
import { applyServerErrorToForm, mapApiError, SERVER_MESSAGES } from '@/lib/api/errors';
import { updateProfileSchema, changePasswordSchema, type UpdateProfileInput, type ChangePasswordInput } from '@/schemas/auth.schemas';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import PasswordInput from '@/components/common/PasswordInput';
import SubmitButton from '@/components/common/SubmitButton';
import FormRootError from '@/components/common/FormRootError';
import FullPageLoader from '@/components/layout/FullPageLoader';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

export default function SettingsPage(): React.JSX.Element {
	useDocumentTitle('Settings');
	const meQuery = useMe();
	const updateProfile = useUpdateProfile();
	const changePassword = useChangePassword();
	const logoutAll = useLogoutAll();
	const resendVerification = useResendVerification();
	const { toast } = useToast();
	const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
	const [logoutError, setLogoutError] = useState<string | null>(null);
	const me = meQuery.data;

	const profileForm = useForm<UpdateProfileInput>({
		resolver: zodResolver(updateProfileSchema),
		defaultValues: { name: me?.name ?? '' },
	});
	const passwordForm = useForm<ChangePasswordInput>({
		resolver: zodResolver(changePasswordSchema),
		defaultValues: { currentPassword: '', newPassword: '' },
	});
	const resetProfile = profileForm.reset;

	useEffect(() => {
		if (me?.name !== undefined) {
			resetProfile({ name: me.name });
		}
	}, [me?.name, resetProfile]);

	const blocker = useUnsavedChangesWarning(
		profileForm.formState.isDirty || passwordForm.formState.isDirty
	);

	const saveProfile: SubmitHandler<UpdateProfileInput> = async (values) => {
		try {
			const updatedUser = await updateProfile.mutateAsync(values);
			profileForm.reset({ name: updatedUser.name });
			toast.success('Profile updated');
		} catch (error: unknown) {
			applyServerErrorToForm(error, profileForm);
		}
	};

	const savePassword: SubmitHandler<ChangePasswordInput> = async (values) => {
		try {
			await changePassword.mutateAsync(values);
			passwordForm.reset();
			toast.success('Password changed');
		} catch (error: unknown) {
			const mappedError = applyServerErrorToForm(error, passwordForm, 'changePassword');
			if (mappedError.status === 400 && mappedError.message === SERVER_MESSAGES.currentPasswordIncorrect) {
				passwordForm.setFocus('currentPassword');
			}
		}
	};

	const handleLogoutAll = async () => {
		setLogoutError(null);
		try {
			await logoutAll.mutateAsync();
			setIsLogoutDialogOpen(false);
		} catch (error: unknown) {
			setLogoutError(mapApiError(error).message);
		}
	};

	if (meQuery.isPending) return <FullPageLoader />;

	return (
		<div className="flex flex-col gap-8">
			<h1 tabIndex={-1} className="text-2xl font-semibold tracking-tight text-foreground outline-none">Settings</h1>

			<section aria-labelledby="profile-settings-heading" className="space-y-4 border-b border-border pb-6">
				<h2 id="profile-settings-heading" className="text-lg font-semibold">Profile</h2>
				<form onSubmit={profileForm.handleSubmit(saveProfile)} className="max-w-xl space-y-4" noValidate>
					<div className="space-y-2">
						<Label htmlFor="profile-name">Name</Label>
						<Input id="profile-name" autoComplete="name" {...profileForm.register('name')} />
						{profileForm.formState.errors.name && <p className="text-sm text-destructive">{profileForm.formState.errors.name.message}</p>}
					</div>
					<div className="space-y-2">
						<Label htmlFor="profile-email">Email</Label>
						<Input id="profile-email" type="email" value={me?.email ?? ''} readOnly disabled />
					</div>
					<FormRootError message={profileForm.formState.errors.root?.message} />
					<div className="flex flex-wrap gap-2">
						<SubmitButton isPending={updateProfile.isPending} pendingLabel="Saving…" disabled={!profileForm.formState.isDirty}>
							Save profile
						</SubmitButton>
						<Button type="button" variant="outline" onClick={() => profileForm.reset({ name: me?.name ?? '' })} disabled={!profileForm.formState.isDirty}>
							Cancel
						</Button>
					</div>
				</form>
			</section>

			<section aria-labelledby="password-settings-heading" className="space-y-4 border-b border-border pb-6">
				<h2 id="password-settings-heading" className="text-lg font-semibold">Change password</h2>
				<form onSubmit={passwordForm.handleSubmit(savePassword)} className="max-w-xl space-y-4" noValidate>
					<div className="space-y-2">
						<Label htmlFor="currentPassword">Current password</Label>
						<PasswordInput id="currentPassword" autoComplete="current-password" {...passwordForm.register('currentPassword')} />
						{passwordForm.formState.errors.currentPassword && <p className="text-sm text-destructive">{passwordForm.formState.errors.currentPassword.message}</p>}
					</div>
					<div className="space-y-2">
						<Label htmlFor="newPassword">New password</Label>
						<PasswordInput id="newPassword" autoComplete="new-password" {...passwordForm.register('newPassword')} />
						{passwordForm.formState.errors.newPassword && <p className="text-sm text-destructive">{passwordForm.formState.errors.newPassword.message}</p>}
					</div>
					<FormRootError message={passwordForm.formState.errors.root?.message} />
					<SubmitButton isPending={changePassword.isPending} pendingLabel="Changing password…">
						Change password
					</SubmitButton>
				</form>
			</section>

			<section aria-labelledby="verification-settings-heading" className="space-y-3 border-b border-border pb-6">
				<h2 id="verification-settings-heading" className="text-lg font-semibold">Email verification</h2>
				<p className="text-sm text-muted-foreground">{me?.email}</p>
				{me && !me.emailVerifiedAt && (
					<>
						<Button type="button" variant="outline" onClick={() => void resendVerification.resend(me.email)} disabled={resendVerification.isPending || resendVerification.isCoolingDown}>
							{resendVerification.isPending ? 'Sending…' : resendVerification.isCoolingDown ? `Resend in ${resendVerification.cooldownSecondsLeft}s` : 'Resend verification email'}
						</Button>
						{resendVerification.message && <p role="status" className="text-sm text-primary">{resendVerification.message}</p>}
						{resendVerification.error && <p role="alert" className="text-sm text-destructive">{resendVerification.error.message}</p>}
					</>
				)}
				{me?.emailVerifiedAt && <p className="text-sm text-muted-foreground">Email verified</p>}
			</section>

			<section aria-labelledby="sessions-settings-heading" className="space-y-3">
				<h2 id="sessions-settings-heading" className="text-lg font-semibold">Sessions</h2>
				<p className="text-sm text-muted-foreground">Sign out of all other devices and this session.</p>
				<Button type="button" variant="destructive" onClick={() => setIsLogoutDialogOpen(true)}>
					Log out everywhere
				</Button>
			</section>

			<ConfirmDialog
				open={isLogoutDialogOpen}
				onOpenChange={(open) => {
					setIsLogoutDialogOpen(open);
					if (!open) setLogoutError(null);
				}}
				title="Log out everywhere?"
				description="This will end your session on all devices."
				confirmLabel="Log out everywhere"
				cancelLabel="Stay signed in"
				destructive
				isPending={logoutAll.isPending}
				errorMessage={logoutError}
				onConfirm={() => void handleLogoutAll()}
			/>

			<ConfirmDialog
				open={blocker.isBlocked}
				onOpenChange={(open) => {
					if (!open) blocker.cancelLeave();
				}}
				title="Unsaved changes"
				description="You have unsaved changes."
				confirmLabel="Leave"
				cancelLabel="Stay"
				onConfirm={() => blocker.confirmLeave()}
			/>
		</div>
	);
}
