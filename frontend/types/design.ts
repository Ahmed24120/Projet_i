export type ColorVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
export type SizeVariant = 'sm' | 'md' | 'lg' | 'xl';
export type AnimationType = 'float' | 'shimmer' | 'pulse' | 'fade-in';

export interface BaseComponentProps {
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}
