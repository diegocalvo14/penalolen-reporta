'use client';

import { KeyRound, Plus, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import Badge from '@/components/shared/Badge';
import Button from '@/components/shared/Button';
import { ROL_LABEL } from '@/domain/permisos';
import { useAccion } from './useAccion';

type Rol = 'encargado' | 'funcionario' | 'admin';
interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  unidad: 'DOM' | 'DIDECO' | null;
  territorioId: number | null;
  activo: boolean;
  debeCambiarPassword: boolean;
}

export default function AdminUsuarios({
  usuarios,
  territorios,
  yo,
}: {
  usuarios: Usuario[];
  territorios: Array<{ id: number; nombre: string }>;
  yo: string;
}) {
  const { ejecutar, cargando, error } = useAccion();
  const [clave, setClave] = useState<{ email: string; clave: string } | null>(null);
  const [nuevo, setNuevo] = useState<{ nombre: string; email: string; rol: Rol; territorioId: string; unidad: string }>({
    nombre: '',
    email: '',
    rol: 'encargado',
    territorioId: '',
    unidad: '',
  });
  const [formAbierto, setFormAbierto] = useState(false);
  const nombreTerritorio = (id: number | null) => territorios.find((t) => t.id === id)?.nombre ?? '—';
  const sel = 'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm';

  async function crear() {
    const r = await ejecutar<{ email: string; claveTemporal: string }>('/api/admin/usuarios', 'POST', nuevo);
    if (r) {
      setClave({ email: r.email, clave: r.claveTemporal });
      setNuevo({ nombre: '', email: '', rol: 'encargado', territorioId: '', unidad: '' });
      setFormAbierto(false);
    }
  }

  async function editar(u: Usuario, cambios: Record<string, unknown>) {
    const r = await ejecutar<{ claveTemporal: string | null }>(`/api/admin/usuarios/${u.id}`, 'PATCH', cambios);
    if (r?.claveTemporal) setClave({ email: u.email, clave: r.claveTemporal });
  }

  return (
    <div className="space-y-3">
      {clave && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Contraseña temporal para <strong>{clave.email}</strong>: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-base">{clave.clave}</code>
          <p className="text-xs">Entrégala a la persona: al entrar deberá cambiarla. No se volverá a mostrar.</p>
        </div>
      )}
      {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Rol</th>
              <th className="px-4 py-2">Territorio / Unidad</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usuarios.map((u) => (
              <tr key={u.id} className={u.activo ? '' : 'opacity-60'}>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-slate-800">{u.nombre}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </td>
                <td className="px-4 py-2.5">
                  <select
                    aria-label={`Rol de ${u.nombre}`}
                    className={sel}
                    value={u.rol}
                    disabled={cargando || u.id === yo}
                    onChange={(e) => {
                      const rol = e.target.value as Rol;
                      editar(u, {
                        rol,
                        territorioId: rol === 'encargado' ? (u.territorioId ?? territorios[0]?.id) : null,
                        unidad: rol === 'funcionario' ? (u.unidad ?? 'DOM') : null,
                      });
                    }}
                  >
                    {(['encargado', 'funcionario', 'admin'] as const).map((r) => (
                      <option key={r} value={r}>
                        {ROL_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  {u.rol === 'encargado' ? (
                    <select aria-label={`Territorio de ${u.nombre}`} className={sel} value={u.territorioId ?? ''} disabled={cargando} onChange={(e) => editar(u, { territorioId: e.target.value })}>
                      {territorios.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nombre}
                        </option>
                      ))}
                    </select>
                  ) : u.rol === 'funcionario' ? (
                    <select aria-label={`Unidad de ${u.nombre}`} className={sel} value={u.unidad ?? 'DOM'} disabled={cargando} onChange={(e) => editar(u, { unidad: e.target.value })}>
                      <option>DOM</option>
                      <option>DIDECO</option>
                    </select>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                  {u.rol === 'encargado' && u.territorioId === null && <span className="ml-1 text-xs text-red-600">{nombreTerritorio(null)}</span>}
                </td>
                <td className="px-4 py-2.5">
                  {u.activo ? <Badge className="bg-emerald-100 text-emerald-700">Activo</Badge> : <Badge className="bg-slate-200 text-slate-600">Inactivo</Badge>}
                  {u.debeCambiarPassword && <Badge className="ml-1 bg-amber-100 text-amber-800">Clave temporal</Badge>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" disabled={cargando} onClick={() => editar(u, { resetPassword: true })} title="Restablecer contraseña">
                      <KeyRound size={14} />
                    </Button>
                    {u.id !== yo && (
                      <Button size="sm" variant="ghost" disabled={cargando} onClick={() => editar(u, { activo: !u.activo })} title={u.activo ? 'Desactivar' : 'Activar'}>
                        {u.activo ? <UserX size={14} /> : <UserCheck size={14} />}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formAbierto ? (
        <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-5">
          <input placeholder="Nombre" className={sel} value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
          <input placeholder="correo@penalolen.cl" className={sel} value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} />
          <select className={sel} value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value as Rol })}>
            {(['encargado', 'funcionario', 'admin'] as const).map((r) => (
              <option key={r} value={r}>
                {ROL_LABEL[r]}
              </option>
            ))}
          </select>
          {nuevo.rol === 'encargado' ? (
            <select className={sel} value={nuevo.territorioId} onChange={(e) => setNuevo({ ...nuevo, territorioId: e.target.value })}>
              <option value="">Territorio…</option>
              {territorios.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          ) : nuevo.rol === 'funcionario' ? (
            <select className={sel} value={nuevo.unidad} onChange={(e) => setNuevo({ ...nuevo, unidad: e.target.value })}>
              <option value="">Unidad…</option>
              <option>DOM</option>
              <option>DIDECO</option>
            </select>
          ) : (
            <span />
          )}
          <Button size="sm" disabled={cargando || !nuevo.nombre || !nuevo.email} onClick={crear}>
            Crear usuario
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setFormAbierto(true)}>
          <Plus size={14} /> Nuevo usuario
        </Button>
      )}
    </div>
  );
}
