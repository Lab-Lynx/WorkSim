import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/auth/useMe';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import ErrorPage from '@/components/common/ErrorPage';
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
    <ErrorPage
      embedded
      icon={Compass}
      code="404"
      title="Page not found"
      description="The page you are looking for does not exist or may have moved."
      actions={
        user ? (
          <Button asChild>
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        ) : (
          <Button asChild>
            <Link to="/login">Go to login</Link>
          </Button>
        )
      }
    />
  );

  if (user) {
    return <AppLayout>{content}</AppLayout>;
  }

  return <AuthLayout>{content}</AuthLayout>;
}
