import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { nombreCultivo } from '../i18n/cultivos'
import { db, type Ciclo, type Evento } from './db'
import { getCultivos, type Analisis, type Cultivo, type CultivoTop } from '../lib/api'

/*
 * Registro de la finca, guardado en el dispositivo (IndexedDB):
 *  - Ciclo: una temporada de un cultivo en una parcela (planeada, sembrada, cosechada…).
 *  - Evento: una actividad anotada dentro de la temporada (riego, abono, cosecha…).
 * Todo se puede corregir o borrar. El sello de trazabilidad se activará más adelante.
 */

export const ESTADOS_ACTIVOS: Ciclo['estado'][] = ['planificado', 'sembrado', 'en_desarrollo']
export const esActivo = (c: Ciclo) => ESTADOS_ACTIVOS.includes(c.estado)

export type TipoActividad = 'riego' | 'abono' | 'control' | 'labor' | 'observacion' | 'cosecha'
export const ACTIVIDADES: TipoActividad[] = ['riego', 'abono', 'control', 'labor', 'observacion', 'cosecha']

const ahora = () => new Date().toISOString()

export const hoyISO = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

/* ───────── Temporadas ───────── */
export const crearCiclo = async (c: Omit<Ciclo, 'id' | 'creadoEn'>) => (await db.ciclos.add({ ...c, creadoEn: ahora() })) as number

export const editarCiclo = (id: number, cambios: Partial<Ciclo>) => db.ciclos.update(id, cambios)

export const borrarCiclo = (id: number) =>
  db.transaction('rw', db.ciclos, db.eventos, async () => {
    await db.eventos.where('cicloId').equals(id).delete()
    await db.ciclos.delete(id)
  })

export const marcarSembrado = (c: Ciclo, fecha: string) => db.ciclos.update(c.id!, { estado: 'sembrado', fechaSiembra: fecha })

export const cerrarCiclo = (c: Ciclo, estado: 'cosechado' | 'perdido' | 'cancelado', fecha: string, nota?: string) =>
  db.ciclos.update(c.id!, { estado, fechaCierre: fecha, notaCierre: nota })

/* ───────── Actividades ───────── */
export const anotar = async (e: Omit<Evento, 'id' | 'registradoEn'>) => (await db.eventos.add({ ...e, registradoEn: ahora() })) as number

export const editarEvento = (id: number, cambios: Partial<Evento>) => db.eventos.update(id, { ...cambios, editadoEn: ahora() })

/** Borra una actividad. Si era la cosecha que cerró la temporada, la temporada vuelve a quedar abierta. */
export async function borrarEvento(e: Evento) {
  await db.eventos.delete(e.id!)
  if (e.tipo !== 'cosecha' || e.cicloId === undefined) return
  const c = await db.ciclos.get(e.cicloId)
  const quedan = await db.eventos.where('cicloId').equals(e.cicloId).filter((x) => x.tipo === 'cosecha').count()
  if (c?.estado === 'cosechado' && quedan === 0) await db.ciclos.update(c.id!, { estado: 'sembrado', fechaCierre: undefined })
}

/* ───────── Línea de tiempo: temporadas + actividades en un solo orden ───────── */
export type Entrada = { key: string; tipo: string; fecha: string; ciclo?: Ciclo; evento?: Evento }

export function lineaDeTiempo(ciclos: Ciclo[], eventos: Evento[]): Entrada[] {
  const porId = Object.fromEntries(ciclos.map((c) => [c.id!, c]))
  const out: Entrada[] = []
  for (const c of ciclos) {
    if (c.fechaSiembra) out.push({ key: `c${c.id}`, tipo: c.estado === 'planificado' ? 'ciclo_planeado' : 'siembra', fecha: c.fechaSiembra, ciclo: c })
    if ((c.estado === 'perdido' || c.estado === 'cancelado') && c.fechaCierre)
      out.push({ key: `x${c.id}`, tipo: c.estado === 'perdido' ? 'perdida' : 'cancelado', fecha: c.fechaCierre, ciclo: c })
  }
  for (const e of eventos) out.push({ key: `e${e.id}`, tipo: e.tipo, fecha: e.fecha, ciclo: e.cicloId !== undefined ? porId[e.cicloId] : undefined, evento: e })
  return out.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.key.localeCompare(a.key))
}

/* ───────── Catálogo de cultivos (API /cultivos, en memoria) ───────── */
export function useCatalogo() {
  const [cat, setCat] = useState<Record<string, Cultivo>>({})
  useEffect(() => {
    getCultivos()
      .then((cs) => setCat(Object.fromEntries(cs.map((c) => [c.id, c]))))
      .catch(() => undefined)
  }, [])
  const { i18n } = useTranslation()
  const nombre = (id: string) => nombreCultivo(id, cat[id]?.name_es, i18n.resolvedLanguage)
  return { cat, nombre, lista: Object.values(cat) }
}

/* ───────── Cuánto encaja un cultivo en una parcela ya analizada ───────── */
export const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const indiceMes = (abbr?: string) => (abbr ? MESES_ES.indexOf(abbr.toLowerCase().slice(0, 3)) : -1)

export function ajusteCultivo(a: Analisis | null | undefined, cultivoId: string): CultivoTop | null {
  if (!a || !cultivoId) return null
  const top = a.cultivosTop.find((c) => c.id === cultivoId)
  if (top) return top
  if (cultivoId === 'papa' && a.papa?.suit !== undefined)
    return { id: 'papa', suit: a.papa.suit, best_month: a.papa.best_month_es, limits: a.papa.limiting }
  return null
}

/** Meses de diferencia (circular, 0–6) entre la fecha elegida y el mejor mes. */
export function distanciaMeses(fechaISO: string | undefined, mejor?: string) {
  const m = indiceMes(mejor)
  if (!fechaISO || m < 0) return null
  const elegido = new Date(fechaISO + 'T12:00:00').getMonth()
  const d = Math.abs(elegido - m)
  return Math.min(d, 12 - d)
}

export const diasDesde = (fechaISO?: string) =>
  fechaISO ? Math.round((Date.now() - new Date(fechaISO + 'T12:00:00').getTime()) / 86_400_000) : null
