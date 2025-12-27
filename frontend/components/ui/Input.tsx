// frontend/components/ui/Input.tsx
import * as React from 'react';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      {...props}
      className={
        'border rounded-md px-3 py-2 text-sm w-full ' +
        'focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
        className
      }
    />
  );
}

export default Input;
