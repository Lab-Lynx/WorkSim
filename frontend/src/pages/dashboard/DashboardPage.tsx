import { useAuthStore } from '@/store/auth.store';

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">You are signed in as {user?.email}.</p>
    </div>
  );
}
