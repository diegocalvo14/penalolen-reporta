import { CircleHelp, Construction, Lightbulb, Trash2, TreeDeciduous, Zap, type LucideIcon } from 'lucide-react';

const ICONOS: Record<string, LucideIcon> = {
  bache: Construction,
  luminaria: Lightbulb,
  poda: TreeDeciduous,
  escombros: Trash2,
  tendido: Zap,
};

export default function IconoCategoria({ slug, size = 24, className }: { slug: string; size?: number; className?: string }) {
  const Icono = ICONOS[slug] ?? CircleHelp;
  return <Icono size={size} className={className} />;
}
