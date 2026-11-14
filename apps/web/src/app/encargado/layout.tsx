import Campana from '@/components/shared/Campana';
import LogoutButton from '@/components/shared/LogoutButton';
import Marca from '@/components/shared/Marca';
import { requerirUsuarioPagina } from '@/server/auth/session';

/** App del encargado: pensada para celular (botones grandes, máximo 3 pasos). */
export default async function EncargadoLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requerirUsuarioPagina(['encargado'], '/encargado');

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-slate-50">
      <header className="sticky top-0 z-[1100] flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <Marca subtitulo={usuario.territorioNombre ?? 'Sin territorio asignado'} />
        <div className="flex items-center gap-1">
          <Campana prefijoReporte="/encargado/reportes/" />
          <LogoutButton compacto />
        </div>
      </header>
      <main className="flex-1 px-4 py-5">{children}</main>
    </div>
  );
}
