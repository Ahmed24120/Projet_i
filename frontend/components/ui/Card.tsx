import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    hoverEffect?: boolean;
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', hoverEffect = false, padding = 'md' }: CardProps) {
    const paddings = {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
    };

    return (
        <div
            className={`
        bg-white rounded-2xl shadow-sm border border-gray-100
        transition-all duration-300
        ${hoverEffect ? 'hover:shadow-lg hover:-translate-y-1' : ''}
        ${paddings[padding]}
        ${className}
      `}
        >
            {children}
        </div>
    );
}
