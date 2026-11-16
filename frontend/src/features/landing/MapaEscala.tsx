import { useEffect, useLayoutEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, LngLatBoundsLike, Map as MLMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { Feature, FeatureCollection } from 'geojson'

maplibregl.setWorkerUrl(workerUrl)

export type ClaveEscala = 's2' | 'plot' | 'modis' | 'smap' | 'imerg' | 'power'

/**
 * Mapa real de la lupa de escala: imagen satelital de una finca en Ipiales (Nariño) con la cuadrícula de la fuente
 * elegida dibujada a su tamaño verdadero. La cámara vuela de los 10 m de Sentinel-2 a la celda de ~55 × 69 km de POWER.
 * Las cuadrículas se centran en la parcela: muestran el tamaño de cada celda, no la malla oficial de cada producto.
 */
const CENTRO: [number, number] = [-77.62, 0.86]
const M_LAT = 110_574
const M_LON = 111_320 * Math.cos((CENTRO[1] * Math.PI) / 180)

/** Ancho × alto de una celda en metros y cuántas celdas por lado se dibujan alrededor de la parcela. */
const CELDA: Record<Exclude<ClaveEscala, 'plot'>, { w: number; h: number; n: number }> = {
  s2: { w: 10, h: 10, n: 27 },
  modis: { w: 250, h: 250, n: 7 },
  smap: { w: 9000, h: 9000, n: 5 },
  imerg: { w: 10_000, h: 10_000, n: 5 },
  power: { w: 69_000, h: 55_000, n: 3 },
}

const lon = (dx: number) => CENTRO[0] + dx / M_LON
const lat = (dy: number) => CENTRO[1] + dy / M_LAT

// Una parcela de ~3 ha, un poco irregular como un lote real.
const PARCELA: [number, number][] = [
  [lon(-92), lat(-86)],
  [lon(88), lat(-94)],
  [lon(95), lat(84)],
  [lon(-84), lat(92)],
  [lon(-92), lat(-86)],
]

function caja(w: number, h: number): [number, number][] {
  return [
    [lon(-w / 2), lat(-h / 2)],
    [lon(w / 2), lat(-h / 2)],
    [lon(w / 2), lat(h / 2)],
    [lon(-w / 2), lat(h / 2)],
    [lon(-w / 2), lat(-h / 2)],
  ]
}

function rejilla(k: ClaveEscala): FeatureCollection {
  if (k === 'plot') return { type: 'FeatureCollection', features: [] }
  const { w, h, n } = CELDA[k]
  const mitad = n / 2
  const features: Feature[] = []
  for (let i = 0; i <= n; i++) {
    const x = (i - mitad) * w
    const y = (i - mitad) * h
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[lon(x), lat(-mitad * h)], [lon(x), lat(mitad * h)]] } })
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[lon(-mitad * w), lat(y)], [lon(mitad * w), lat(y)]] } })
  }
  return { type: 'FeatureCollection', features }
}

function celdaCentral(k: ClaveEscala): FeatureCollection {
  if (k === 'plot') return { type: 'FeatureCollection', features: [] }
  const { w, h } = CELDA[k]
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [caja(w, h)] } }] }
}

/** Qué encuadrar: con Sentinel-2 y la parcela se ve el lote; con las demás, la celda que lo contiene y sus vecinas. */
function encuadre(k: ClaveEscala): LngLatBoundsLike {
  const [w, h] = k === 's2' || k === 'plot' ? [260, 260] : [CELDA[k].w * 1.6, CELDA[k].h * 1.6]
  return [lon(-w / 2), lat(-h / 2), lon(w / 2), lat(h / 2)]
}

export default function MapaEscala({ sel, etiqueta }: { sel: ClaveEscala; etiqueta: string }) {
  const cont = useRef<HTMLDivElement>(null)
  const mapa = useRef<MLMap | null>(null)
  const selRef = useRef(sel)
  useLayoutEffect(() => {
    selRef.current = sel
  })

  useEffect(() => {
    const el = cont.current
    if (!el) return
    const map = new maplibregl.Map({
      container: el,
      interactive: false,
      attributionControl: { compact: true },
      bounds: encuadre(selRef.current),
      fitBoundsOptions: { padding: 24 },
      style: {
        version: 8,
        sources: {
          esri: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 19,
            attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
          },
          etiquetas: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 19,
          },
          rejilla: { type: 'geojson', data: rejilla(selRef.current) },
          celda: { type: 'geojson', data: celdaCentral(selRef.current) },
          parcela: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [PARCELA] } } },
          punto: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: CENTRO } } },
        },
        layers: [
          { id: 'esri', type: 'raster', source: 'esri' },
          { id: 'etiquetas', type: 'raster', source: 'etiquetas', minzoom: 9, maxzoom: 14, paint: { 'raster-opacity': 0.85 } },
          { id: 'celda', type: 'fill', source: 'celda', paint: { 'fill-color': '#E49C54', 'fill-opacity': 0.18 } },
          { id: 'rejilla', type: 'line', source: 'rejilla', paint: { 'line-color': '#FFFFFF', 'line-opacity': 0.6, 'line-width': 1 } },
          { id: 'celda-borde', type: 'line', source: 'celda', paint: { 'line-color': '#F2B872', 'line-width': 3 } },
          { id: 'parcela', type: 'fill', source: 'parcela', paint: { 'fill-color': '#7AB22A', 'fill-opacity': 0.35 } },
          { id: 'parcela-borde', type: 'line', source: 'parcela', paint: { 'line-color': '#C5F07A', 'line-width': 2.5 } },
          // A escala regional la parcela es un punto: se marca para no perderla.
          {
            id: 'punto',
            type: 'circle',
            source: 'punto',
            maxzoom: 14,
            paint: { 'circle-radius': 6, 'circle-color': '#7AB22A', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2.5 },
          },
        ],
      },
    })
    mapa.current = map
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(el)
    return () => {
      ro.disconnect()
      map.remove()
      mapa.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapa.current
    if (!map) return
    const aplicar = () => {
      ;(map.getSource('rejilla') as GeoJSONSource | undefined)?.setData(rejilla(sel))
      ;(map.getSource('celda') as GeoJSONSource | undefined)?.setData(celdaCentral(sel))
      const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      map.fitBounds(encuadre(sel), { padding: 24, duration: quieto ? 0 : 2200, maxZoom: 18.5 })
    }
    if (map.isStyleLoaded()) aplicar()
    else map.once('load', aplicar)
  }, [sel])

  return (
    <div className="relative size-full">
      <div ref={cont} className="size-full" />
      <p className="pointer-events-none absolute top-4 left-4 flex items-center gap-2 rounded-full bg-bosque/85 px-3.5 py-1.5 text-sm font-bold text-crema backdrop-blur-sm">
        <span aria-hidden className={`size-3 rounded-[3px] border-2 ${sel === 'plot' ? 'border-[#C5F07A] bg-pradera/60' : 'border-[#F2B872] bg-papa/30'}`} />
        {etiqueta}
      </p>
    </div>
  )
}
