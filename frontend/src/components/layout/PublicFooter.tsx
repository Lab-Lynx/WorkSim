import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants';

export function PublicFooter() {
  const location = useLocation();
  const isHome = location.pathname === ROUTES.HOME;

  const getHref = (hash: string) => isHome ? hash : `${ROUTES.HOME}${hash}`;

  return (
    <footer className="border-t border-neutral-200 px-6 py-8 lg:px-8 bg-[#F5F5F5]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
        <Link to={ROUTES.HOME} className="flex items-center" aria-label="WorkSim home">
          <img src="/logo.png" alt="WorkSim" className="h-[50px] w-auto object-contain" />
        </Link>
        <p>© {new Date().getFullYear()} WorkSim. Practice experience is not employer certification.</p>
        <div className="flex gap-5">
          <Link to={ROUTES.TERMS} className="transition hover:text-neutral-950">
            Terms
          </Link>
          <Link to={ROUTES.PRIVACY} className="transition hover:text-neutral-950">
            Privacy
          </Link>
          <a href={getHref('#credentials')} className="transition hover:text-neutral-950">
            Credentials note
          </a>
          <Link to={ROUTES.LOGIN} className="transition hover:text-neutral-950">
            Log in
          </Link>
        </div>
      </div>
    </footer>
  );
}
