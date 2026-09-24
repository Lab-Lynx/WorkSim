import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PasswordInputProps
  extends Omit<React.ComponentProps<'input'>, 'type'> {
  autoComplete: 'current-password' | 'new-password';
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, autoComplete, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    const togglePasswordVisibility = () => {
      setShowPassword((prev) => !prev);
    };

    const accessibleName = showPassword ? 'Hide password' : 'Show password';

    return (
      <div className="relative flex items-center w-full">
        <input
          type={showPassword ? 'text' : 'password'}
          autoComplete={autoComplete}
          className={cn(
            'w-full rounded-lg border border-input bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            // Suppress browser native reveal/clear icons
            '[&::-ms-reveal]:hidden [&::-ms-clear]:hidden [&::-webkit-credentials-auto-fill-button]:hidden',
            className
          )}
          ref={ref}
          {...props}
        />
        <button
          type="button"
          onClick={togglePasswordVisibility}
          aria-label={accessibleName}
          aria-pressed={showPassword}
          className="absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="sr-only">{accessibleName}</span>
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;