import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface ErrorPageProps {
  icon: LucideIcon;
  title: string;
  description: string;
  code?: string;
  actions?: React.ReactNode;
  /** Render inside an existing layout instead of as a full-screen page. */
  embedded?: boolean;
}

export default function ErrorPage({
  icon: Icon,
  title,
  description,
  code,
  actions,
  embedded = false,
}: ErrorPageProps): React.JSX.Element {
  const Wrapper = embedded ? 'section' : 'main';
  return (
    <Wrapper className={embedded ? 'flex min-h-[50vh] flex-col items-center justify-center gap-6 px-6 py-12 text-center' : 'flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center'}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>
      <div className="max-w-md space-y-2">
        {code && (
          <p className="text-sm font-medium tracking-wide text-muted-foreground">{code}</p>
        )}
        <h1 className="text-balance text-2xl font-semibold text-foreground">{title}</h1>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center justify-center gap-3">{actions}</div>}
    </Wrapper>
  );
}
