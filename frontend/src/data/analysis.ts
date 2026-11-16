import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { analizarArea, analizarPunto, unificar, type Analisis, type ApiError, type AreaResp, type PuntoResp } from '../lib/api'
import { claveArea, clavePunto, db } from './db'
import type { LonLat } from '../lib/geo'

// Análisis caché-first en el dispositivo: si ya existe en IndexedDB se muestra al instante (y sin conexión);
// si no, se pide a la API en segundo plano. Una consulta nueva puede tardar ~100 s (satélites en vivo).

type Estado = { cargando: boolean; error?: ApiError['kind']; inicio?: number }
const useJobs = create<{ jobs: Record<string, Estado>; set: (k: string, e: Estado) => void }>((set) => ({
  jobs: {},
  set: (k, e) => set((s) => ({ jobs: { ...s.jobs, [k]: e } })),
}))

const enVuelo = new Map<string, Promise<unknown>>()

async function obtener<T extends PuntoResp | AreaResp>(
  clave: string,
  tipo: 'punto' | 'area',
  pedir: () => Promise<T>,
  forzar = false,
): Promise<T> {
  if (!forzar) {
    const local = await db.analisis.get(clave)
    if (local) return local.datos as T
  }
  if (enVuelo.has(clave)) return enVuelo.get(clave) as Promise<T>
  const setJob = useJobs.getState().set
  setJob(clave, { cargando: true, inicio: Date.now() })
  const p = pedir()
    .then(async (datos) => {
      await db.analisis.put({ clave, tipo, datos, guardadoEn: new Date().toISOString() })
      setJob(clave, { cargando: false })
      return datos
    })
    .catch((e: ApiError) => {
      setJob(clave, { cargando: false, error: e.kind ?? 'red' })
      throw e
    })
    .finally(() => enVuelo.delete(clave))
  enVuelo.set(clave, p)
  return p
}

export type Objetivo = { tipo: 'punto'; centro: LonLat } | { tipo: 'area'; centro: LonLat; anillo: LonLat[] }

/**
 * Hook: analiza un punto (Explorar) o una parcela (punto en el centroide + polígono en paralelo).
 * Devuelve el análisis unificado, el estado de carga y el error si lo hubo.
 */
export function useAnalisis(obj: Objetivo | null) {
  const [datos, setDatos] = useState<Analisis | null>(null)
  const [intento, setIntento] = useState(0)
  const kP = obj ? clavePunto(obj.centro[1], obj.centro[0]) : ''
  const kA = obj?.tipo === 'area' ? claveArea(obj.anillo) : ''
  const jobs = useJobs((s) => s.jobs)
  const jP = jobs[kP]
  const jA = kA ? jobs[kA] : undefined

  useEffect(() => {
    if (!obj) return
    let vivo = true
    setDatos(null)
    const [lon, lat] = obj.centro
    const forzar = intento > 0
    const pP = obtener(kP, 'punto', () => analizarPunto(lat, lon), forzar)
    const pA = obj.tipo === 'area' ? obtener(kA, 'area', () => analizarArea(obj.anillo), forzar).catch(() => undefined) : Promise.resolve(undefined)
    pP.then(async (p) => {
      if (!vivo) return
      setDatos(unificar(p)) // mostrar el punto en cuanto llegue
      const a = await pA
      if (vivo && a) setDatos(unificar(p, a))
    }).catch(() => undefined)
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kP, kA, intento])

  return {
    datos,
    cargando: !!jP?.cargando || !!jA?.cargando,
    cargandoArea: !!jA?.cargando,
    inicio: jP?.inicio ?? jA?.inicio,
    error: !datos ? jP?.error : undefined,
    reintentar: () => setIntento((i) => i + 1),
  }
}
