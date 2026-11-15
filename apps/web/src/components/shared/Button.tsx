// Tomado de Soluciones Barriales (frontend/src/components/shared/Button.tsx)
import React, { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-navy-700 text-white hover:bg-navy-800 shadow-sm active:shadow-inner',
  secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300',
  destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
  outline: 'bg-transparent border border-navy-700 text-navy-700 hover:bg-navy-50',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 ease-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
