import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Map as MLMap } from 'maplibre-gl'
import { StackSimple, MagnifyingGlassPlus, X } from '@phosphor-icons/react'
import { useDict } from '../../i18n/useDict'
import { createMap, GIBS, setData, setGibs, type GibsKey } from './mapCore'
import { huella, huellasFC, type Huella, type LonLat } from '../../lib/geo'

/** Crea el mapa una sola vez sobre el contenedor y lo destruye al salir. */
export function useMapa(center: LonLat, zoom: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<MLMap | null>(null)
  useEffect(() => {
    if (!ref.current) return
    const m = createMap(ref.current, center, zoom)
    m.on('load', () => setMap(m))
    return () => {
      setMap(null)
      m.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return { ref, map }
}

/** Selector de capas visuales NASA GIBS, con fecha de la imagen y aviso de que es solo visual. */
export function LayerPicker({ map }: { map: MLMap | null }) {
  const t = useDict().mapa
  const [open, setOpen] = useState(false)
  const [capa, setCapa] = useState<GibsKey | null>(null)
  const [op, setOp] = useState(0.7)
  useEffect(() => {
    if (map) setGibs(map, capa, op)
  }, [map, capa, op])
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold shadow-flota transition ${
          capa ? 'bg-bosque text-crema' : 'bg-papel text-bosque'
        }`}
      >
        <StackSimple size={18} weight="bold" aria-hidden />
        {capa ? t.gibs[capa] : t.layers}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-2 w-72 rounded-tarjeta bg-papel p-4 shadow-flota">
          <fieldset>
            <legend className="text-sm font-bold text-bosque">{t.layers}</legend>
            <div className="mt-2 space-y-1">
              {([null, ...(Object.keys(GIBS) as GibsKey[])] as (GibsKey | null)[]).map((k) => (
                <label key={k ?? 'none'} className="flex cursor-pointer items-start gap-2 rounded-chip px-2 py-1.5 hover:bg-crema">
                  <input type="radio" name="gibs" checked={capa === k} onChange={() => setCapa(k)} className="mt-1 accent-[#0E3B23]" />
                  <span>
                    <span className="block text-sm font-semibold">{k ? t.gibs[k] : t.none}</span>
                    {k && (
                      <span className="cifra block text-xs text-gris">
                        {t.imageDate}: {GIBS[k].fecha} · {GIBS[k].res}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {capa && (
            <label className="mt-3 block text-xs font-bold text-gris">
              {t.opacity}
              <input type="range" min={0.2} max={1} step={0.05} value={op} onChange={(e) => setOp(+e.target.value)} className="mt-1 w-full accent-[#0E3B23]" />
            </label>
          )}
          <p className="mt-3 text-xs text-gris">{t.visualOnly}</p>
        </div>
      )}
    </div>
  )
}

const LENTE: Huella[] = ['power', 'imerg', 'smap', 'modis']

/** Botón de la lupa de escala: dibuja en el mapa la huella real de cada fuente alrededor de `center`. */
export function LensToggle({ map, center }: { map: MLMap | null; center: LonLat | null }) {
  const t = useDict().mapa
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!map) return
    setData(map, 'huellas', on && center ? huellasFC(LENTE, center) : { type: 'FeatureCollection', features: [] })
    if (on && center) {
      const b = huella('power', center).poly.coordinates[0]
      map.fitBounds([b[0] as [number, number], b[2] as [number, number]], { padding: 60, duration: 900 })
    }
  }, [map, on, center])
  if (!center) return null
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        aria-pressed={on}
        className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold shadow-flota transition ${
          on ? 'bg-papa text-bosque' : 'bg-papel text-bosque'
        }`}
      >
        <MagnifyingGlassPlus size={18} weight="bold" aria-hidden />
        {t.lens}
      </button>
      {on && (
        <div className="absolute top-full left-0 z-10 mt-2 w-72 rounded-tarjeta bg-papel p-4 text-sm shadow-flota">
          <p className="text-gris">{t.lensHint}</p>
          <ul className="mt-2 space-y-1">
            {LENTE.map((k) => (
              <li key={k} className="flex items-center gap-2">
                <span className="inline-block size-3 rounded-sm border-2 border-dashed border-papa" aria-hidden />
                <span className="font-semibold">{t.lensItems[k]}</span>
                {!huella(k, center).exacta && <span className="text-xs text-gris">({t.lensApprox})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Hoja de detalle: inferior en móvil, lateral izquierda en escritorio. */
/**
 * Ficha sobre el mapa.
 * Móvil: hoja inferior que se desliza. Escritorio: panel lateral izquierdo de alto completo
 * (el mapa queda visible a la derecha); el contenido se recorre deslizando dentro del panel.
 */
export const ANCHO_PANEL = 'lg:w-[28rem] xl:w-[30rem]'
export const DESPUES_PANEL = 'lg:left-[30rem] xl:left-[32rem]'

export function Sheet({ title, subtitle, actions, onClose, children }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; onClose: () => void; children: ReactNode }) {
  const t = useDict().mapa
  return (
    <aside className={`absolute inset-x-0 bottom-0 z-20 flex max-h-[78%] flex-col rounded-t-hoja bg-papel shadow-flota lg:inset-x-auto lg:top-4 lg:bottom-4 lg:left-4 lg:max-h-none lg:rounded-hoja ${ANCHO_PANEL}`}>
      <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-borde lg:hidden" aria-hidden />
      <header className="px-5 pt-3 pb-3 lg:px-6 lg:pt-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl leading-tight lg:text-3xl">{title}</h2>
            {subtitle && <div className="mt-1 text-sm text-gris">{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label={t.close} className="grid size-10 shrink-0 place-items-center rounded-full bg-niebla text-bosque">
            <X size={20} weight="bold" />
          </button>
        </div>
        {actions && <div className="mt-3">{actions}</div>}
      </header>
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-28 [scrollbar-width:thin] lg:px-6 lg:pb-6">{children}</div>
    </aside>
  )
}
