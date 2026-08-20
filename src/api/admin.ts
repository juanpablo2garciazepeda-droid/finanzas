import { api } from './cliente'

/** Metadata de un usuario tal como la lista /admin/usuarios. */
export interface AdminUsuario {
  id: string
  email: string
  displayName: string
  fotoUrl: string | null
  emailVerificado: boolean
  rol: 'usuario' | 'admin'
  idioma: string
  creadoEn: string
  updatedAt: string
}

export interface AdminUsuarioDetalle extends AdminUsuario {
  emailVerificadoEn: string | null
  recibirDigest: boolean
  debeCambiarPassword: boolean
  passwordActualizadoEn: string | null
  tokenVersion: number
}

export interface AdminConteos {
  transacciones: number
  categorias: number
  presupuestos: number
  deudas: number
  metas: number
  recurrentes: number
}

export interface AdminDetalleUsuario {
  usuario: AdminUsuarioDetalle
  conteos: AdminConteos
}

export interface AdminLoteResultado {
  eliminados: string[]
  omitidos: Array<{ id: string; razon: string }>
}

export const adminApi = {
  listar: () => api.get<AdminUsuario[]>('/admin/usuarios'),
  detalle: (id: string) => api.get<AdminDetalleUsuario>(`/admin/usuarios/${id}`),
  eliminar: (id: string) => api.delete<{ ok: true }>(`/admin/usuarios/${id}`),
  eliminarLote: (ids: string[]) =>
    api.post<AdminLoteResultado>('/admin/usuarios/eliminar-lote', { ids }),
  forzarReset: (id: string) =>
    api.post<{ mensaje: string }>(`/admin/usuarios/${id}/forzar-reset`, {}),
  cambiarRol: (id: string, rol: 'usuario' | 'admin') =>
    api.patch<{ ok: true }>(`/admin/usuarios/${id}/rol`, { rol }),
}
