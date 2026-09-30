import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/auth/useMe';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import FullPageLoader from '@/components/layout/FullPageLoader';
import AppLayout from '@/components/layout/AppLayout';
import AuthLayout from '@/components/layout/AuthLayout';

export default function NotFoundPage(): React.JSX.Element {
  useDocumentTitle('Page not found');
  const { data: user, isPending } = useMe();

  if (isPending) {
    return <FullPageLoader />;
  }

  const content = (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h1 tabIndex={-1} className="text-2xl font-semibold text-foreground outline-none">Page not found</h1>
      {user ? (
        <Button asChild><Link to="/dashboard">Go to dashboard</Link></Button>
      ) : (
        <Button asChild><Link to="/login">Go to login</Link></Button>
      )}
    </div>
  );

  if (user) {
    return <AppLayout>{content}</AppLayout>;
  }

  return <AuthLayout>{content}</AuthLayout>;
}
