import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { useDict } from '../../i18n/useDict'

/**
 * Globo 3D con capas globales de NASA GIBS (WMS, EPSG:4326, sin llave; GIBS permite CORS para usarlas como textura).
 * Base: Blue Marble Next Generation (NASA). Capas: promedios mensuales donde existen, para que el globo no muestre
 * franjas vacías de órbitas diarias. Las leyendas siguen los mapas de color oficiales de GIBS
 * (MODIS_Land_Surface_Temp, MODIS_NDVI, GPM_Precipitation_Rate, MODIS_Cloud_Fraction).
 */
type Capa = 'temp' | 'ndvi' | 'rain' | 'clouds'

const CAPAS: Record<Capa, { id: string; fecha: (anio: number) => string; barra: string }> = {
  temp: {
    id: 'MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day',
    fecha: (a) => `${a}-07-01`,
    barra: 'linear-gradient(90deg, #04fff7, #5dff8a, #c5ff00, #ffcf00, #ffa000)',
  },
  ndvi: {
    id: 'MODIS_Terra_L3_NDVI_Monthly',
    fecha: (a) => `${a}-07-01`,
    barra: 'linear-gradient(90deg, #f1ecec, #c8b5a5, #9a6e59, #64a601, #1d7501, #001801)',
  },
  rain: {
    id: 'IMERG_Precipitation_Rate',
    fecha: (a) => `${a}-07-15`,
    barra: 'linear-gradient(90deg, #00764e, #45c000, #efed00, #ff731c, #ff0101, #960000)',
  },
  clouds: {
    id: 'MODIS_Terra_Cloud_Fraction_Day',
    fecha: (a) => `${a}-07-15`,
    barra: 'linear-gradient(90deg, #660077, #0001aa, #025000, #ffff03, #7a5a07, #ff0005)',
  },
}
const ORDEN: Capa[] = ['temp', 'ndvi', 'rain', 'clouds']

const wms = (capa: string, tiempo: string | null, ancho: number, formato = 'image/png') =>
  `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${capa}` +
  `&FORMAT=${encodeURIComponent(formato)}&TRANSPARENT=TRUE&WIDTH=${ancho}&HEIGHT=${ancho / 2}&CRS=EPSG:4326&BBOX=-90,-180,90,180` +
  (tiempo ? `&TIME=${tiempo}` : '')

/**
 * Blue Marble pinta el mar casi negro (≈ rgb 2,5,20) y con la luz se ve negro: se recolorea en un lienzo.
 * Un píxel es mar si el azul domina; su brillo original (la batimetría) decide el tono entre azul profundo y turquesa.
 */
function texturaTierra(url: string, listo: (t: THREE.Texture) => void) {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    const px = ctx.getImageData(0, 0, c.width, c.height)
    const a = px.data
    const hondo = [46, 120, 160]
    const bajo = [120, 196, 214]
    for (let i = 0; i < a.length; i += 4) {
      const r = a[i], g = a[i + 1], b = a[i + 2]
      if (b > r + 6 && b >= g && r + g + b < 200) {
        const t = Math.min(1, Math.max(0, (b - 18) / 60))
        a[i] = hondo[0] + (bajo[0] - hondo[0]) * t
        a[i + 1] = hondo[1] + (bajo[1] - hondo[1]) * t
        a[i + 2] = hondo[2] + (bajo[2] - hondo[2]) * t
      }
    }
    ctx.putImageData(px, 0, 0)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    listo(tex)
  }
  img.src = url
}

/** Globo 3D. `cabecera` (título y entrada) va a la izquierda junto a los controles; el globo, a la derecha. */
export default function Globo({ cabecera }: { cabecera: ReactNode }) {
  const d = useDict().globe
  const caja = useRef<HTMLDivElement>(null)
  const lienzo = useRef<HTMLCanvasElement>(null)
  const datos = useRef<THREE.MeshPhongMaterial | null>(null)
  const [capa, setCapa] = useState<Capa | null>('temp')
  const [anio, setAnio] = useState(2023)
  const [anioPedido, setAnioPedido] = useState(2023)
  const [estado, setEstado] = useState<'listo' | 'cargando' | 'error'>('listo')
  // Sin WebGL (equipos muy viejos o con aceleración desactivada) se muestra la Tierra como imagen.
  const [sinWebgl] = useState(() => {
    const c = document.createElement('canvas')
    return !(c.getContext('webgl2') || c.getContext('webgl'))
  })
  const ancho = useRef(2048)

  /* Escena: se crea una sola vez y se libera al salir */
  useEffect(() => {
    const cont = caja.current
    const canvas = lienzo.current
    if (!cont || !canvas) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    } catch {
      return
    }
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    ancho.current = cont.clientWidth < 640 ? 1024 : 2048

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000)
    camera.position.set(0, 0, 215)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.enablePan = false
    controls.enableZoom = false // la rueda del ratón sigue desplazando la página
    renderer.domElement.style.touchAction = 'pan-y' // en el teléfono, deslizar vertical sigue siendo scroll

    const geo = new THREE.SphereGeometry(80, 64, 64)
    const matTierra = new THREE.MeshPhongMaterial({ color: 0x78c4d6, shininess: 12, specular: 0x223344 })
    let base: THREE.Texture | null = null
    let vivo = true
    texturaTierra(wms('BlueMarble_ShadedRelief_Bathymetry', null, ancho.current, 'image/jpeg'), (t) => {
      if (!vivo) return t.dispose() // el componente ya se desmontó
      base = t
      matTierra.map = t
      matTierra.color.set(0xffffff)
      matTierra.needsUpdate = true
    })
    const tierra = new THREE.Mesh(geo, matTierra)
    tierra.rotation.y = -1.5
    scene.add(tierra)

    const geoDatos = new THREE.SphereGeometry(80.4, 64, 64)
    const matDatos = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0, depthWrite: false })
    tierra.add(new THREE.Mesh(geoDatos, matDatos))
    datos.current = matDatos

    scene.add(new THREE.AmbientLight(0xffffff, 0.95 * Math.PI))
    const sol = new THREE.DirectionalLight(0xffffff, 0.45 * Math.PI)
    sol.position.set(150, 100, 200)
    scene.add(sol)

    // Estrellas sutiles para dar contexto espacial
    const n = 3000
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n * 3; i += 3) {
      const r = 800 + Math.random() * 400
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(Math.random() * 2 - 1)
      pos[i] = r * Math.sin(ph) * Math.cos(th)
      pos[i + 1] = r * Math.sin(ph) * Math.sin(th)
      pos[i + 2] = r * Math.cos(ph)
    }
    const geoEstrellas = new THREE.BufferGeometry()
    geoEstrellas.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const matEstrellas = new THREE.PointsMaterial({ color: 0x9aa59f, size: 1, transparent: true, opacity: 0.35 })
    scene.add(new THREE.Points(geoEstrellas, matEstrellas))

    const ajustar = () => {
      const w = cont.clientWidth
      const h = cont.clientHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    ajustar()
    const ro = new ResizeObserver(ajustar)
    ro.observe(cont)

    // Solo se dibuja cuando el globo está en pantalla; sin giro automático si se pidió reducir el movimiento.
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let visible = true
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    io.observe(cont)
    let raf = 0
    const animar = () => {
      raf = requestAnimationFrame(animar)
      if (!visible || document.hidden) return
      if (!quieto) tierra.rotation.y += 0.001
      controls.update()
      renderer.render(scene, camera)
    }
    animar()

    return () => {
      vivo = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      controls.dispose()
      matDatos.map?.dispose()
      base?.dispose()
      for (const x of [geo, geoDatos, geoEstrellas, matTierra, matDatos, matEstrellas]) x.dispose()
      renderer.dispose()
      datos.current = null
    }
  }, [])

  /* Capa de datos: se pide a GIBS al cambiar la variable o el año (respuestas viejas se descartan) */
  const pedido = useRef(0)
  useEffect(() => {
    const mat = datos.current
    if (!mat) return
    if (!capa) {
      pedido.current++ // descarta cualquier capa que aún esté llegando
      mat.map?.dispose()
      mat.map = null
      mat.opacity = 0
      mat.needsUpdate = true
      return
    }
    const id = ++pedido.current
    setEstado('cargando')
    const c = CAPAS[capa]
    new THREE.TextureLoader().load(
      wms(c.id, c.fecha(anioPedido), ancho.current),
      (tex) => {
        if (id !== pedido.current || !datos.current) return tex.dispose()
        tex.colorSpace = THREE.SRGBColorSpace
        mat.map?.dispose()
        mat.map = tex
        mat.opacity = 0.85
        mat.needsUpdate = true
        setEstado('listo')
      },
      undefined,
      () => {
        if (id !== pedido.current) return
        setEstado('error')
        setTimeout(() => id === pedido.current && setEstado('listo'), 2000)
      },
    )
  }, [capa, anioPedido])

  /* El año se pide medio segundo después de soltar el control, como en el original */
  useEffect(() => {
    const t = setTimeout(() => setAnioPedido(anio), 500)
    return () => clearTimeout(t)
  }, [anio])

  const ley = capa ? d.legend[capa] : null

  return (
    <div className="grid items-center gap-x-14 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:grid-rows-[auto_auto]">
      <div className="lg:self-end">{cabecera}</div>

      <div
        ref={caja}
        className="relative mx-auto aspect-square w-full max-w-[min(38rem,calc(100svh-9rem))] cursor-grab active:cursor-grabbing lg:col-start-2 lg:row-span-2 lg:row-start-1"
      >
        {/* Halo de atmósfera, suave y claro, detrás del globo */}
        <div aria-hidden className="absolute inset-[5%] rounded-full bg-[radial-gradient(circle,rgb(120_196_214/0.55)_55%,rgb(225_240_248/0)_72%)] blur-xl" />
        {sinWebgl ? (
          <img
            src={wms('BlueMarble_ShadedRelief_Bathymetry', null, 1024, 'image/jpeg')}
            alt=""
            className="absolute inset-[7%] size-[86%] rounded-full object-cover"
          />
        ) : (
          <canvas ref={lienzo} className="relative block size-full" aria-hidden />
        )}
        {estado !== 'listo' && (
          <p
            role="status"
            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-chip bg-papel/90 px-4 py-2 text-sm font-bold whitespace-nowrap text-cielo-osc shadow-suave"
          >
            {estado === 'cargando' ? d.loading : d.error}
          </p>
        )}
      </div>

      {/* Capas, año y leyenda: a la izquierda en escritorio, bajo el globo en el teléfono */}
      <div className="w-full max-w-md justify-self-center lg:self-start lg:justify-self-start">
        <div role="radiogroup" aria-label={d.group} className="grid grid-cols-2 gap-2">
          {ORDEN.map((k) => {
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={capa === k}
                onClick={() => {
                  if (capa === k) setEstado('listo')
                  setCapa(capa === k ? null : k)
                }}
                className={`flex items-center rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${
                  capa === k ? 'bg-bosque text-crema shadow-flota' : 'bg-papel text-bosque shadow-suave hover:bg-niebla'
                }`}
              >
                {d.layers[k]}
              </button>
            )
          })}
        </div>

        <div className="mt-3 rounded-2xl bg-papel px-5 py-4 shadow-suave">
          <label className="cifra flex w-full items-center gap-3 text-sm font-bold text-bosque">
            <span>2020</span>
            <input
              type="range"
              min={2020}
              max={2023}
              step={1}
              value={anio}
              onChange={(e) => setAnio(+e.target.value)}
              aria-label={d.year}
              className="h-1.5 flex-1 cursor-pointer accent-[#0E3B23]"
            />
            <span className="w-11 rounded-full bg-niebla py-0.5 text-center">{anio}</span>
          </label>
          {capa && ley ? (
            <div className="cifra mt-3 flex w-full items-center gap-3 text-xs font-semibold text-gris">
              <span className="whitespace-nowrap">{ley[0]}</span>
              <span className="h-2.5 flex-1 rounded-full" style={{ background: CAPAS[capa].barra }} aria-hidden />
              <span className="whitespace-nowrap">{ley[1]}</span>
            </div>
          ) : (
            <p className="mt-3 text-xs font-semibold text-gris">{d.remove}</p>
          )}
        </div>
      </div>
    </div>
  )
}
