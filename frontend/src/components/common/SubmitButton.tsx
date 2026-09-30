import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button, type buttonVariants } from '@/components/ui/button';
import type { VariantProps } from 'class-variance-authority';

export interface SubmitButtonProps {
  isPending: boolean;
  pendingLabel: string;
  children: React.ReactNode;
  type?: 'submit' | 'button' | 'reset';
  variant?: VariantProps<typeof buttonVariants>['variant'];
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

export default function SubmitButton({
  isPending,
  pendingLabel,
  children,
  type = 'submit',
  variant,
  disabled = false,
  onClick,
  className,
}: SubmitButtonProps): React.JSX.Element {
  return (
    <Button
      type={type}
      variant={variant}
      disabled={disabled || isPending}
      aria-busy={isPending ? 'true' : 'false'}
      onClick={onClick}
      className={className}
    >
      {isPending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden="true" />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}
