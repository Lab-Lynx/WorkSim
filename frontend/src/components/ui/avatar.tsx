import { cn } from '@/lib/utils';

type AvatarProps = React.ComponentProps<'div'> & {
  fallback: string;
  size?: 'md' | 'lg';
};

export function Avatar({ className, fallback, size = 'md', ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border border-border bg-primary/15 font-medium text-primary',
        size === 'md' && 'size-14 text-base',
        size === 'lg' && 'size-16 text-lg',
        className,
      )}
      aria-hidden
      {...props}
    >
      {fallback}
    </div>
  );
}
