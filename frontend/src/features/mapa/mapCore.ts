import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MLMap, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre 6 calcula la ruta de su worker en tiempo de ejecución y Vite no puede empaquetarla sola:
// se importa el worker (autónomo) como archivo y se le indica la URL explícitamente.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

maplibregl.setWorkerUrl(workerUrl)
import type { FeatureCollection } from 'geojson'

// Núcleo del mapa de Groundy (MapLibre GL).
// Base: imagen satelital Esri World Imagery + etiquetas. Capas visuales: NASA GIBS (WMTS público, sin llave).
// Las cifras NUNCA salen de las teselas: salen de la API (/analizar/*). Las teselas solo muestran el patrón espacial.

export type GibsKey = 'ndvi' | 'lluvia' | 'humedad' | 'lst'

/** Identificadores, malla y fecha verificados en el GetCapabilities de GIBS (EPSG:3857) el 15-nov-2026. */
export const GIBS: Record<GibsKey, { id: string; tms: string; maxzoom: number; fecha: string; res: string }> = {
  ndvi: { id: 'MODIS_Terra_NDVI_8Day', tms: 'GoogleMapsCompatible_Level9', maxzoom: 9, fecha: '2026-11-14', res: '250 m' },
  lluvia: { id: 'IMERG_Precipitation_Rate', tms: 'GoogleMapsCompatible_Level6', maxzoom: 6, fecha: '2026-11-14', res: '~10 km' },
  humedad: { id: 'SMAP_L4_Analyzed_Surface_Soil_Moisture', tms: 'GoogleMapsCompatible_Level6', maxzoom: 6, fecha: '2026-11-10', res: '~9 km' },
  lst: { id: 'MODIS_Terra_Land_Surface_Temp_Day', tms: 'GoogleMapsCompatible_Level7', maxzoom: 7, fecha: '2026-11-14', res: '1 km' },
}

const gibsTiles = (k: GibsKey) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${GIBS[k].id}/default/${GIBS[k].fecha}/${GIBS[k].tms}/{z}/{y}/{x}.png`

const style: StyleSpecification = {
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
    ...Object.fromEntries(
      (Object.keys(GIBS) as GibsKey[]).map((k) => [
        `gibs-${k}`,
        { type: 'raster', tiles: [gibsTiles(k)], tileSize: 256, maxzoom: GIBS[k].maxzoom, attribution: 'NASA GIBS / EOSDIS' },
      ]),
    ),
  },
  layers: [
    { id: 'esri', type: 'raster', source: 'esri' },
    ...(Object.keys(GIBS) as GibsKey[]).map((k) => ({
      id: `gibs-${k}`,
      type: 'raster' as const,
      source: `gibs-${k}`,
      layout: { visibility: 'none' as const },
      paint: { 'raster-opacity': 0.7 },
    })),
    { id: 'etiquetas', type: 'raster', source: 'etiquetas', paint: { 'raster-opacity': 0.9 } },
  ],
}

const vacio: FeatureCollection = { type: 'FeatureCollection', features: [] }

export function createMap(container: HTMLElement, center: [number, number], zoom: number): MLMap {
  const map = new maplibregl.Map({
    container,
    style,
    center,
    zoom,
    maxPitch: 0,
    dragRotate: false,
    attributionControl: { compact: true },
  })
  map.touchZoomRotate.disableRotation()
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

  map.on('load', () => {
    // Huellas de escala (lupa)
    map.addSource('huellas', { type: 'geojson', data: vacio })
    map.addLayer({ id: 'huellas-fill', type: 'fill', source: 'huellas', paint: { 'fill-color': '#E49C54', 'fill-opacity': 0.08 } })
    map.addLayer({
      id: 'huellas-line',
      type: 'line',
      source: 'huellas',
      paint: { 'line-color': '#FBE6CF', 'line-width': 2, 'line-dasharray': [3, 2] },
    })
    // Parcelas guardadas
    map.addSource('parcelas', { type: 'geojson', data: vacio })
    map.addLayer({
      id: 'parcelas-fill',
      type: 'fill',
      source: 'parcelas',
      paint: { 'fill-color': '#7AB22A', 'fill-opacity': ['case', ['boolean', ['get', 'sel'], false], 0.45, 0.28] },
    })
    map.addLayer({
      id: 'parcelas-line',
      type: 'line',
      source: 'parcelas',
      paint: {
        'line-color': ['case', ['boolean', ['get', 'sel'], false], '#FFFFFF', '#CFEA9A'],
        'line-width': ['case', ['boolean', ['get', 'sel'], false], 3.5, 2],
      },
    })
    // Recorrido GPS («caminar el lindero»)
    map.addSource('recorrido', { type: 'geojson', data: vacio })
    map.addLayer({ id: 'recorrido-line', type: 'line', source: 'recorrido', paint: { 'line-color': '#E49C54', 'line-width': 4 } })
    map.addLayer({
      id: 'recorrido-pts',
      type: 'circle',
      source: 'recorrido',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: { 'circle-radius': 4, 'circle-color': '#FFFFFF', 'circle-stroke-color': '#E49C54', 'circle-stroke-width': 2 },
    })
  })
  return map
}

export function setData(map: MLMap, id: string, data: FeatureCollection) {
  const run = () => (map.getSource(id) as GeoJSONSource | undefined)?.setData(data)
  if (map.getSource(id)) run()
  else map.once('load', run)
}

export function setGibs(map: MLMap, active: GibsKey | null, opacity = 0.7) {
  const run = () =>
    (Object.keys(GIBS) as GibsKey[]).forEach((k) => {
      if (!map.getLayer(`gibs-${k}`)) return
      map.setLayoutProperty(`gibs-${k}`, 'visibility', k === active ? 'visible' : 'none')
      map.setPaintProperty(`gibs-${k}`, 'raster-opacity', opacity)
    })
  if (map.isStyleLoaded()) run()
  else map.once('load', run)
}

export function geolocateControl() {
  return new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showAccuracyCircle: true,
    showUserLocation: true,
  })
}

/** Marcador con Potatonaut para el punto explorado. */
export function potatoMarker(lngLat: [number, number]) {
  const el = document.createElement('div')
  el.innerHTML = '<img src="/brand/potatonaut-128.webp" alt="" style="height:44px;filter:drop-shadow(0 4px 6px rgb(0 0 0/.35))">'
  return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(lngLat)
}

export { maplibregl }
