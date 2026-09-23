import { useState, useEffect, useRef } from 'react';
import { Copy, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const COPY_FEEDBACK_MS = 2000;

export interface CopyButtonProps {
    text: string;
    label: string;
}

type CopyStatus = 'idle' | 'success' | 'error';

export function CopyButton({ text, label }: CopyButtonProps) {
    const [status, setStatus] = useState<CopyStatus>('idle');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    const handleCopy = async () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        if (!navigator?.clipboard?.writeText) {
            setStatus('error');
            timerRef.current = setTimeout(() => {
                setStatus('idle');
            }, COPY_FEEDBACK_MS);
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            setStatus('success');
        } catch {
            setStatus('error');
        } finally {
            timerRef.current = setTimeout(() => {
                setStatus('idle');
            }, COPY_FEEDBACK_MS);
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            aria-label={label}
        >
            <div role="status" aria-live="polite" className="sr-only">
                {status === 'success' && 'Copied'}
                {status === 'error' && 'Failed to copy'}
            </div>

            {status === 'success' && (
                <Check className="size-4 text-primary" aria-hidden="true" />
            )}
            {status === 'error' && (
                <X className="size-4 text-destructive" aria-hidden="true" />
            )}
            {status === 'idle' && (
                <Copy className="size-4 text-text-muted" aria-hidden="true" />
            )}
            <span className="ml-1.5">{label}</span>
        </Button>
    );
}