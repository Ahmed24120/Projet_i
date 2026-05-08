import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    glass?: boolean;
    hover?: boolean;
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    glass = false,
    hover = false
}) => {
    return (
        <div className={`
      relative rounded-xl border 
      ${glass
                ? 'glass border-white/20'
                : 'bg-white border-border shadow-sm'
            }
      ${hover ? 'transition-transform duration-300 hover:-translate-y-1 hover:shadow-md' : ''}
      ${className}
    `}>
            {children}
        </div>
    );
};
