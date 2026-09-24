import React from 'react';

/**
 * FE-060: The only full-page spinner in WorkSim[cite: 7, 8].
 * Used strictly during initial app session restoration / useMe pending state[cite: 8].
 * Normal page-data loading must use skeletons instead[cite: 8].
 */
export default function FullPageLoader(): React.ReactElement {
    return (
        <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background text-foreground"
            role="status"
            aria-live="polite"
            aria-label="Loading application"
        >
            <div className="flex flex-col items-center gap-4">
                {/* Spinner UI primitive using existing theme tokens */}
                <div
                    className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary"
                    aria-hidden="true"
                />
                <span className="text-sm font-medium text-muted-foreground">
                    Loading...
                </span>
            </div>
        </div>
    );
}