'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LogoutButton({ compacto = false }: { compacto?: boolean }) {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={salir}
      disabled={saliendo}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
      aria-label="Cerrar sesión"
    >
      <LogOut size={16} />
      {!compacto && <span>{saliendo ? 'Saliendo…' : 'Salir'}</span>}
    </button>
  );
}
