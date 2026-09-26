import React from 'react';
import { ExternalLink as ExternalLinkIcon } from 'lucide-react';

export interface ExternalLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

function isValidExternalUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function ExternalLink({ href, children, className }: ExternalLinkProps) {
  const isSafe = isValidExternalUrl(href);

  if (!isSafe) {
    return <span className={className}>{children}</span>;
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
      <ExternalLinkIcon className="ml-1 inline-block size-3.5 align-baseline" aria-hidden="true" />
    </a>
  );
}
