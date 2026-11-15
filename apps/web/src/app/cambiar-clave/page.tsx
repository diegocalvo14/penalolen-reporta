import { redirect } from 'next/navigation';
import Marca from '@/components/shared/Marca';
import { obtenerUsuarioActual } from '@/server/auth/session';
import FormCambioClave from './FormCambioClave';

export const metadata = { title: 'Cambiar contraseña · Peñalolén Reporta' };

/** RF-1.4: cambio de contraseña (obligatorio en el primer ingreso con contraseña temporal). */
export default async function CambiarClave() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect('/login?next=/cambiar-clave');
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Marca subtitulo="Municipalidad de Peñalolén" />
        </div>
        <FormCambioClave obligatorio={usuario.debeCambiarPassword} nombre={usuario.nombre.split(' ')[0]} />
      </div>
    </main>
  );
}
