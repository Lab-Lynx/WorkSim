import type { JSX } from 'react';

export interface DiffViewerProps {
  diff: string;
}

export function DiffViewer({ diff }: DiffViewerProps): JSX.Element {
  if (!diff) {
    return (
      <div role="region" aria-label="Diff" tabIndex={0} className="overflow-x-auto">
        No changes in this diff.
      </div>
    );
  }

  const lines = diff.replace(/\r/g, '').split('\n');

  return (
    <div
      role="region"
      aria-label="Diff"
      tabIndex={0}
      className="max-w-full overflow-x-auto rounded-md border border-border bg-muted/30 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <pre className="min-w-max text-xs leading-6">
        {lines.map((line, index) => {
          const lineClass = line.startsWith('+++') || line.startsWith('---')
            ? 'text-muted-foreground'
            : line.startsWith('+')
              ? 'bg-primary/10 text-foreground'
              : line.startsWith('-')
                ? 'bg-destructive/10 text-foreground'
                : line.startsWith('@@')
                  ? 'text-primary'
                  : 'text-foreground';

          return (
            <span key={index} className={`block whitespace-pre ${lineClass}`}>
              {line || ' '}
            </span>
          );
        })}
      </pre>
    </div>
  );
}

export default DiffViewer;