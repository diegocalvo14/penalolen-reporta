'use client';

import { AlertCircle, Loader2, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import Button from '@/components/shared/Button';
import { Card, CardContent } from '@/components/shared/Card';

export default function LoginForm({ destino }: { destino: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? 'No se pudo iniciar sesión.');
        return;
      }
      router.replace(data.redirectTo === '/cambiar-clave' ? data.redirectTo : (destino ?? data.redirectTo ?? '/'));
      router.refresh();
    } catch {
      setError('No hay conexión con el servidor. Revisa que estés en la red de la demo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <CardContent className="py-6">
        <h1 className="text-lg font-semibold text-slate-800">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-slate-500">Encargados barriales y funcionarios municipales.</p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Correo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-200"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-200"
            />
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={enviando || !email || !password}>
            {enviando ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
