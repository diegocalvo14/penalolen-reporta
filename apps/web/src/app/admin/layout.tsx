import ShellMunicipal from '@/components/shared/ShellMunicipal';
import { requerirUsuarioPagina } from '@/server/auth/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requerirUsuarioPagina(['admin'], '/admin');
  return <ShellMunicipal usuario={usuario}>{children}</ShellMunicipal>;
}
