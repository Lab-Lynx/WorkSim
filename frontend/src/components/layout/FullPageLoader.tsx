import React from 'react';

/**
 * FE-060: The only full-page spinner in WorkSim[cite: 7, 8].
 * Used strictly during initial app session restoration / useMe pending state[cite: 8].
 * Normal page-data loading must use skeletons instead[cite: 8].
 */
export default function FullPageLoader(): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background p-6"
      role="status"
      aria-live="polite"
      aria-label="Loading application"
    >
      <div className="w-full max-w-5xl space-y-8">
        <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-64 w-full animate-pulse rounded-xl bg-muted/60" />
          <div className="h-64 w-full animate-pulse rounded-xl bg-muted/60" />
        </div>
        <div className="h-96 w-full animate-pulse rounded-xl bg-muted/60" />
      </div>
    </div>
  );
}
