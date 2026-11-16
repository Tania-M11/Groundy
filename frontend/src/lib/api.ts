// Cliente de la API de Groundy (backend del equipo, contrato en backend/docs/CONTRATO_API.md).
// El navegador solo habla con api.groundy.site; GEE, NASA POWER y Supabase quedan detrás.

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://api.groundy.site'

/* ───────── Tipos tal como llegan del backend ───────── */
export type Clima = {
  tmean_c?: number
  rain_mm_yr?: number
  et0_mm_yr?: number
  aridity?: number
  rain_imerg_mm_yr?: number
  rain_range_mm?: [number, number]
}
export type Rotacion = { name: string; score: number; seq: string[]; notes: string[] | string }
export type CultivoTop = { id: string; suit: number; best_month?: string; limits?: string }
export type Meta = { fuente?: 'cache' | 'vivo'; proc_version?: string; generado_en?: string; vigencia_hasta?: string; entregado_en?: string }
type Stat = { media?: number; desv?: number; min?: number; max?: number }

export type PuntoResp = {
  lat: number
  lon: number
  elev_m?: number
  climate?: Clima
  vegetation_monthly?: Record<string, (number | null)[]>
  vegetation_status?: Record<string, string>
  confidence?: string
  sister_site?: string | null
  potato?: { suit?: number; reliability?: number; limiting?: string; best_month_es?: string }
  crops_top?: CultivoTop[]
  rotations?: Rotacion[]
  best_rotation?: string
  provenance?: Record<string, string>
  meta?: Meta
}

export type AreaResp = {
  centroide?: { lat: number; lon: number }
  area_ha?: number
  terreno_dentro_de_la_finca?: { elevacion_m?: Stat; pendiente_grados?: Stat }
  vegetacion?: { ndvi_modis_250m?: Stat; ndvi_sentinel2_10m?: Stat }
  clima_regional?: Clima
  humedad_suelo_regional_mensual?: (number | null)[]
  aptitud?: { suit?: number; reliability?: number; limiting?: string; best_month_es?: string }
  mejor_rotacion?: string
  rotaciones?: Rotacion[]
  confianza?: string
  resolucion?: Record<string, string>
  meta?: Meta
}

export type Cultivo = { id: string; name_es: string; role: string; family: string; is_legume: boolean }

/* ───────── Errores con significado para la interfaz ───────── */
export class ApiError extends Error {
  kind: 'entrada' | 'servicio' | 'motor' | 'red' | 'tiempo' | 'pasarela'
  constructor(kind: ApiError['kind'], message: string) {
    super(message)
    this.kind = kind
  }
}

/**
 * Una consulta nueva tarda ~80–110 s. El túnel de Cloudflare corta a los 100 s (error 524, sin cabeceras CORS:
 * el navegador lo ve como fallo de red), pero el backend sigue calculando y guarda el resultado en su caché.
 * Por eso, ante un corte, se reintenta: el reintento espera al cálculo en curso (key_lock) y recibe la caché.
 */
const INTENTOS = 3
const TIMEOUT_INTENTO_MS = 150_000
const ESPERA_REINTENTO_MS = [0, 3_000, 8_000]
const REINTENTABLES = new Set<ApiError['kind']>(['red', 'tiempo', 'servicio', 'pasarela'])

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function postUnaVez<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(`${API_URL}${path}`, {
      method: 'POST', // las coordenadas exactas viajan solo por POST
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (r.status === 422) throw new ApiError('entrada', 'invalid input')
    if (r.status === 503) throw new ApiError('servicio', 'data service unavailable')
    // 502/504/524: la pasarela (Cloudflare) cortó; el motor probablemente sigue trabajando.
    if (r.status === 502 || r.status === 504 || r.status === 524) throw new ApiError('pasarela', `gateway ${r.status}`)
    if (!r.ok) throw new ApiError('motor', `engine error ${r.status}`)
    return (await r.json()) as T
  } catch (e) {
    if (e instanceof ApiError) throw e
    if ((e as Error).name === 'AbortError') throw new ApiError('tiempo', 'timeout')
    throw new ApiError('red', 'network error')
  } finally {
    clearTimeout(t)
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let ultimo: ApiError = new ApiError('red', 'network error')
  for (let i = 0; i < INTENTOS; i++) {
    // Sin conexión no tiene sentido insistir: se informa de inmediato.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ApiError('red', 'offline')
    if (ESPERA_REINTENTO_MS[i]) await dormir(ESPERA_REINTENTO_MS[i])
    try {
      return await postUnaVez<T>(path, body, TIMEOUT_INTENTO_MS)
    } catch (e) {
      ultimo = e as ApiError
      if (!REINTENTABLES.has(ultimo.kind)) throw ultimo
    }
  }
  // Tras agotar los intentos, un corte de pasarela se presenta como «tardó demasiado».
  throw ultimo.kind === 'pasarela' ? new ApiError('tiempo', ultimo.message) : ultimo
}

export const analizarPunto = (lat: number, lon: number) =>
  post<PuntoResp>('/analizar/punto', { lat: +lat.toFixed(5), lon: +lon.toFixed(5) })

/** coords: anillo [lon, lat] sin repetir el primer vértice al final. */
export const analizarArea = (coords: [number, number][]) =>
  post<AreaResp>('/analizar/area', { coords: coords.map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)]) })

let cultivosCache: Promise<Cultivo[]> | null = null
export function getCultivos(): Promise<Cultivo[]> {
  cultivosCache ??= fetch(`${API_URL}/cultivos`)
    .then((r) => {
      if (!r.ok) throw new ApiError('motor', `cultivos ${r.status}`)
      return r.json()
    })
    .then((d: { cultivos: Cultivo[] }) => d.cultivos)
    .catch((e) => {
      cultivosCache = null
      throw e
    })
  return cultivosCache
}

/* ───────── Modelo unificado que usa la interfaz ───────── */
export type Analisis = {
  centro: { lat: number; lon: number }
  elevM?: number
  areaHa?: number
  clima?: Clima
  mensual?: Record<string, (number | null)[]>
  estadoCapas?: Record<string, string>
  confianza?: string
  cultivosTop: CultivoTop[]
  papa?: PuntoResp['potato']
  rotaciones: Rotacion[]
  mejorRotacion?: string
  terreno?: AreaResp['terreno_dentro_de_la_finca']
  vegetacionFinca?: AreaResp['vegetacion']
  resolucion: Record<string, string>
  procedencia: Record<string, string>
  meta?: Meta
}

/** Une la respuesta de punto (centroide) y, si existe, la de área (polígono). Ningún faltante se convierte en 0. */
export function unificar(p: PuntoResp, a?: AreaResp): Analisis {
  const confianza = [a?.confianza, p.confidence].find((c) => c && c !== 'desconocida')
  return {
    centro: a?.centroide ?? { lat: p.lat, lon: p.lon },
    elevM: p.elev_m,
    areaHa: a?.area_ha,
    clima: p.climate ?? a?.clima_regional,
    mensual: p.vegetation_monthly,
    estadoCapas: p.vegetation_status,
    confianza,
    cultivosTop: p.crops_top ?? [],
    papa: p.potato ?? a?.aptitud,
    rotaciones: [...(p.rotations ?? a?.rotaciones ?? [])].sort((x, y) => y.score - x.score),
    mejorRotacion: p.best_rotation ?? a?.mejor_rotacion,
    terreno: a?.terreno_dentro_de_la_finca,
    vegetacionFinca: a?.vegetacion,
    resolucion: a?.resolucion ?? {},
    procedencia: p.provenance ?? {},
    meta: p.meta,
  }
}
