import ShellMunicipal from '@/components/shared/ShellMunicipal';
import { requerirUsuarioPagina } from '@/server/auth/session';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requerirUsuarioPagina(['funcionario', 'admin'], '/panel');
  return <ShellMunicipal usuario={usuario}>{children}</ShellMunicipal>;
}
