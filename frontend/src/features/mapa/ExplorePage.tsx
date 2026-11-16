import { useEffect, useMemo, useRef, useState } from 'react'
import type { Marker, MapMouseEvent } from 'maplibre-gl'
import { Crosshair, HandPointing } from '@phosphor-icons/react'
import { useDict } from '../../i18n/useDict'
import { SiteNav } from '../landing/SiteNav'
import { useAnalisis } from '../../data/analysis'
import { geolocateControl, potatoMarker } from './mapCore'
import { useMapa, LayerPicker, LensToggle, Sheet, DESPUES_PANEL, CargandoMapa } from './MapWidgets'
import { useEncuadre } from './encuadre'
import { AnalysisPanel } from '../analisis/AnalysisPanel'
import { PotatonautFab, PotatonautPanel } from '../potatonaut/Potatonaut'
import type { LonLat } from '../../lib/geo'
import { useContextoChat, useUi } from '../../app/uiStore'

/** Explorar (público, sin cuenta): tocar el mapa o usar la ubicación → análisis del punto con su procedencia. */
export default function ExplorePage() {
  const t = useDict().mapa
  const { ref, map } = useMapa([-77.6395, 0.8305], 9)
  const [punto, setPunto] = useState<LonLat | null>(null)
  const marker = useRef<Marker | null>(null)
  const geo = useRef<ReturnType<typeof geolocateControl> | null>(null)

  useEffect(() => {
    if (!map) return
    const g = geolocateControl()
    geo.current = g
    map.addControl(g, 'top-right')
    g.on('geolocate', (e) => setPunto([e.coords.longitude, e.coords.latitude]))
    const onClick = (e: MapMouseEvent) => setPunto([e.lngLat.lng, e.lngLat.lat])
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
    }
  }, [map])

  useEffect(() => {
    if (!map) return
    marker.current?.remove()
    if (punto) marker.current = potatoMarker(punto).addTo(map)
    else map.setPadding({ left: 0, top: 0, right: 0, bottom: 0 })
  }, [map, punto])

  // Que el punto quede a la vista fuera de la ficha (medida real), también al girar o redimensionar.
  useEncuadre(map, punto ? { centro: punto } : null, punto ? punto.join(',') : null)

  // En el teléfono la tarjeta de bienvenida ocupa la parte baja: el botón flotante se oculta mientras se ve.
  const setHojaAbierta = useUi((s) => s.setHojaAbierta)
  useEffect(() => {
    if (punto) return
    setHojaAbierta(true)
    return () => setHojaAbierta(false)
  }, [punto, setHojaAbierta])

  useContextoChat(punto ? { lat: punto[1], lon: punto[0] } : null)
  const objetivo = useMemo(() => (punto ? { tipo: 'punto' as const, centro: punto } : null), [punto])
  const estado = useAnalisis(objetivo)

  return (
    <>
      <SiteNav />
      <main className="relative h-[100svh] pt-16 md:pt-20">
        <div className="relative h-full w-full overflow-hidden">
          <div ref={ref} className="h-full w-full" />
          <CargandoMapa visible={!map} />

          <div className={`absolute top-3 right-14 left-3 z-10 flex flex-wrap items-start gap-2 md:right-auto lg:top-4 ${punto ? DESPUES_PANEL : 'lg:left-4'}`}>
            <LayerPicker map={map} />
            <LensToggle map={map} center={punto} />
          </div>

          {!punto && (
            <div className="absolute inset-x-3 bottom-6 z-10 rounded-hoja bg-papel p-6 shadow-flota sm:inset-x-auto sm:left-4 sm:w-[26rem]">
              <h1 className="text-3xl">{t.exploreTitle}</h1>
              <p className="mt-2 text-gris">{t.exploreLead}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => geo.current?.trigger()}
                  className="flex items-center gap-2 rounded-full bg-bosque px-5 py-3 font-bold text-crema shadow-flota"
                >
                  <Crosshair size={20} weight="bold" aria-hidden />
                  {t.useLocation}
                </button>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-gris">
                  <HandPointing size={18} weight="duotone" aria-hidden />
                  {t.tapHint}
                </span>
              </div>
            </div>
          )}

          {punto && (
            <Sheet
              title={<span className="cifra">{`${punto[1].toFixed(4)}°, ${punto[0].toFixed(4)}°`}</span>}
              onClose={() => setPunto(null)}
            >
              <AnalysisPanel estado={estado} />
            </Sheet>
          )}
        </div>
      </main>
      <PotatonautFab />
      <PotatonautPanel />
    </>
  )
}
