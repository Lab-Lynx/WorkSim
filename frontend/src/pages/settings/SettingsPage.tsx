import { useEffect, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Code, MailCheck } from 'lucide-react';
import { useMe } from '@/hooks/auth/useMe';
import { useUpdateProfile } from '@/hooks/auth/useUpdateProfile';
import { useChangePassword } from '@/hooks/auth/useChangePassword';
import { useLogoutAll } from '@/hooks/auth/useLogoutAll';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { useToast } from '@/hooks/useToast';
import { applyServerErrorToForm, mapApiError, SERVER_MESSAGES } from '@/lib/api/errors';
import {
  updateProfileSchema,
  changePasswordSchema,
  type UpdateProfileInput,
  type ChangePasswordInput,
} from '@/schemas/auth.schemas';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import PasswordInput from '@/components/common/PasswordInput';
import SubmitButton from '@/components/common/SubmitButton';
import FormRootError from '@/components/common/FormRootError';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

function initials(name?: string) {
  if (!name) return 'WS';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function SettingsPage(): React.JSX.Element {
  useDocumentTitle('Settings');
  const meQuery = useMe();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const logoutAll = useLogoutAll();
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
    profileForm.formState.isDirty || passwordForm.formState.isDirty,
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
      if (
        mappedError.status === 400 &&
        mappedError.message === SERVER_MESSAGES.currentPasswordIncorrect
      ) {
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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1
          tabIndex={-1}
          className="font-heading text-2xl font-medium tracking-tight text-foreground outline-none"
        >
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your account, integrations, and preferences.
        </p>
      </div>

      {meQuery.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading account details…
        </p>
      )}

      <div className="grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Profile — wide */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="font-heading text-base font-medium">Profile</CardTitle>
            <CardDescription>
              This information is visible on your public experience profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-5 flex items-center gap-4">
              <Avatar fallback={initials(me?.name)} />
            </div>
            <form
              onSubmit={profileForm.handleSubmit(saveProfile)}
              className="space-y-4"
              noValidate
              aria-labelledby="profile-settings-heading"
            >
              <h2 id="profile-settings-heading" className="sr-only">
                Profile
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile-name">Name</Label>
                  <Input id="profile-name" autoComplete="name" {...profileForm.register('name')} />
                  {profileForm.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {profileForm.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-email">Email</Label>
                  <Input id="profile-email" type="email" value={me?.email ?? ''} readOnly disabled />
                  <p className="text-xs text-muted-foreground">
                    Contact support to change your email.
                  </p>
                </div>
              </div>
              <FormRootError message={profileForm.formState.errors.root?.message} />
              <div className="flex flex-wrap gap-2">
                <SubmitButton
                  isPending={updateProfile.isPending}
                  pendingLabel="Saving…"
                  disabled={!profileForm.formState.isDirty}
                >
                  Save profile
                </SubmitButton>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => profileForm.reset({ name: me?.name ?? '' })}
                  disabled={!profileForm.formState.isDirty}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Connections — tall side cell */}
        <Card className="md:row-span-1">
          <CardHeader>
            <CardTitle className="font-heading text-base font-medium">Connections</CardTitle>
            <CardDescription>
              Work Simulator uses GitHub to assign repos and pull your submissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-3">
              <div className="flex items-center gap-3">
                <Code className="size-5 shrink-0" />
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">GitHub</span>
                  <span className="text-xs text-muted-foreground">Manage in GitHub settings</span>
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0 gap-1.5 bg-primary/15 text-primary">
                <span className="size-1.5 rounded-full bg-primary" />
                Connected
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-3">
              <div className="flex items-center gap-3">
                <MailCheck className="size-5 shrink-0" />
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">Email verification</span>
                  <span className="truncate text-xs text-muted-foreground">{me?.email}</span>
                </div>
              </div>
              <Badge
                variant="secondary"
                className={
                  me?.emailVerifiedAt ? 'shrink-0 gap-1.5 bg-primary/15 text-primary' : 'shrink-0 gap-1.5'
                }
              >
                <span
                  className={`size-1.5 rounded-full ${me?.emailVerifiedAt ? 'bg-primary' : 'bg-muted-foreground'}`}
                />
                {me?.emailVerifiedAt ? 'Verified' : 'Unverified'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Password */}
        <Card className="md:col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-heading text-base font-medium">Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={passwordForm.handleSubmit(savePassword)}
              className="space-y-4"
              noValidate
              aria-labelledby="password-settings-heading"
            >
              <h2 id="password-settings-heading" className="sr-only">
                Change password
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current password</Label>
                  <PasswordInput
                    id="currentPassword"
                    autoComplete="current-password"
                    {...passwordForm.register('currentPassword')}
                  />
                  {passwordForm.formState.errors.currentPassword && (
                    <p className="text-sm text-destructive">
                      {passwordForm.formState.errors.currentPassword.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <PasswordInput
                    id="newPassword"
                    autoComplete="new-password"
                    {...passwordForm.register('newPassword')}
                  />
                  {passwordForm.formState.errors.newPassword && (
                    <p className="text-sm text-destructive">
                      {passwordForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>
              </div>
              <FormRootError message={passwordForm.formState.errors.root?.message} />
              <SubmitButton isPending={changePassword.isPending} pendingLabel="Changing password…">
                Change password
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        {/* Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base font-medium">Sessions</CardTitle>
            <CardDescription>Sign out of all other devices and this session.</CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setIsLogoutDialogOpen(true)}
              aria-labelledby="sessions-settings-heading"
            >
              <span id="sessions-settings-heading" className="sr-only">
                Sessions
              </span>
              Log out everywhere
            </Button>
          </CardFooter>
        </Card>
      </div>

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
