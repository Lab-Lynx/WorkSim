import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ROUTES } from '@/constants';
import { Button } from '@/components/ui/button';

export function PublicHeader() {
  const location = useLocation();
  const isHome = location.pathname === ROUTES.HOME;

  const getHref = (hash: string) => isHome ? hash : `${ROUTES.HOME}${hash}`;

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-[#F5F5F5]/90 backdrop-blur-md">
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 lg:px-8"
        aria-label="Main navigation"
      >
        <Link to={ROUTES.HOME} className="flex items-center" aria-label="WorkSim home">
          <img
            src="/logo.png"
            alt="WorkSim"
            className="h-[50px] w-auto object-contain max-sm:h-11"
          />
        </Link>

        <div className="hidden items-center gap-8 text-sm text-neutral-500 md:flex">
          <a href={getHref('#how-it-works')} className="transition-colors hover:text-neutral-950">
            How it Works
          </a>
          <a href={getHref('#pricing')} className="transition-colors hover:text-neutral-950">
            Pricing
          </a>
          <a href={getHref('#features')} className="transition-colors hover:text-neutral-950">
            Features
          </a>
          <a href={getHref('#credentials')} className="transition-colors hover:text-neutral-950">
            Credentials
          </a>
          <Link to={ROUTES.CONTACT} className="transition-colors hover:text-neutral-950">
            Contact Us
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="hidden rounded-full text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-950 sm:inline-flex"
            asChild
          >
            <Link to={ROUTES.LOGIN}>Log in</Link>
          </Button>
          <Button
            size="sm"
            className="rounded-full bg-neutral-950 px-4 text-white hover:bg-neutral-800"
            asChild
          >
            <Link to={ROUTES.REGISTER}>
              Get Started
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
