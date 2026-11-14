// Tomado de Soluciones Barriales (frontend/src/components/shared/Badge.tsx)
import React, { ReactNode } from 'react';

export default function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${className}`}
    >
      {children}
    </span>
  );
}
