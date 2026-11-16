import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Filler,
} from 'chart.js'
import {
  ArrowClockwise,
  ArrowRight,
  ArrowsClockwise,
  CalendarBlank,
  CaretDown,
  CloudRain,
  Info,
  Leaf,
  Mountains,
  Plant,
} from '@phosphor-icons/react'
import { useDict } from '../../i18n/useDict'
import { getCultivos, type Analisis, type Cultivo } from '../../lib/api'
import { partesEnCeldaPower } from '../../lib/geo'
import type { useAnalisis } from '../../data/analysis'

ChartJS.register(BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Filler)

/*
 * Ficha de análisis pensada para el agricultor:
 *  1. «En pocas palabras»: una conclusión que se entiende sin leer cifras.
 *  2. Bloques con palabras claras (frío, lluvia abundante, inclinado…) y la cifra al lado.
 *  3. «Saber más» al final: cifras técnicas, método, fuentes y fechas del cálculo.
 * Las palabras salen de umbrales fijos y declarados en «Saber más»; ningún faltante se muestra como 0.
 */

const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const fill = (s: string, v: Record<string, string | number | null | undefined>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''))
const cap = (s: string) => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s)

/* ───────── Traducción de cifras a palabras (umbrales declarados en «Saber más») ───────── */
// Pisos térmicos de Colombia: páramo < 12 °C, frío 12–17, templado 17–24, cálido > 24.
const clasTemp = (c?: number) => (c == null ? null : c < 12 ? 'muyFrio' : c < 17 ? 'frio' : c < 24 ? 'templado' : 'calido')
const clasLluvia = (mm?: number | null) =>
  mm == null ? null : mm < 500 ? 'muySeca' : mm < 1000 ? 'seca' : mm < 1500 ? 'moderada' : mm < 2500 ? 'lluviosa' : 'muyLluviosa'
// Índice de aridez = lluvia ÷ ET₀ (≥ 1 húmedo; 0,65 es el límite clásico de las tierras secas).
const clasAgua = (ai?: number) => (ai == null ? null : ai >= 1 ? 'sobra' : ai >= 0.65 ? 'justa' : 'falta')
const clasPendiente = (g?: number) =>
  g == null ? null : g < 3 ? 'plano' : g < 8 ? 'suave' : g < 15 ? 'inclinado' : g < 30 ? 'muyInclinado' : 'escarpado'
const clasVerdor = (v?: number) => (v == null ? null : v < 0.2 ? 'desnudo' : v < 0.4 ? 'poca' : v < 0.6 ? 'moderada' : 'densa')
const clasAptitud = (s: number) => (s >= 0.8 ? 'muyBuena' : s >= 0.6 ? 'buena' : s >= 0.4 ? 'regular' : 'dificil')

type Tono = 'bien' | 'atento' | 'neutro'
const TONO: Record<Tono, string> = {
  bien: 'bg-pradera/20 text-pradera-osc',
  atento: 'bg-papa-suave text-papa-osc',
  neutro: 'bg-niebla text-bosque',
}

function useNums() {
  const { i18n } = useTranslation()
  const lang = i18n.resolvedLanguage === 'es' ? 'es-CO' : 'en-US'
  const n = (v: number | undefined | null, d = 0) =>
    v === undefined || v === null || Number.isNaN(v) ? null : v.toLocaleString(lang, { maximumFractionDigits: d, minimumFractionDigits: d })
  const mesLargo = (i: number) => new Intl.DateTimeFormat(lang, { month: 'long' }).format(new Date(2026, i, 15))
  const mes = (abbr?: string) => {
    const i = abbr ? MESES_ES.indexOf(abbr.toLowerCase().slice(0, 3)) : -1
    return i < 0 ? abbr : mesLargo(i)
  }
  const meses = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(lang, { month: 'short' }).format(new Date(2026, i, 15)))
  const fecha = (iso?: string) => (iso ? new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(new Date(iso)) : null)
  return { n, mes, mesLargo, meses, fecha }
}

/** Notas del motor de rotaciones → etiquetas cortas en lenguaje sencillo. */
function etiquetasRotacion(notes: string[] | string) {
  const out: { k: string; ok: boolean; crop?: string }[] = []
  for (const nota of Array.isArray(notes) ? notes : [notes]) {
    const s = nota.toLowerCase()
    if (s.startsWith('no repite')) out.push({ k: 'corta', ok: true })
    else if (s.startsWith('repite')) out.push({ k: 'repite', ok: false })
    else if (s.startsWith('incluye una leguminosa')) out.push({ k: 'leguminosa', ok: true })
    else if (s.startsWith('sin leguminosa')) out.push({ k: 'sinLeguminosa', ok: false })
    else if (s.startsWith('cultivo limitante')) out.push({ k: 'limitante', ok: false, crop: nota.split(':')[1]?.split('(')[0].trim() })
    else if (s.startsWith('poco confiable')) out.push({ k: 'variable', ok: false })
  }
  return out
}

/* ───────── Piezas visuales ───────── */
// El ícono queda opcional y no se pinta: los títulos en Young Serif bastan (menos íconos, más claro).
function Bloque({ title, lead, children }: { icon?: ReactNode; title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="border-t border-borde pt-5 @3xl:rounded-tarjeta @3xl:border-0 @3xl:bg-crema @3xl:p-5">
      <h3 className="text-2xl text-bosque">{title}</h3>
      {lead && <p className="mt-1 text-sm text-gris">{lead}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Ficha({
  label,
  value,
  word,
  tono = 'neutro',
  note,
  wide,
  children,
}: {
  label: string
  value?: string | null
  word?: string | null
  tono?: Tono
  note?: string
  wide?: boolean
  children?: ReactNode
}) {
  const sin = useDict().analisis.noData
  return (
    <div className={`rounded-tarjeta bg-crema p-4 @3xl:bg-papel ${wide ? 'col-span-2' : ''}`}>
      <p className="text-sm font-semibold text-gris">{label}</p>
      {value !== undefined && (
        <p className={`cifra mt-1 text-xl leading-tight font-bold ${value === null ? 'text-gris' : 'text-bosque'}`}>{value ?? sin}</p>
      )}
      {word && <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${TONO[tono]}`}>{word}</span>}
      {note && <p className="mt-2 text-sm text-tinta">{note}</p>}
      {children}
    </div>
  )
}

function Fila({ label, value }: { label: string; value: string | null }) {
  if (value === null) return null
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-gris">{label}</dt>
      <dd className="cifra text-right font-bold whitespace-nowrap text-bosque">{value}</dd>
    </div>
  )
}

/* ───────── Panel ───────── */
export function AnalysisPanel({
  estado,
  areaM2,
}: {
  estado: ReturnType<typeof useAnalisis>
  areaM2?: number
}) {
  const t = useDict().analisis
  const { datos, cargando, cargandoArea, inicio, error, reintentar } = estado
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    if (!cargando) return
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [cargando])

  if (error && !datos)
    return (
      <div className="rounded-tarjeta bg-arcilla-suave p-5">
        <p className="font-semibold text-arcilla">{t.errors[error]}</p>
        <button onClick={reintentar} className="mt-3 inline-flex items-center gap-2 rounded-full bg-bosque px-5 py-2.5 font-bold text-crema">
          <ArrowClockwise size={18} weight="bold" aria-hidden />
          {t.retry}
        </button>
      </div>
    )

  if (!datos)
    return (
      <div className="flex items-start gap-4 rounded-tarjeta bg-niebla p-5" role="status">
        <img src="/brand/potatonaut-128.webp" alt="" className="h-14 w-auto animate-bounce [animation-duration:2s]" />
        <div>
          <p className="font-bold text-bosque">
            {t.loading}
            {inicio && <span className="cifra ml-2 text-gris">{Math.round((ahora - inicio) / 1000)} {t.seconds}</span>}
          </p>
          <p className="mt-1 text-sm text-gris">{t.loadingNew}</p>
        </div>
      </div>
    )

  return <Resultado a={datos} areaM2={areaM2} cargandoArea={cargandoArea} />
}

function Resultado({ a, areaM2, cargandoArea }: { a: Analisis; areaM2?: number; cargandoArea: boolean }) {
  const t = useDict().analisis
  const { n, mes, fecha } = useNums()
  const [cultivos, setCultivos] = useState<Record<string, Cultivo>>({})
  useEffect(() => {
    getCultivos()
      .then((cs) => setCultivos(Object.fromEntries(cs.map((c) => [c.id, c]))))
      .catch(() => undefined)
  }, [])
  const nombre = (id: string) => cap(cultivos[id]?.name_es ?? id)

  const c = a.clima
  const lluviaRep = c?.rain_range_mm ? (c.rain_range_mm[0] + c.rain_range_mm[1]) / 2 : c?.rain_mm_yr
  const kTemp = clasTemp(c?.tmean_c)
  const kLluvia = clasLluvia(lluviaRep)
  const kAgua = clasAgua(c?.aridity)
  const top = a.cultivosTop[0]
  const actualizado = fecha(a.meta?.generado_en)

  const lluvia = c?.rain_range_mm
    ? `${n(c.rain_range_mm[0])} – ${n(c.rain_range_mm[1])} mm`
    : n(c?.rain_mm_yr) && `${n(c?.rain_mm_yr)} mm`

  const ter = a.terreno
  const kPend = clasPendiente(ter?.pendiente_grados?.media)
  const ndvi = a.vegetacionFinca?.ndvi_sentinel2_10m?.media ?? a.vegetacionFinca?.ndvi_modis_250m?.media
  const kVerdor = clasVerdor(ndvi)

  return (
    // En pantallas anchas la ficha se reparte en columnas (consultas de contenedor del panel).
    <div className="grid items-start gap-5 @3xl:grid-cols-2 @6xl:grid-cols-3">
      {/* En pocas palabras */}
      <section className="relative overflow-hidden rounded-tarjeta bg-bosque p-5 text-crema">
        <div aria-hidden className="absolute -top-10 -right-10 size-32 rounded-full bg-pradera/25" />
        <div className="relative flex items-start gap-4">
          <img src="/brand/potatonaut-128.webp" alt="" className="h-16 w-auto shrink-0" />
          <div>
            <p className="text-xs font-bold tracking-wide text-casco uppercase">{t.summaryTitle}</p>
            {kTemp && kLluvia && (
              <p className="mt-1 font-display text-2xl leading-tight">
                {cap(fill(t.summaryZone, { temp: t.tempZone[kTemp], rain: t.rainZone[kLluvia] }))}
              </p>
            )}
            <div className="mt-2 space-y-1 text-crema/90">
              {top && (
                <p>
                  {fill(t.summaryCrop, { crop: nombre(top.id) })}
                  {top.best_month && ` ${fill(t.summaryMonth, { mes: mes(top.best_month) })}`}
                </p>
              )}
              {kAgua && <p>{t.waterText[kAgua]}</p>}
            </div>
          </div>
        </div>
        {actualizado && (
          <p className="relative mt-4 flex items-center gap-1.5 text-sm text-casco">
            <CalendarBlank size={16} weight="bold" aria-hidden />
            {fill(t.updated, { fecha: actualizado })}
          </p>
        )}
      </section>

      {/* Clima */}
      <Bloque icon={<CloudRain size={22} weight="duotone" className="text-cielo-osc" />} title={t.climateTitle} lead={t.climateLead}>
        <div className="grid grid-cols-2 gap-3">
          <Ficha
            label={t.tmean}
            value={n(c?.tmean_c, 1) && `${n(c?.tmean_c, 1)} °C`}
            word={kTemp && t.tempWord[kTemp]}
            wide={a.elevM === undefined || !!ter}
          />
          {a.elevM !== undefined && !ter && <Ficha label={t.altitude} value={n(a.elevM) && `${n(a.elevM)} ${t.altitudeUnit}`} />}
          <Ficha label={t.rain} value={lluvia ?? null} word={kLluvia && t.rainWord[kLluvia]} tono="neutro" wide />
          {kAgua && (
            <Ficha
              label={t.water}
              word={t.waterWord[kAgua]}
              tono={kAgua === 'sobra' ? 'bien' : 'atento'}
              note={t.waterText[kAgua]}
              wide
            />
          )}
        </div>
      </Bloque>

      {/* Dentro de la parcela */}
      {(ter || cargandoArea) && (
        <Bloque icon={<Mountains size={22} weight="duotone" className="text-papa-osc" />} title={t.insideTitle} lead={t.insideLead}>
          {cargandoArea && !ter ? (
            <p className="text-sm text-gris">{t.loadingArea}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Ficha
                label={t.elevationAvg}
                value={n(ter?.elevacion_m?.media) && `${n(ter?.elevacion_m?.media)} m`}
                note={
                  ter?.elevacion_m?.min != null && ter.elevacion_m.max != null
                    ? fill(t.elevationRange, { min: n(ter.elevacion_m.min), max: n(ter.elevacion_m.max) })
                    : undefined
                }
              />
              <Ficha
                label={t.slope}
                value={kPend ? t.slopeWord[kPend] : null}
                word={n(ter?.pendiente_grados?.media, 0) && `${n(ter?.pendiente_grados?.media, 0)}°`}
                tono={kPend === 'muyInclinado' || kPend === 'escarpado' ? 'atento' : 'neutro'}
              />
              {kVerdor && ndvi != null && (
                <Ficha label={t.green} value={t.greenWord[kVerdor]} wide>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-niebla" aria-hidden>
                    <div
                      className="h-full rounded-full bg-linear-to-r from-papa to-pradera"
                      style={{ width: `${Math.max(4, Math.min(100, ndvi * 100))}%` }}
                    />
                  </div>
                </Ficha>
              )}
              {(kPend === 'muyInclinado' || kPend === 'escarpado') && (
                <p className="col-span-2 flex items-start gap-2 rounded-tarjeta bg-papa-suave p-3 text-sm text-papa-osc">
                  {t.slopeTip}
                </p>
              )}
            </div>
          )}
        </Bloque>
      )}

      {/* Cultivos */}
      {a.cultivosTop.length > 0 && (
        <Bloque icon={<Plant size={22} weight="duotone" className="text-pradera-osc" />} title={t.cropsTitle} lead={t.cropsLead}>
          <ul className="space-y-4">
            {a.cultivosTop.map((cr) => {
              const k = clasAptitud(cr.suit)
              return (
                <li key={cr.id}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-bosque">{nombre(cr.id)}</span>
                    <span className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TONO[k === 'muyBuena' || k === 'buena' ? 'bien' : k === 'regular' ? 'neutro' : 'atento']}`}>
                        {t.suitWord[k]}
                      </span>
                      <span className="cifra font-bold text-bosque">{n(cr.suit * 100)} %</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-niebla" aria-hidden>
                    <div className="h-full rounded-full bg-pradera" style={{ width: `${Math.round(cr.suit * 100)}%` }} />
                  </div>
                  <p className="mt-1.5 text-sm text-gris">
                    {[cr.best_month && fill(t.bestMonth, { mes: mes(cr.best_month) }), cr.limits && (t.limits[cr.limits] ?? cr.limits)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </li>
              )
            })}
          </ul>
        </Bloque>
      )}

      {/* Rotaciones */}
      {a.rotaciones.length > 0 && (
        <Bloque icon={<ArrowsClockwise size={22} weight="duotone" className="text-cielo-osc" />} title={t.rotationsTitle} lead={t.rotationsLead}>
          <ol className="space-y-3">
            {a.rotaciones.slice(0, 3).map((r, i) => (
              <li key={r.name} className={`rounded-tarjeta p-4 ${i === 0 ? 'bg-niebla ring-2 ring-pradera/60' : 'bg-crema @3xl:bg-papel'}`}>
                {i === 0 && (
                  <span className="mb-2 inline-block rounded-full bg-pradera px-2.5 py-0.5 text-xs font-bold text-bosque">{t.rotationBest}</span>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  {r.seq.map((id, j) => (
                    <span key={id + j} className="flex items-center gap-1.5">
                      {j > 0 && <ArrowRight size={14} weight="bold" className="text-gris" aria-hidden />}
                      <span className="rounded-full bg-papel px-3 py-1 text-sm font-bold text-bosque shadow-suave">
                        <span className="sr-only">{fill(t.rotationSeason, { n: j + 1 })}: </span>
                        {nombre(id)}
                      </span>
                    </span>
                  ))}
                </div>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {etiquetasRotacion(r.notes).map((e) => (
                    <li
                      key={e.k}
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${TONO[e.ok ? 'bien' : 'atento']}`}
                    >
                      {fill(t.rotationTags[e.k], { crop: e.crop ? nombre(e.crop) : '' })}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Bloque>
      )}

      {a.mensual && <Mensual mensual={a.mensual} estado={a.estadoCapas} />}

      <SaberMas a={a} areaM2={areaM2} nombre={nombre} />
    </div>
  )
}

/* ───────── Mes a mes ───────── */
function Mensual({ mensual, estado }: { mensual: Record<string, (number | null)[]>; estado?: Record<string, string> }) {
  const t = useDict().analisis
  const { meses, mesLargo, n } = useNums()
  const capas = (['rain_imerg', 'ndvi', 'sm_surf', 'lst_c'] as const).filter((k) => mensual[k] && estado?.[k] !== 'error')
  const [capa, setCapa] = useState<string>(capas[0] ?? 'rain_imerg')
  if (capas.length === 0) return null
  const valores = mensual[capa] ?? []
  const unidad = t.monthlyUnits[capa]
  const color = capa === 'rain_imerg' ? '#3C9CB4' : capa === 'ndvi' ? '#7AB22A' : capa === 'sm_surf' ? '#1D6F84' : '#E49C54'
  const dec = capa === 'rain_imerg' ? 0 : capa === 'lst_c' ? 1 : 2

  // Mes más alto y más bajo (ignorando meses sin dato) para la frase de lectura rápida.
  const validos = valores.map((v, i) => [v, i] as const).filter((x): x is readonly [number, number] => x[0] !== null)
  const alto = validos.length ? validos.reduce((m, x) => (x[0] > m[0] ? x : m)) : null
  const bajo = validos.length ? validos.reduce((m, x) => (x[0] < m[0] ? x : m)) : null

  const data = {
    labels: meses,
    datasets: [{ data: valores, backgroundColor: color, borderColor: color, borderRadius: 6, fill: true, tension: 0.35, pointRadius: 3 }],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        callbacks: { label: (ctx: { parsed: { y: number | null } }) => `${n(ctx.parsed.y, dec) ?? '–'}${unidad ? ` ${unidad}` : ''}` },
      },
    },
    scales: { x: { grid: { display: false } }, y: { grid: { color: '#EFE7DF' }, beginAtZero: capa === 'rain_imerg' } },
  }
  return (
    <Bloque icon={<Leaf size={22} weight="duotone" className="text-pradera-osc" />} title={t.monthlyTitle} lead={t.monthlyLead}>
      <div className="flex flex-wrap gap-2" role="tablist">
        {capas.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={capa === k}
            onClick={() => setCapa(k)}
            className={`rounded-chip px-3 py-1.5 text-sm font-bold transition ${capa === k ? 'bg-bosque text-crema' : 'bg-niebla text-bosque'}`}
          >
            {t.monthlyLayers[k]}
          </button>
        ))}
      </div>
      {alto && bajo && alto[1] !== bajo[1] && (
        <p className="mt-3 font-semibold text-bosque">{fill(t.monthlyTake[capa], { alto: mesLargo(alto[1]), bajo: mesLargo(bajo[1]) })}</p>
      )}
      <div className="mt-3 h-48">
        {capa === 'rain_imerg' ? (
          <Bar data={data} options={options} aria-label={t.monthlyLayers[capa]} />
        ) : (
          <Line data={{ ...data, datasets: [{ ...data.datasets[0], backgroundColor: color + '33' }] }} options={options} aria-label={t.monthlyLayers[capa]} />
        )}
      </div>
    </Bloque>
  )
}

/* ───────── Saber más: cifras técnicas, método, fuentes y fechas ───────── */
function SaberMas({ a, areaM2, nombre }: { a: Analisis; areaM2?: number; nombre: (id: string) => string }) {
  const m = useDict().analisis.more
  const { n, fecha } = useNums()
  const c = a.clima
  const ter = a.terreno
  const veg = a.vegetacionFinca
  const escala = partesEnCeldaPower(areaM2 ?? 0, [a.centro.lon, a.centro.lat])
  const mm = (v?: number) => n(v) && `${n(v)} mm`

  const fuentes: [string, string][] = [
    ...Object.entries(a.procedencia).filter(([k]) => k !== 'note'),
    ['rain_imerg', 'NASA GPM IMERG (0,1°)'],
    ['crops', `FAO EcoCrop${a.meta?.proc_version ? ` · Groundy ${a.meta.proc_version}` : ''}`],
    ...Object.entries(a.resolucion),
  ]

  return (
    <details className="group col-span-full rounded-tarjeta border border-borde bg-papel">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <Info size={24} weight="duotone" className="shrink-0 text-cielo-osc" aria-hidden />
        <span className="flex-1">
          <span className="block font-bold text-bosque">{m.title}</span>
          <span className="block text-sm text-gris">{m.lead}</span>
        </span>
        <CaretDown size={20} weight="bold" className="shrink-0 text-gris transition group-open:rotate-180" aria-hidden />
      </summary>

      <div className="space-y-5 border-t border-borde px-4 pt-4 pb-5 text-sm">
        <div>
          <h4 className="font-sans font-bold text-bosque">{m.numbersTitle}</h4>
          <dl className="mt-1 divide-y divide-borde">
            <Fila label={m.rainPower} value={mm(c?.rain_mm_yr)} />
            <Fila label={m.rainImerg} value={mm(c?.rain_imerg_mm_yr)} />
            <Fila label={m.et0} value={mm(c?.et0_mm_yr)} />
            <Fila label={m.aridity} value={n(c?.aridity, 2)} />
            <Fila label={m.elevPoint} value={n(a.elevM) && `${n(a.elevM)} m`} />
            <Fila label={m.slopeDeg} value={n(ter?.pendiente_grados?.media, 1) && `${n(ter?.pendiente_grados?.media, 1)}°`} />
            <Fila
              label={m.slopeRange}
              value={
                ter?.pendiente_grados?.min != null && ter.pendiente_grados.max != null
                  ? `${n(ter.pendiente_grados.min)}° – ${n(ter.pendiente_grados.max)}°`
                  : null
              }
            />
            <Fila label={m.ndviS2} value={n(veg?.ndvi_sentinel2_10m?.media, 2)} />
            <Fila label={m.ndviModis} value={n(veg?.ndvi_modis_250m?.media, 2)} />
            {a.rotaciones.slice(0, 3).map((r) => (
              <Fila key={r.name} label={fill(m.rotScore, { seq: r.seq.map(nombre).join(' → ') })} value={`${n(r.score, 0)} / 100`} />
            ))}
            {a.confianza && <Fila label={m.confidence} value={m.confidenceLevels[a.confianza] ?? a.confianza} />}
          </dl>
          {c?.rain_range_mm && <p className="mt-2 text-gris">{m.rainRange}</p>}
        </div>

        <div>
          <h4 className="font-sans font-bold text-bosque">{m.methodTitle}</h4>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-tinta">
            <li>{fill(areaM2 ? m.methodScalePlot : m.methodScalePoint, { km: n(escala.cellKm2), n: n(escala.partes) })}</li>
            <li>{m.methodWords}</li>
            <li>{m.methodSuit}</li>
            {a.rotaciones.length > 0 && <li>{m.methodRot}</li>}
            {a.mensual && <li>{m.methodMonthly}</li>}
          </ul>
        </div>

        <div>
          <h4 className="font-sans font-bold text-bosque">{m.sourcesTitle}</h4>
          <dl className="mt-1 divide-y divide-borde">
            {fuentes.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 py-2">
                <dt className="text-gris">{m.sourceLabels[k] ?? cap(k.replace(/_/g, ' '))}</dt>
                <dd className="text-right font-semibold text-bosque">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {a.meta && (
          <div>
            <h4 className="font-sans font-bold text-bosque">{m.resultTitle}</h4>
            <dl className="mt-1 divide-y divide-borde">
              <Fila label={m.computed} value={fecha(a.meta.generado_en)} />
              <Fila label={m.validUntil} value={fecha(a.meta.vigencia_hasta)} />
              <Fila label={m.origin} value={a.meta.fuente ? (a.meta.fuente === 'cache' ? m.fromCache : m.fromLive) : null} />
              <Fila label={m.version} value={a.meta.proc_version ?? null} />
            </dl>
          </div>
        )}
      </div>
    </details>
  )
}
