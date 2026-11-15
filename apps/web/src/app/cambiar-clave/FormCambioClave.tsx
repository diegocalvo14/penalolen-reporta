'use client';

import { KeyRound, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/shared/Button';
import { Card, CardContent } from '@/components/shared/Card';
import { PASSWORD_MIN } from '@/domain/admin';

export default function FormCambioClave({ obligatorio, nombre }: { obligatorio: boolean; nombre: string }) {
  const router = useRouter();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (nueva !== repetir) return setError('Las contraseñas nuevas no coinciden.');
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/cambiar-clave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual, nueva }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return setError(data?.error?.message ?? 'No se pudo cambiar la contraseña.');
      router.replace(data.redirectTo);
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  const campo = 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base';
  return (
    <Card>
      <CardContent className="py-6">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
          <KeyRound size={18} /> {obligatorio ? `Hola ${nombre}, crea tu contraseña` : 'Cambiar contraseña'}
        </h1>
        {obligatorio && <p className="mt-1 text-sm text-slate-500">Entraste con una contraseña temporal. Elige una nueva para continuar.</p>}
        <form onSubmit={enviar} className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Contraseña actual
            <input type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} className={campo} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Nueva contraseña <span className="font-normal text-slate-400">(mínimo {PASSWORD_MIN} caracteres)</span>
            <input type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} className={campo} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Repite la nueva contraseña
            <input type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} className={campo} />
          </label>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={enviando || !actual || nueva.length < PASSWORD_MIN}>
            {enviando && <Loader2 size={18} className="animate-spin" />} Guardar contraseña
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
