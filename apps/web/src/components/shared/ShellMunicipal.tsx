import Badge from '@/components/shared/Badge';
import LogoutButton from '@/components/shared/LogoutButton';
import Marca from '@/components/shared/Marca';
import NavLateral from '@/components/shared/NavLateral';
import { ROL_LABEL } from '@/domain/permisos';
import type { UsuarioSesion } from '@/server/auth/session';

/** Estructura común del panel municipal y de la administración (escritorio). */
export default function ShellMunicipal({ usuario, children }: { usuario: UsuarioSesion; children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-4">
          <Marca subtitulo="Panel municipal" />
          <div className="md:hidden">
            <LogoutButton compacto />
          </div>
        </div>
        <div className="px-3 pb-3 md:flex-1">
          <NavLateral rol={usuario.rol} />
        </div>
        <div className="hidden border-t border-slate-100 p-4 md:block">
          <p className="truncate text-sm font-semibold text-slate-800">{usuario.nombre}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge className="bg-navy-50 text-navy-700">{ROL_LABEL[usuario.rol]}</Badge>
            {usuario.unidad && <Badge className="bg-slate-100 text-slate-600">{usuario.unidad}</Badge>}
          </div>
          <div className="mt-3 -ml-3">
            <LogoutButton />
          </div>
        </div>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
