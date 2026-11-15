import Marca from '@/components/shared/Marca';
import LoginForm from './LoginForm';

export const metadata = { title: 'Iniciar sesión · Peñalolén Reporta' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Solo rutas internas (evita redirecciones abiertas a otros sitios)
  const destino = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
  const modoDemo = process.env.DEMO_MODE === 'true';

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-50 via-slate-50 to-white px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Marca subtitulo="Municipalidad de Peñalolén" />
        </div>

        <LoginForm destino={destino} />

        {modoDemo && (
          <details className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold text-slate-700">Usuarios de la demo</summary>
            <p className="mt-2">
              Contraseña de todos: <code className="rounded bg-slate-100 px-1">Demo2026!</code>
            </p>
            <ul className="mt-2 space-y-1">
              <li>Admin: admin@penalolen.demo</li>
              <li>Funcionario DOM: dom@penalolen.demo</li>
              <li>Funcionario DIDECO: dideco@penalolen.demo</li>
              <li>Encargada La Faena: encargada.lafaena@penalolen.demo</li>
              <li>Encargado Lo Hermida: encargado.lohermida@penalolen.demo</li>
              <li>Encargada San Luis: encargada.sanluis@penalolen.demo</li>
            </ul>
          </details>
        )}
      </div>
    </main>
  );
}
