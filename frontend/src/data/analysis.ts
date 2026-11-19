import { useEffect, useRef, useState } from 'react'
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

const UN_DIA_MS = 24 * 60 * 60 * 1000

/**
 * ¿Hay que renovar un análisis guardado? Se usa la vigencia que fija la API (meta.vigencia_hasta).
 * Si no trae vigencia (el servidor no lo guardó en su caché, p. ej. por datos incompletos), se renueva al día siguiente.
 */
function vencido(datos: PuntoResp | AreaResp, guardadoEn: string) {
  const vig = datos.meta?.vigencia_hasta
  if (vig) return Date.parse(vig) < Date.now()
  return Date.now() - Date.parse(guardadoEn) > UN_DIA_MS
}

function pedirYGuardar<T extends PuntoResp | AreaResp>(clave: string, tipo: 'punto' | 'area', pedir: () => Promise<T>, silencioso: boolean): Promise<T> {
  if (enVuelo.has(clave)) return enVuelo.get(clave) as Promise<T>
  const setJob = useJobs.getState().set
  if (!silencioso) setJob(clave, { cargando: true, inicio: Date.now() })
  const p = pedir()
    .then(async (datos) => {
      await db.analisis.put({ clave, tipo, datos, guardadoEn: new Date().toISOString() })
      if (!silencioso) setJob(clave, { cargando: false })
      return datos
    })
    .catch((e: ApiError) => {
      if (!silencioso) setJob(clave, { cargando: false, error: e.kind ?? 'red' })
      throw e
    })
    .finally(() => enVuelo.delete(clave))
  enVuelo.set(clave, p)
  return p
}

async function obtener<T extends PuntoResp | AreaResp>(clave: string, tipo: 'punto' | 'area', pedir: () => Promise<T>): Promise<T> {
  const local = await db.analisis.get(clave)
  if (local) {
    // Se muestra lo guardado al instante (también sin conexión) y, si venció, se renueva en segundo plano.
    if (navigator.onLine && vencido(local.datos, local.guardadoEn)) pedirYGuardar(clave, tipo, pedir, true).catch(() => undefined)
    return local.datos as T
  }
  return pedirYGuardar(clave, tipo, pedir, false)
}

/**
 * Adelanta el análisis de una parcela mientras el agricultor la nombra y confirma (antes de guardarla).
 * Usa las mismas claves que la ficha (centroide de Turf y anillo abierto), así que al abrirla encuentra la consulta
 * en curso (enVuelo) o ya guardada, y el contador de espera sigue desde que empezó aquí.
 */
export function adelantarAnalisis(centro: LonLat, anillo: LonLat[]) {
  const [lon, lat] = centro
  obtener(clavePunto(lat, lon), 'punto', () => analizarPunto(lat, lon)).catch(() => undefined)
  obtener(claveArea(anillo), 'area', () => analizarArea(anillo)).catch(() => undefined)
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

  const claves = useRef('')
  useEffect(() => {
    if (!obj) return
    let vivo = true
    // Al cambiar de lugar se limpia; en un reintento se conserva lo que ya llegó (p. ej. el punto).
    if (claves.current !== kP + '|' + kA) setDatos(null)
    claves.current = kP + '|' + kA
    const [lon, lat] = obj.centro
    // Solo se vuelve a pedir lo que no está guardado: en un reintento, lo que ya llegó sale del dispositivo.
    const pP = obtener(kP, 'punto', () => analizarPunto(lat, lon))
    const pA = obj.tipo === 'area' ? obtener(kA, 'area', () => analizarArea(obj.anillo)).catch(() => undefined) : Promise.resolve(undefined)
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
    // El polígono puede fallar aunque el punto haya llegado: se informa aparte para no ocultarlo.
    errorArea: !datos?.terreno && !jA?.cargando ? jA?.error : undefined,
    reintentar: () => setIntento((i) => i + 1),
  }
}
