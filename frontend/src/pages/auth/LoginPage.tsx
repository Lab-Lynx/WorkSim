import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants';

const LOGIN_NOTICE_MESSAGES: Record<string, string> = {
  session_expired: 'Your session expired. Log in again.',
  password_reset: 'Password reset. Log in with your new password.',
  logged_out_all: "You've been logged out of all devices.",
};

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const location = useLocation();
  const noticeKey = (location.state as { notice?: string } | null)?.notice;
  const noticeMessage = noticeKey ? LOGIN_NOTICE_MESSAGES[noticeKey] : null;

  const { login } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      await login(data);
    } catch {
      setError('root', {
        message: 'Invalid email or password',
      });
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h1 className="text-lg font-semibold mb-4 text-foreground">Sign in</h1>
        {noticeMessage && (
          <div role="status" className="mb-4 rounded-md bg-muted p-3 text-sm text-foreground">
            {noticeMessage}
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-destructive text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <input
              type="password"
              placeholder="Password"
              className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-destructive text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          {errors.root && <p className="text-destructive text-xs">{errors.root.message}</p>}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-4">
          New here?{' '}
          <Link to={ROUTES.REGISTER} className="text-primary underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
