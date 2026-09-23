import React from 'react';
import {
  Root,
  Portal,
  Overlay,
  Content,
  Title,
  Description,
  Action,
  Cancel,
} from '@radix-ui/react-alert-dialog';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: (event: React.MouseEvent<HTMLButtonElement>) => void;
  isPending?: boolean;
  errorMessage?: string | null;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  isPending = false,
  errorMessage,
  destructive = false,
}: ConfirmDialogProps) {
  const handleConfirm = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onConfirm(event);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isPending) {
      return;
    }
    onOpenChange(nextOpen);
  };

  return (
    <Root open={open} onOpenChange={handleOpenChange}>
      <Portal>
        <Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Content
          className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-surface p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg"
          onEscapeKeyDown={(e) => {
            if (isPending) {
              e.preventDefault();
            }
          }}
          onPointerDownOutside={(e) => {
            if (isPending) {
              e.preventDefault();
            }
          }}
        >
          <div className="flex flex-col space-y-2 text-center sm:text-left">
            <Title className="text-lg font-semibold text-text-heading">
              {title}
            </Title>
            <Description className="text-sm text-text-muted">
              {description}
            </Description>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/15 p-3 text-sm text-destructive"
            >
              {errorMessage}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <Cancel asChild>
              <Button variant="outline" disabled={isPending}>
                {cancelLabel}
              </Button>
            </Cancel>

            <Action asChild>
              <Button
                variant={destructive ? 'destructive' : 'default'}
                disabled={isPending}
                onClick={handleConfirm}
              >
                {isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                )}
                {confirmLabel}
              </Button>
            </Action>
          </div>
        </Content>
      </Portal>
    </Root>
  );
}