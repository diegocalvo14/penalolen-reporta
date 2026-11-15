import ShellMunicipal from '@/components/shared/ShellMunicipal';
import { requerirUsuarioPagina } from '@/server/auth/session';

export default async function CopilotoLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requerirUsuarioPagina(['funcionario', 'admin'], '/copiloto');
  return <ShellMunicipal usuario={usuario}>{children}</ShellMunicipal>;
}
