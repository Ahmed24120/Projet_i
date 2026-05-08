import React from 'react';

interface ProgressBarProps {
    progress: number; // 0 to 100
    color?: string;
    className?: string;
    showLabel?: boolean;
}

export function ProgressBar({ progress, color = 'bg-blue-600', className = '', showLabel = false }: ProgressBarProps) {
    // Ensure progress is between 0 and 100
    const clampedProgress = Math.min(100, Math.max(0, progress));

    return (
        <div className={`w-full ${className}`}>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                    className={`h-2.5 rounded-full transition-all duration-500 ease-out ${color}`}
                    style={{ width: `${clampedProgress}%` }}
                />
            </div>
            {showLabel && (
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{clampedProgress.toFixed(0)}%</span>
                </div>
            )}
        </div>
    );
}
