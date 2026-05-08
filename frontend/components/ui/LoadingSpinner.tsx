import React from 'react';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    color?: 'primary' | 'white';
    className?: string;
}

export function LoadingSpinner({ size = 'md', color = 'primary', className = '' }: LoadingSpinnerProps) {
    const sizes = {
        sm: 'w-5 h-5 border-2',
        md: 'w-8 h-8 border-3',
        lg: 'w-12 h-12 border-4',
    };

    const colors = {
        primary: 'border-blue-600 border-t-transparent',
        white: 'border-white border-t-transparent',
    };

    return (
        <div className={`flex justify-center items-center ${className}`}>
            <div
                className={`
          rounded-full animate-spin
          ${sizes[size]}
          ${colors[color]}
        `}
            />
        </div>
    );
}
