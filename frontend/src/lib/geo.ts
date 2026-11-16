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
