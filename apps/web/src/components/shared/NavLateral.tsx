'use client';

import { BarChart3, Bot, Inbox, Map, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Rol } from '@/db/schema';

const ITEMS = [
  { href: '/panel', label: 'Bandeja', icon: Inbox, roles: ['funcionario', 'admin'] },
  { href: '/panel/mapa', label: 'Mapa', icon: Map, roles: ['funcionario', 'admin'] },
  { href: '/panel/metricas', label: 'Métricas', icon: BarChart3, roles: ['funcionario', 'admin'] },
  { href: '/copiloto', label: 'Copiloto', icon: Bot, roles: ['funcionario', 'admin'] },
  { href: '/admin', label: 'Administración', icon: Settings, roles: ['admin'] },
] as const;

export default function NavLateral({ rol }: { rol: Rol }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => (i.roles as readonly Rol[]).includes(rol));

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Secciones">
      {items.map(({ href, label, icon: Icon }) => {
        const activo = href === '/panel' ? pathname === '/panel' : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activo ? 'bg-navy-50 text-navy-800' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon size={17} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
