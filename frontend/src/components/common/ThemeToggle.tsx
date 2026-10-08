import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  return window.localStorage.getItem('worksim-theme') === 'dark' ? 'dark' : 'light';
}

/** Applies the stored theme on app boot (no UI). */
export function ApplyStoredTheme(): null {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', getInitialTheme());
  }, []);
  return null;
}

type ThemeToggleProps = {
  className?: string;
  collapsed?: boolean;
};

export default function ThemeToggle({
  className,
  collapsed = false,
}: ThemeToggleProps): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('worksim-theme', theme);
  }, [theme]);

  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  const handleToggle = () => {
    if (!document.startViewTransition) {
      setTheme(nextTheme);
      return;
    }

    document.startViewTransition(() => {
      document.documentElement.setAttribute('data-theme', nextTheme);
      flushSync(() => {
        setTheme(nextTheme);
      });
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size={collapsed ? 'icon' : 'default'}
      className={cn(
        'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        !collapsed && 'w-full justify-start gap-3 rounded-2xl px-3',
        collapsed && 'size-8',
        className,
      )}
      onClick={handleToggle}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      {theme === 'dark' ? (
        <Sun className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <Moon className="size-4 shrink-0" aria-hidden="true" />
      )}
      {!collapsed && <span className="text-sm font-medium">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
    </Button>
  );
}
