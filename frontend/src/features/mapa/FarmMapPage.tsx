import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { MapMouseEvent } from 'maplibre-gl'
import { Link } from 'react-router'
import { Polygon as PolygonIcon, PersonSimpleWalk, Trash, ListBullets, Check, ArrowCounterClockwise, Plant } from '@phosphor-icons/react'
import { useDict } from '../../i18n/useDict'
import { db, type Parcela } from '../../data/db'
import { useAnalisis } from '../../data/analysis'
import { esActivo } from '../../data/registros'
import { useContextoChat } from '../../app/uiStore'
import { formatArea, formatLen, medir, openRing, polygonFromRing, type LonLat } from '../../lib/geo'
import { geolocateControl, setData } from './mapCore'
import { useMapa, LayerPicker, LensToggle, Sheet } from './MapWidgets'
import { AnalysisPanel } from '../analisis/AnalysisPanel'

type Modo = 'idle' | 'dibujo' | 'gps' | 'confirmar'
const IPIALES: LonLat = [-77.6395, 0.8305]

/**
 * Mapa de «Mi finca».
 * - Ubicación en tiempo real (control de geolocalización de MapLibre, con círculo de precisión).
 * - Dibujar parcela tocando las esquinas (Terra Draw) o caminar el lindero con el GPS.
 * - Área y perímetro geodésicos antes de guardar; todo se guarda en el dispositivo (IndexedDB).
 * - Al tocar una parcela: ficha con el análisis de la API (punto en el centroide + polígono).
 */
export default function FarmMapPage() {
  const t = useDict().mapa
  const { i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const { ref, map } = useMapa(IPIALES, 14)
  const parcelas = useLiveQuery(() => db.parcelas.toArray(), [])
  const [sel, setSel] = useState<number | null>(null)
  const [modo, setModo] = useState<Modo>('idle')
  const [pendiente, setPendiente] = useState<{ poly: Polygon; metodo: Parcela['metodo'] } | null>(null)
  const [nombre, setNombre] = useState('')
  const [lista, setLista] = useState(false)
  const draw = useRef<TerraDraw | null>(null)
  const modoRef = useRef(modo)
  modoRef.current = modo

  /* Ubicación en tiempo real + Terra Draw */
  useEffect(() => {
    if (!map) return
    const geo = geolocateControl()
    map.addControl(geo, 'top-right')
    const td = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [
        new TerraDrawPolygonMode({
          styles: {
            fillColor: '#E49C54',
            fillOpacity: 0.3,
            outlineColor: '#E49C54',
            outlineWidth: 3,
            closingPointColor: '#FFFFFF',
            closingPointOutlineColor: '#E49C54',
            closingPointWidth: 8,
            closingPointOutlineWidth: 3,
          },
        }),
        new TerraDrawSelectMode({
          flags: { polygon: { feature: { coordinates: { midpoints: true, draggable: true, deletable: true } } } },
          styles: {
            selectedPolygonColor: '#E49C54',
            selectedPolygonFillOpacity: 0.3,
            selectedPolygonOutlineColor: '#FFFFFF',
            selectedPolygonOutlineWidth: 3,
            selectionPointColor: '#FFFFFF',
            selectionPointOutlineColor: '#E49C54',
            selectionPointWidth: 7,
            midPointColor: '#E49C54',
          },
        }),
      ],
    })
    td.start()
    const leer = (id: string | number) => {
      const f = td.getSnapshot().find((x) => x.id === id)
      return f?.geometry.type === 'Polygon' ? (f.geometry as Polygon) : null
    }
    td.on('finish', (id, ctx) => {
      if (ctx.mode !== 'polygon') return
      const poly = leer(id)
      if (!poly) return
      setPendiente({ poly, metodo: 'dibujo' })
      setModo('confirmar')
      td.setMode('select')
      td.selectFeature(id)
    })
    td.on('change', (ids) => {
      if (modoRef.current !== 'confirmar') return
      const id = ids[0]
      const poly = id !== undefined ? leer(id) : null
      if (poly) setPendiente((p) => (p ? { ...p, poly } : p))
    })
    draw.current = td

    const onClick = (e: MapMouseEvent) => {
      if (modoRef.current !== 'idle') return
      const f = map.queryRenderedFeatures(e.point, { layers: ['parcelas-fill'] })[0]
      setSel(f ? Number(f.properties?.id) : null)
    }
    map.on('click', onClick)
    map.on('mouseenter', 'parcelas-fill', () => modoRef.current === 'idle' && (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', 'parcelas-fill', () => (map.getCanvas().style.cursor = ''))
    return () => {
      map.off('click', onClick)
      try {
        td.stop()
      } catch {
        /* el mapa ya se destruyó */
      }
      draw.current = null
    }
  }, [map])

  /* Parcelas guardadas → capa del mapa */
  useEffect(() => {
    if (!map || !parcelas) return
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: parcelas.map((p): Feature => ({ type: 'Feature', properties: { id: p.id, sel: p.id === sel }, geometry: p.geom })),
    }
    setData(map, 'parcelas', fc)
  }, [map, parcelas, sel])

  /* Al abrir por primera vez, encuadrar las parcelas existentes */
  const encuadrado = useRef(false)
  useEffect(() => {
    if (!map || !parcelas?.length || encuadrado.current) return
    encuadrado.current = true
    const pts = parcelas.flatMap((p) => p.geom.coordinates[0])
    const xs = pts.map((c) => c[0])
    const ys = pts.map((c) => c[1])
    map.fitBounds([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], { padding: 80, maxZoom: 17, duration: 0 })
  }, [map, parcelas])

  const iniciarDibujo = () => {
    setSel(null)
    draw.current?.clear()
    draw.current?.setMode('polygon')
    setModo('dibujo')
  }

  const cancelar = () => {
    draw.current?.clear()
    draw.current?.setMode('static')
    gps.detener()
    setPendiente(null)
    setNombre('')
    setModo('idle')
  }

  /* Caminar el lindero con el GPS */
  const gps = useCaminata(map, (ring) => {
    const poly = polygonFromRing(ring)
    const td = draw.current
    if (td) {
      td.setMode('select')
      const [res] = td.addFeatures([{ type: 'Feature', properties: { mode: 'polygon' }, geometry: poly }])
      if (res?.valid && res.id !== undefined) td.selectFeature(res.id)
    }
    setPendiente({ poly, metodo: 'gps' })
    setModo('confirmar')
  })

  const guardar = async () => {
    if (!pendiente) return
    const m = medir(pendiente.poly)
    const id = await db.parcelas.add({
      nombre: nombre.trim() || `${t.newPlot} ${(parcelas?.length ?? 0) + 1}`,
      geom: pendiente.poly,
      areaM2: m.areaM2,
      perimetroM: m.perimetroM,
      centroide: m.centroide,
      metodo: pendiente.metodo,
      creadaEn: new Date().toISOString(),
    })
    cancelar()
    setSel(id as number)
  }

  const borrar = async (p: Parcela) => {
    if (!p.id || !window.confirm(t.confirmDelete)) return
    await db.parcelas.delete(p.id)
    setSel(null)
  }

  const medida = useMemo(() => (pendiente ? medir(pendiente.poly) : null), [pendiente])
  const parcela = parcelas?.find((p) => p.id === sel) ?? null
  // Potatonaut habla de la parcela abierta (y de su cultivo en curso, si lo tiene).
  const ciclosParcela = useLiveQuery(() => (parcela?.id ? db.ciclos.where('parcelaId').equals(parcela.id).toArray() : []), [parcela?.id])
  const cultivoActivo = ciclosParcela?.find(esActivo)?.cultivoId
  useContextoChat(parcela ? { lat: parcela.centroide[1], lon: parcela.centroide[0], lugar: parcela.nombre, cultivoId: cultivoActivo } : null)
  const centroLente: LonLat | null = parcela ? parcela.centroide : null

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={ref} className="h-full w-full" />

      {/* Controles superiores */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-start gap-2 lg:top-4 lg:left-4">
        <LayerPicker map={map} />
        <LensToggle map={map} center={centroLente} />
        <div className="relative">
          <button
            type="button"
            onClick={() => setLista((v) => !v)}
            className="flex items-center gap-2 rounded-full bg-papel px-4 py-2.5 text-sm font-bold text-bosque shadow-flota"
          >
            <ListBullets size={18} weight="bold" aria-hidden />
            {t.myPlots} ({parcelas?.length ?? 0})
          </button>
          {lista && (
            <ul className="absolute top-full left-0 z-20 mt-2 max-h-72 w-64 overflow-y-auto rounded-tarjeta bg-papel p-2 shadow-flota">
              {!parcelas?.length && <li className="px-3 py-2 text-sm text-gris">{t.noPlots}</li>}
              {parcelas?.map((p) => (
                <li key={p.id}>
                  <button
                    className="w-full rounded-chip px-3 py-2 text-left hover:bg-crema"
                    onClick={() => {
                      setLista(false)
                      setSel(p.id ?? null)
                      map?.flyTo({ center: p.centroide, zoom: 16 })
                    }}
                  >
                    <span className="block font-bold text-bosque">{p.nombre}</span>
                    <span className="cifra text-xs text-gris">{formatArea(p.areaM2, lang)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Acciones inferiores */}
      {modo === 'idle' && !parcela && (
        <div className="absolute bottom-[calc(6rem+env(safe-area-inset-bottom))] left-3 z-10 flex flex-wrap gap-2 pr-24 lg:bottom-6 lg:left-1/2 lg:-translate-x-1/2 lg:pr-0">
          <button onClick={iniciarDibujo} className="flex items-center gap-2 rounded-full bg-bosque px-5 py-3 font-bold text-crema shadow-flota">
            <PolygonIcon size={20} weight="bold" aria-hidden />
            {t.draw}
          </button>
          <button
            onClick={() => {
              setSel(null)
              gps.iniciar()
              setModo('gps')
            }}
            className="flex items-center gap-2 rounded-full bg-papel px-5 py-3 font-bold text-bosque shadow-flota"
          >
            <PersonSimpleWalk size={20} weight="bold" aria-hidden />
            {t.walk}
          </button>
        </div>
      )}

      {(modo === 'dibujo' || modo === 'gps') && (
        <div className="absolute inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-10 rounded-tarjeta bg-papel p-4 shadow-flota lg:inset-x-auto lg:bottom-6 lg:left-1/2 lg:w-[30rem] lg:-translate-x-1/2">
          <p className="font-semibold text-bosque">{modo === 'dibujo' ? t.drawHint : t.walkHint}</p>
          {modo === 'gps' && (
            <p className="cifra mt-1 text-sm text-gris">
              {gps.error ? (
                <span className="text-arcilla">{t.walkDenied}</span>
              ) : gps.precision === null ? (
                t.walkWaiting
              ) : (
                `${gps.puntos.length} ${t.walkPoints} · ${t.walkAccuracy} ±${Math.round(gps.precision)} m`
              )}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button onClick={cancelar} className="rounded-full border-2 border-borde px-4 py-2 font-bold text-gris">
              {t.cancel}
            </button>
            {modo === 'gps' && (
              <button
                disabled={gps.puntos.length < 3}
                onClick={gps.terminar}
                className="flex items-center gap-1.5 rounded-full bg-bosque px-5 py-2 font-bold text-crema disabled:opacity-40"
              >
                <Check size={18} weight="bold" aria-hidden />
                {t.finish}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirmar nueva parcela */}
      {modo === 'confirmar' && pendiente && medida && (
        <Sheet title={t.newPlot} subtitle={t.method[pendiente.metodo]} onClose={cancelar}>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-tarjeta bg-niebla p-4">
              <dt className="text-sm text-gris">{t.area}</dt>
              <dd className="cifra text-2xl font-bold text-bosque">{formatArea(medida.areaM2, lang)}</dd>
            </div>
            <div className="rounded-tarjeta bg-niebla p-4">
              <dt className="text-sm text-gris">{t.perimeter}</dt>
              <dd className="cifra text-2xl font-bold text-bosque">{formatLen(medida.perimetroM, lang)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-gris">{t.areaMethod}</p>
          <label className="mt-5 block font-bold text-bosque">
            {t.plotName}
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={t.plotNamePh}
              className="mt-1.5 w-full rounded-full border-2 border-borde bg-crema px-4 py-3 font-semibold focus:border-bosque focus:outline-none"
            />
          </label>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={guardar} className="flex items-center gap-2 rounded-full bg-bosque px-6 py-3 font-bold text-crema shadow-flota">
              <Check size={18} weight="bold" aria-hidden />
              {t.save}
            </button>
            <button
              onClick={() => {
                cancelar()
                if (pendiente.metodo === 'dibujo') iniciarDibujo()
              }}
              className="flex items-center gap-2 rounded-full border-2 border-borde px-5 py-2.5 font-bold text-gris"
            >
              <ArrowCounterClockwise size={18} weight="bold" aria-hidden />
              {t.redraw}
            </button>
          </div>
        </Sheet>
      )}

      {/* Ficha de la parcela seleccionada */}
      {modo === 'idle' && parcela && <FichaParcela parcela={parcela} onClose={() => setSel(null)} onDelete={() => borrar(parcela)} />}
    </div>
  )
}

function FichaParcela({ parcela, onClose, onDelete }: { parcela: Parcela; onClose: () => void; onDelete: () => void }) {
  const t = useDict().mapa
  const { i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const objetivo = useMemo(
    () => ({ tipo: 'area' as const, centro: parcela.centroide, anillo: openRing(parcela.geom) }),
    [parcela.centroide, parcela.geom],
  )
  const estado = useAnalisis(objetivo)
  return (
    <Sheet
      title={parcela.nombre}
      subtitle={
        <span className="cifra">
          {formatArea(parcela.areaM2, lang)} · {formatLen(parcela.perimetroM, lang)} · {t.method[parcela.metodo]}
        </span>
      }
      onClose={onClose}
    >
      <Link
        to={`/finca/cultivos?nuevo=1&parcela=${parcela.id}`}
        className="mb-5 flex items-center justify-center gap-2 rounded-full bg-bosque px-6 py-3 lg:inline-flex font-bold text-crema shadow-flota transition hover:bg-bosque-700"
      >
        <Plant size={20} weight="bold" aria-hidden />
        {t.registerCrop}
      </Link>
      <AnalysisPanel estado={estado} areaM2={parcela.areaM2} />
      <button onClick={onDelete} className="mt-6 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-arcilla hover:bg-arcilla-suave">
        <Trash size={18} weight="bold" aria-hidden />
        {t.delete}
      </button>
    </Sheet>
  )
}

/** Recorrido GPS: agrega un punto cada ≥ 4 m si la precisión es ≤ 30 m; dibuja la línea en vivo. */
function useCaminata(map: ReturnType<typeof useMapa>['map'], alTerminar: (ring: LonLat[]) => void) {
  const [puntos, setPuntos] = useState<LonLat[]>([])
  const [precision, setPrecision] = useState<number | null>(null)
  const [error, setError] = useState(false)
  const watch = useRef<number | null>(null)

  useEffect(() => {
    if (!map) return
    const features: Feature[] = puntos.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }))
    if (puntos.length > 1) features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: puntos } })
    setData(map, 'recorrido', { type: 'FeatureCollection', features })
  }, [map, puntos])

  const detener = () => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current)
    watch.current = null
    setPuntos([])
    setPrecision(null)
    setError(false)
  }

  const iniciar = () => {
    detener()
    if (!('geolocation' in navigator)) return setError(true)
    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p: LonLat = [pos.coords.longitude, pos.coords.latitude]
        setPrecision(pos.coords.accuracy)
        if (pos.coords.accuracy > 30) return
        setPuntos((prev) => {
          const last = prev[prev.length - 1]
          if (last) {
            const dx = (p[0] - last[0]) * 111_320 * Math.cos((p[1] * Math.PI) / 180)
            const dy = (p[1] - last[1]) * 111_320
            if (Math.hypot(dx, dy) < 4) return prev
          } else {
            map?.flyTo({ center: p, zoom: 18 })
          }
          return [...prev, p]
        })
      },
      () => setError(true),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    )
  }

  const terminar = () => {
    const ring = puntos
    detener()
    if (ring.length >= 3) alTerminar(ring)
  }

  return { puntos, precision, error, iniciar, detener, terminar }
}
