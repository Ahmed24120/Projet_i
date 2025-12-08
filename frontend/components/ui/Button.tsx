// frontend/components/ui/Button.tsx
import * as React from 'react';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
};

export function Button({
  isLoading,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={isLoading || disabled}
      className={
        'px-4 py-2 rounded-md border text-sm font-medium ' +
        'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 ' +
        className
      }
    >
      {isLoading ? 'Loading…' : children}
    </button>
  );
}

export default Button;
