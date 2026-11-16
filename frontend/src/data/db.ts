import Dexie, { type EntityTable } from 'dexie'
import type { Polygon } from 'geojson'
import type { AreaResp, PuntoResp } from '../lib/api'

// Base de datos local (IndexedDB). Todo se guarda primero en el dispositivo: la web funciona sin conexión
// y una parcela ya analizada abre al instante. La sincronización con Supabase / Orange Pi llega después.

export type Parcela = {
  id?: number
  nombre: string
  geom: Polygon // WGS84 [lon, lat]
  areaM2: number
  perimetroM: number
  centroide: [number, number] // [lon, lat]
  metodo: 'dibujo' | 'gps'
  creadaEn: string
}

export type AnalisisGuardado = {
  clave: string // 'p:lat,lon' o 'a:<hash del polígono>'
  tipo: 'punto' | 'area'
  datos: PuntoResp | AreaResp
  guardadoEn: string
}

export type Ciclo = {
  id?: number
  parcelaId: number
  cultivoId: string
  variedad?: string
  estado: 'planificado' | 'sembrado' | 'en_desarrollo' | 'cosechado' | 'perdido' | 'cancelado' | 'descanso'
  fechaSiembra?: string
  fechaAproximada?: boolean
  areaSembradaM2?: number
  notas?: string
  fechaCierre?: string // cosecha, pérdida o cancelación
  notaCierre?: string
  creadoEn: string
}

export type Evento = {
  id?: number
  parcelaId: number
  cicloId?: number
  tipo: string
  fecha: string
  datos?: Record<string, unknown>
  registradoEn?: string // cuándo se anotó (puede diferir de la fecha de la actividad)
  editadoEn?: string
  // Reservados para el sello de trazabilidad (se activará más adelante).
  hash?: string
  hashAnterior?: string
}

export const db = new Dexie('groundy') as Dexie & {
  parcelas: EntityTable<Parcela, 'id'>
  analisis: EntityTable<AnalisisGuardado, 'clave'>
  ciclos: EntityTable<Ciclo, 'id'>
  eventos: EntityTable<Evento, 'id'>
}

const ESQUEMA = {
  parcelas: '++id, nombre, creadaEn',
  analisis: 'clave, tipo, guardadoEn',
  ciclos: '++id, parcelaId, estado',
  eventos: '++id, parcelaId, cicloId, fecha',
}
db.version(1).stores(ESQUEMA)
// v2: los registros de prueba hechos con el sello de trazabilidad se descartan una sola vez.
// Las parcelas y los análisis guardados se conservan.
db.version(2)
  .stores(ESQUEMA)
  .upgrade(async (tx) => {
    await tx.table('ciclos').clear()
    await tx.table('eventos').clear()
  })

/** Borra en este dispositivo los registros de cultivo y, si se pide, también las parcelas. */
export const borrarDatosLocales = (incluirParcelas: boolean) =>
  db.transaction('rw', db.ciclos, db.eventos, db.parcelas, async () => {
    await db.eventos.clear()
    await db.ciclos.clear()
    if (incluirParcelas) await db.parcelas.clear()
  })

export const clavePunto = (lat: number, lon: number) => `p:${lat.toFixed(4)},${lon.toFixed(4)}`
export const claveArea = (coords: [number, number][]) =>
  'a:' + coords.map(([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`).join(';')
