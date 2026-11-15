// Tomado de Soluciones Barriales (frontend/src/components/shared/Card.tsx)
import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 border-b border-slate-100 ${className}`}>{children}</div>;
}

export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`px-5 py-3 border-t border-slate-100 bg-slate-50/50 rounded-b-xl ${className}`}>{children}</div>
  );
}
