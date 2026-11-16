import turfArea from '@turf/area'
import turfLength from '@turf/length'
import turfCentroid from '@turf/centroid'
import type { Feature, FeatureCollection, Polygon } from 'geojson'

export type LonLat = [number, number]

/** Cierra el anillo si hace falta. */
export function closeRing(ring: LonLat[]): LonLat[] {
  if (ring.length === 0) return ring
  const [a, b] = [ring[0], ring[ring.length - 1]]
  return a[0] === b[0] && a[1] === b[1] ? ring : [...ring, a]
}

export function polygonFromRing(ring: LonLat[]): Polygon {
  return { type: 'Polygon', coordinates: [closeRing(ring)] }
}

/** Área geodésica (m²), perímetro (m) y centroide de un polígono WGS84. Método: Turf (esfera WGS84). */
export function medir(poly: Polygon) {
  const f: Feature<Polygon> = { type: 'Feature', properties: {}, geometry: poly }
  const ring: Feature = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: poly.coordinates[0] } }
  return {
    areaM2: turfArea(f),
    perimetroM: turfLength(ring, { units: 'kilometers' }) * 1000,
    centroide: turfCentroid(f).geometry.coordinates as LonLat,
  }
}

/** Anillo abierto (sin repetir el primer vértice), como lo pide /analizar/area. */
export const openRing = (poly: Polygon): LonLat[] => poly.coordinates[0].slice(0, -1) as LonLat[]

export function formatArea(m2: number, lang: string) {
  const nf = (v: number, d: number) => v.toLocaleString(lang, { maximumFractionDigits: d })
  return m2 >= 10_000 ? `${nf(m2 / 10_000, 2)} ha` : `${nf(m2, 0)} m²`
}

export function formatLen(m: number, lang: string) {
  return m >= 1000 ? `${(m / 1000).toLocaleString(lang, { maximumFractionDigits: 2 })} km` : `${Math.round(m)} m`
}

/* ───────── Lupa de escala: huella de cada fuente alrededor de un punto ───────── */
// Mallas reales donde se conocen; aproximaciones (marcadas) donde no.
// NASA POWER meteorología: malla MERRA-2 0.5° lat × 0.625° lon (celdas centradas en los nodos).
// GPM IMERG: malla 0.1° × 0.1° (bordes múltiplos de 0.1°).
// SMAP L4 (~9 km), MODIS NDVI (250 m), Sentinel-2 (10 m): tamaño real del píxel, posición aproximada.

export type Huella = 'power' | 'imerg' | 'smap' | 'modis' | 's2'

function box(w: number, s: number, e: number, n: number): Polygon {
  return { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] }
}

function boxMeters([lon, lat]: LonLat, sideM: number): Polygon {
  const dLat = sideM / 2 / 111_320
  const dLon = sideM / 2 / (111_320 * Math.cos((lat * Math.PI) / 180))
  return box(lon - dLon, lat - dLat, lon + dLon, lat + dLat)
}

export function huella(kind: Huella, [lon, lat]: LonLat): { poly: Polygon; exacta: boolean } {
  switch (kind) {
    case 'power': {
      const cLat = Math.round(lat / 0.5) * 0.5
      const cLon = Math.round(lon / 0.625) * 0.625
      return { poly: box(cLon - 0.3125, cLat - 0.25, cLon + 0.3125, cLat + 0.25), exacta: true }
    }
    case 'imerg': {
      const w = Math.floor(lon / 0.1) * 0.1
      const s = Math.floor(lat / 0.1) * 0.1
      return { poly: box(w, s, w + 0.1, s + 0.1), exacta: true }
    }
    case 'smap':
      return { poly: boxMeters([lon, lat], 9000), exacta: false }
    case 'modis':
      return { poly: boxMeters([lon, lat], 250), exacta: false }
    case 's2':
      return { poly: boxMeters([lon, lat], 10), exacta: false }
  }
}

export function huellasFC(kinds: Huella[], center: LonLat): FeatureCollection<Polygon> {
  return {
    type: 'FeatureCollection',
    features: kinds.map((k) => ({ type: 'Feature', properties: { kind: k }, geometry: huella(k, center).poly })),
  }
}

/** Cuántas parcelas como esta caben en la celda de NASA POWER (para el texto «una parte en N»). */
export function partesEnCeldaPower(areaM2: number, center: LonLat) {
  const cell = huella('power', center).poly
  const cellM2 = turfArea({ type: 'Feature', properties: {}, geometry: cell })
  return { cellKm2: cellM2 / 1e6, partes: Math.round(cellM2 / Math.max(areaM2, 1)) }
}

/* ───────── Validación del lindero antes de guardar y analizar ───────── */
// Límites prácticos: por debajo de ~20 m² no hay ni un píxel útil; por encima de 5 000 ha el análisis
// dentro de la finca (Sentinel-2 a 10 m) se vuelve demasiado lento para una consulta en vivo.
export const AREA_MIN_M2 = 20
export const AREA_MAX_M2 = 5_000 * 10_000

export type ProblemaLindero = 'pocos' | 'cruzado' | 'pequena' | 'grande'

/** Quita el cierre y los vértices repetidos seguidos (toques dobles, saltos nulos del GPS). */
export function limpiarAnillo(ring: LonLat[]): LonLat[] {
  const EPS = 1e-7 // ~1 cm
  const igual = (a: LonLat, b: LonLat) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS
  const out: LonLat[] = []
  for (const p of ring) if (!out.length || !igual(out[out.length - 1], p)) out.push(p)
  while (out.length > 1 && igual(out[0], out[out.length - 1])) out.pop()
  return out
}

function cruzan(a: LonLat, b: LonLat, c: LonLat, d: LonLat) {
  const o = (p: LonLat, q: LonLat, r: LonLat) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]))
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0
}

/** ¿Algún par de lados no contiguos se cruza? (anillo abierto) */
export function seCruza(ring: LonLat[]) {
  const n = ring.length
  for (let i = 0; i < n; i++) {
    const [a, b] = [ring[i], ring[(i + 1) % n]]
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue // lados vecinos por el cierre
      if (cruzan(a, b, ring[j], ring[(j + 1) % n])) return true
    }
  }
  return false
}

/** Limpia el lindero y dice si se puede guardar. Devuelve el polígono limpio (cerrado). */
export function validarLindero(poly: Polygon): { poly: Polygon; problema?: ProblemaLindero } {
  const anillo = limpiarAnillo(poly.coordinates[0] as LonLat[])
  if (anillo.length < 3) return { poly, problema: 'pocos' }
  const limpio = polygonFromRing(anillo)
  if (seCruza(anillo)) return { poly: limpio, problema: 'cruzado' }
  const m2 = turfArea({ type: 'Feature', properties: {}, geometry: limpio })
  if (m2 < AREA_MIN_M2) return { poly: limpio, problema: 'pequena' }
  if (m2 > AREA_MAX_M2) return { poly: limpio, problema: 'grande' }
  return { poly: limpio }
}
