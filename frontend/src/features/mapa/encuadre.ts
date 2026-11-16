import { useEffect, useLayoutEffect, useRef } from 'react'
import type { Map as MLMap, PaddingOptions } from 'maplibre-gl'
import type { LonLat } from '../../lib/geo'

/* ───────── Encuadre: que lo que se mira quede en la parte del mapa que la ficha no tapa ───────── */

/** Margen libre del mapa medido con la ficha real ([data-hoja]): a su derecha si es lateral, encima si es inferior. */
export function paddingLibre(map: MLMap): PaddingOptions | null {
  const cont = map.getContainer().getBoundingClientRect()
  const base = { top: 72, bottom: 40, left: 40, right: 64 }
  const hoja = map.getContainer().parentElement?.querySelector<HTMLElement>('[data-hoja]')
  if (!hoja) return base
  const h = hoja.getBoundingClientRect()
  const lateral = h.top - cont.top < 60
  const p = lateral ? { ...base, left: Math.max(base.left, h.right - cont.left + 32) } : { ...base, bottom: Math.max(base.bottom, cont.bottom - h.top + 24) }
  // Si la ficha deja muy poco mapa (p. ej. desplegada en el teléfono), no se mueve la cámara.
  if (cont.width - p.left - p.right < 80 || cont.height - p.top - p.bottom < 80) return null
  return p
}

type Encuadre = { bbox: [number, number, number, number] } | { centro: LonLat }

/**
 * Encuadra `objetivo` en la zona libre del mapa cuando cambia `clave`, y lo vuelve a encuadrar si cambia el tamaño
 * del mapa o de la ficha (girar el teléfono, abrir/cerrar la ficha, llegar el análisis, redimensionar la ventana).
 */
export function useEncuadre(map: MLMap | null, objetivo: Encuadre | null, clave: string | number | null, maxZoom = 16.5) {
  const obj = useRef(objetivo)
  useLayoutEffect(() => {
    obj.current = objetivo
  })
  useEffect(() => {
    if (!map || clave === null || !obj.current) return
    let primero = true
    let t: ReturnType<typeof setTimeout> | undefined
    const hacer = () => {
      const o = obj.current
      const padding = paddingLibre(map)
      if (!o || !padding) return
      const duration = primero ? 800 : 300
      primero = false
      if ('bbox' in o) map.fitBounds(o.bbox, { padding, maxZoom, duration })
      else map.easeTo({ center: o.centro, padding, duration })
    }
    const ro = new ResizeObserver(() => {
      clearTimeout(t)
      t = setTimeout(hacer, primero ? 0 : 200)
    })
    ro.observe(map.getContainer())
    const hoja = map.getContainer().parentElement?.querySelector('[data-hoja]')
    if (hoja) ro.observe(hoja)
    return () => {
      clearTimeout(t)
      ro.disconnect()
    }
  }, [map, clave, maxZoom])
}

export const bboxDe = (ring: number[][]): [number, number, number, number] => {
  const xs = ring.map((c) => c[0])
  const ys = ring.map((c) => c[1])
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}
