import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowClockwise, ArrowRight, CalendarBlank, CaretDown } from '@phosphor-icons/react'
import { useDict } from '../../i18n/useDict'
import { getCultivos, type Analisis, type Cultivo } from '../../lib/api'
import { partesEnCeldaPower } from '../../lib/geo'
import type { useAnalisis } from '../../data/analysis'
import { BarraZonas, CalendarioSiembra, Columnas, Comparacion, Curva, Escalones, EscalaResolucion, Gradiente, Rango } from './graficas'

/*
 * Ficha de análisis de una parcela o punto, pensada para enseñar al agricultor.
 * Panel lateral con pestañas (como las fichas de campo de las apps agrícolas profesionales):
 *   Resumen · Clima · Cultivos · Tu parcela · Fuentes
 * Cada pestaña muestra pocas cosas y en gráficos; las cifras técnicas quedan plegadas en Fuentes.
 * Las palabras (frío, lluvia abundante…) salen de umbrales fijos; ningún faltante se muestra como 0.
 */

const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fill = (s: string, v: Record<string, string | number | null | undefined>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''))
const cap = (s: string) => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s)

/* ───────── Cifras → palabras (umbrales declarados en «Fuentes») ───────── */
// Pisos térmicos de Colombia: páramo < 12 °C, frío 12–17, templado 17–24, cálido > 24.
const clasTemp = (c?: number) => (c == null ? null : c < 12 ? 'muyFrio' : c < 17 ? 'frio' : c < 24 ? 'templado' : 'calido')
// Lluvia anual: las zonas de la barra (poca < 800 · moderada < 1.600 · abundante) agrupan estas clases.
const clasLluvia = (mm?: number | null) =>
  mm == null ? null : mm < 500 ? 'muySeca' : mm < 800 ? 'seca' : mm < 1600 ? 'moderada' : mm < 2500 ? 'lluviosa' : 'muyLluviosa'
// Índice de aridez = lluvia ÷ ET₀ (≥ 1 húmedo; 0,65 es el límite clásico de las tierras secas).
const clasAgua = (ai?: number) => (ai == null ? null : ai >= 1 ? 'sobra' : ai >= 0.65 ? 'justa' : 'falta')
const PENDIENTES = ['plano', 'suave', 'inclinado', 'muyInclinado', 'escarpado'] as const
const clasPendiente = (g?: number) => (g == null ? null : g < 3 ? 0 : g < 8 ? 1 : g < 15 ? 2 : g < 30 ? 3 : 4)
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
  const indice = (abbr?: string) => (abbr ? MESES_ES.indexOf(abbr.toLowerCase().slice(0, 3)) : -1)
  const mes = (abbr?: string) => {
    const i = indice(abbr)
    return i < 0 ? abbr : mesLargo(i)
  }
  const iniciales = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(lang, { month: 'narrow' }).format(new Date(2026, i, 15)))
  const largos = Array.from({ length: 12 }, (_, i) => mesLargo(i))
  const fecha = (iso?: string) => (iso ? new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(new Date(iso)) : null)
  return { n, mes, mesLargo, indice, iniciales, largos, fecha }
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

/* ───────── Piezas ───────── */
function Tarjeta({ titulo, extra, children }: { titulo?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-tarjeta bg-crema p-4">
      {(titulo || extra) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {titulo && <h3 className="font-sans text-base font-bold text-tinta">{titulo}</h3>}
          {extra}
        </div>
      )}
      {children}
    </section>
  )
}

const Chip = ({ tono = 'neutro', children }: { tono?: Tono; children: ReactNode }) => (
  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${TONO[tono]}`}>{children}</span>
)

/* ───────── Panel ───────── */
export function AnalysisPanel({ estado, areaM2 }: { estado: ReturnType<typeof useAnalisis>; areaM2?: number }) {
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

type Pestana = 'resumen' | 'clima' | 'cultivos' | 'parcela' | 'fuentes'

function Resultado({ a, areaM2, cargandoArea }: { a: Analisis; areaM2?: number; cargandoArea: boolean }) {
  const t = useDict().analisis
  const [cultivos, setCultivos] = useState<Record<string, Cultivo>>({})
  useEffect(() => {
    getCultivos()
      .then((cs) => setCultivos(Object.fromEntries(cs.map((c) => [c.id, c]))))
      .catch(() => undefined)
  }, [])
  const nombre = (id: string) => cap(cultivos[id]?.name_es ?? id)
  const pestanas: Pestana[] = ['resumen', 'clima', 'cultivos', ...(a.terreno || cargandoArea ? (['parcela'] as Pestana[]) : []), 'fuentes']
  const [tab, setTab] = useState<Pestana>('resumen')

  return (
    <div>
      {/* Pestañas fijas arriba mientras se desliza */}
      {/* La barra ocupa también el margen interno del panel: más ancho para las pestañas sin agrandar el panel. */}
      <div className="sticky top-0 z-10 -mx-5 bg-papel px-2 pt-1 pb-3 lg:-mx-6 lg:px-2.5">
        <div role="tablist" className="flex gap-0.5 rounded-full bg-niebla p-1">
          {pestanas.map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={tab === p}
              onClick={() => setTab(p)}
              className={`min-w-0 flex-1 truncate rounded-full px-1.5 py-2 text-[0.8rem] font-bold whitespace-nowrap transition sm:text-sm ${tab === p ? 'bg-bosque text-crema shadow-suave' : 'text-bosque hover:bg-papel'}`}
            >
              {t.tabs[p]}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" className="space-y-3">
        {tab === 'resumen' && <TabResumen a={a} nombre={nombre} irA={setTab} />}
        {tab === 'clima' && <TabClima a={a} />}
        {tab === 'cultivos' && <TabCultivos a={a} nombre={nombre} />}
        {tab === 'parcela' && <TabParcela a={a} cargandoArea={cargandoArea} />}
        {tab === 'fuentes' && <TabFuentes a={a} areaM2={areaM2} nombre={nombre} />}
      </div>
    </div>
  )
}

/* ═════════ Resumen ═════════ */
function TabResumen({ a, nombre, irA }: { a: Analisis; nombre: (id: string) => string; irA: (p: Pestana) => void }) {
  const t = useDict().analisis
  const { n, mes, fecha } = useNums()
  const c = a.clima
  const lluviaRep = c?.rain_range_mm ? (c.rain_range_mm[0] + c.rain_range_mm[1]) / 2 : c?.rain_mm_yr
  const kTemp = clasTemp(c?.tmean_c)
  const kLluvia = clasLluvia(lluviaRep)
  const kAgua = clasAgua(c?.aridity)
  const top = a.cultivosTop[0]
  const actualizado = fecha(a.meta?.generado_en)
  const altura = a.terreno?.elevacion_m?.media ?? a.elevM
  const mm = (v: number) => `${n(v)} mm`
  const desde = c?.rain_range_mm?.[0] ?? c?.rain_mm_yr
  const hasta = c?.rain_range_mm?.[1] ?? c?.rain_mm_yr

  return (
    <>
      {/* En pocas palabras */}
      <section className="relative overflow-hidden rounded-tarjeta bg-bosque p-5 text-crema">
        <div aria-hidden className="absolute -top-10 -right-10 size-32 rounded-full bg-pradera/25" />
        <div className="relative flex items-start gap-4">
          <img src="/brand/potatonaut-128.webp" alt="" className="h-14 w-auto shrink-0" />
          <div>
            <p className="text-xs font-bold tracking-wide text-casco uppercase">{t.summaryTitle}</p>
            {kTemp && kLluvia && (
              <p className="mt-1 font-display text-2xl leading-tight">{cap(fill(t.summaryZone, { temp: t.tempZone[kTemp], rain: t.rainZone[kLluvia] }))}</p>
            )}
            {top && (
              <p className="mt-2 text-crema/90">
                {fill(t.summaryCrop, { crop: nombre(top.id) })}
                {top.best_month && ` ${fill(t.summaryMonth, { mes: mes(top.best_month) })}`}
              </p>
            )}
          </div>
        </div>
        {actualizado && (
          <p className="relative mt-4 flex items-center gap-1.5 text-sm text-casco">
            <CalendarBlank size={16} weight="bold" aria-hidden />
            {fill(t.updated, { fecha: actualizado })}
          </p>
        )}
      </section>

      {/* Dos cifras clave */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-tarjeta bg-crema p-4">
          <p className="text-sm text-gris">{t.kpiTemp}</p>
          <p className="mt-0.5 text-3xl font-bold text-bosque">{n(c?.tmean_c, 1) ?? '–'} °C</p>
          {kTemp && (
            <p className="mt-2">
              <Chip>{t.tempWord[kTemp]}</Chip>
            </p>
          )}
        </div>
        <div className="rounded-tarjeta bg-crema p-4">
          <p className="text-sm text-gris">{t.kpiAlt}</p>
          <p className="mt-0.5 text-3xl font-bold text-bosque">{n(altura) ?? '–'} m</p>
          <p className="mt-2 text-xs text-gris">{t.altitudeUnit}</p>
        </div>
      </div>

      {/* Lluvia del año sobre una escala */}
      {desde != null && hasta != null && (
        <Tarjeta titulo={t.rainYear} extra={kLluvia && <Chip>{t.rainWord[kLluvia]}</Chip>}>
          <p className="mb-3 text-2xl font-bold text-bosque">
            {desde === hasta ? n(desde) : `${n(desde)} – ${n(hasta)}`} <span className="text-base font-semibold text-gris">{t.rainYearUnit}</span>
          </p>
          <BarraZonas
            desde={desde}
            hasta={hasta}
            escala={3000}
            formato={mm}
            zonas={[
              { hasta: 800, nombre: t.rainZones.poca },
              { hasta: 1600, nombre: t.rainZones.moderada },
              { hasta: 3000, nombre: t.rainZones.abundante },
            ]}
          />
        </Tarjeta>
      )}

      {/* Balance de agua: lluvia frente a lo que pierde el campo */}
      {kAgua && lluviaRep != null && c?.et0_mm_yr != null && (
        <Tarjeta titulo={t.waterTitle} extra={<Chip tono={kAgua === 'sobra' ? 'bien' : 'atento'}>{t.waterWord[kAgua]}</Chip>}>
          <Comparacion
            formato={mm}
            filas={[
              { nombre: t.waterRain, valor: lluviaRep, clase: 'bg-cielo' },
              { nombre: t.waterLoss, valor: c.et0_mm_yr, clase: 'bg-papa' },
            ]}
          />
          <p className="mt-3 text-sm text-tinta">{t.waterText[kAgua]}</p>
        </Tarjeta>
      )}

      {/* Lo que mejor se da */}
      {a.cultivosTop.length > 0 && (
        <Tarjeta
          titulo={t.bestCrops}
          extra={
            <button onClick={() => irA('cultivos')} className="flex items-center gap-1 text-sm font-bold text-cielo-osc hover:underline">
              {t.seeAll}
              <ArrowRight size={14} weight="bold" aria-hidden />
            </button>
          }
        >
          <ul className="space-y-3">
            {a.cultivosTop.slice(0, 3).map((cr) => (
              <li key={cr.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-bold text-tinta">{nombre(cr.id)}</span>
                  <span className="font-bold text-tinta">{n(cr.suit * 100)} %</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-niebla">
                  <div className="h-full rounded-full bg-pradera" style={{ width: `${Math.round(cr.suit * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </>
  )
}

/* ═════════ Clima del año ═════════ */
function TabClima({ a }: { a: Analisis }) {
  const t = useDict().analisis
  const { n, iniciales, largos } = useNums()
  const m = a.mensual
  const est = a.estadoCapas
  const hoy = new Date().getMonth()
  const ok = (k: string) => !!m?.[k] && est?.[k] !== 'error' && m[k].some((v) => v !== null)

  const lectura = (k: string) => {
    const vals = (m?.[k] ?? []).map((v, i) => [v, i] as const).filter((x): x is readonly [number, number] => x[0] !== null)
    if (vals.length < 2) return null
    const alto = vals.reduce((p, x) => (x[0] > p[0] ? x : p))
    const bajo = vals.reduce((p, x) => (x[0] < p[0] ? x : p))
    return fill(t.monthlyTake[k], { alto: largos[alto[1]], bajo: largos[bajo[1]] })
  }
  const comun = { meses: iniciales, mesesLargos: largos, resaltar: hoy, etiquetaResaltado: t.thisMonth }

  const graficas: { k: string; titulo: string; nodo: ReactNode }[] = []
  if (ok('rain_imerg'))
    graficas.push({ k: 'rain_imerg', titulo: `${t.rainChart} (mm)`, nodo: <Columnas {...comun} valores={m!.rain_imerg} color="#3C9CB4" formato={(v) => `${n(v)} mm`} eje={(v) => n(v) ?? ''} /> })
  if (ok('lst_c'))
    graficas.push({ k: 'lst_c', titulo: `${t.heatChart} (°C)`, nodo: <Curva {...comun} valores={m!.lst_c} color="#E49C54" formato={(v) => `${n(v, 0)} °C`} eje={(v) => n(v, 0) ?? ''} /> })
  if (ok('sm_surf'))
    graficas.push({ k: 'sm_surf', titulo: `${t.moistChart} (%)`, nodo: <Curva {...comun} valores={m!.sm_surf} color="#1D6F84" formato={(v) => `${n(v * 100, 0)} %`} eje={(v) => n(v * 100, 0) ?? ''} /> })
  if (ok('ndvi'))
    graficas.push({ k: 'ndvi', titulo: t.greenChart, nodo: <Curva {...comun} valores={m!.ndvi} color="#3F6E12" formato={(v) => n(v, 2) ?? ''} eje={(v) => n(v, 1) ?? ''} /> })

  return (
    <>
      <p className="text-sm text-gris">
        {t.monthlyLead} {t.chartHint}
      </p>
      {graficas.length === 0 && <p className="rounded-tarjeta bg-crema p-4 text-gris">{t.noData}</p>}
      {graficas.map((g) => (
        <Tarjeta key={g.k} titulo={g.titulo}>
          {lectura(g.k) && <p className="-mt-1 mb-2 text-sm text-tinta">{lectura(g.k)}</p>}
          {g.nodo}
        </Tarjeta>
      ))}
    </>
  )
}

/* ═════════ Cultivos ═════════ */
function TabCultivos({ a, nombre }: { a: Analisis; nombre: (id: string) => string }) {
  const t = useDict().analisis
  const { n, indice, iniciales } = useNums()
  return (
    <>
      <p className="text-sm text-gris">{t.cropsLead}</p>
      {a.cultivosTop.length > 0 && (
        <Tarjeta>
          <ul className="divide-y divide-borde">
            {a.cultivosTop.map((cr) => {
              const k = clasAptitud(cr.suit)
              return (
                <li key={cr.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-tinta">{nombre(cr.id)}</span>
                    <span className="flex items-center gap-2">
                      <Chip tono={k === 'muyBuena' || k === 'buena' ? 'bien' : k === 'regular' ? 'neutro' : 'atento'}>{t.suitWord[k]}</Chip>
                      <span className="w-11 text-right font-bold text-tinta">{n(cr.suit * 100)} %</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-niebla">
                    <div className="h-full rounded-full bg-pradera" style={{ width: `${Math.round(cr.suit * 100)}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </Tarjeta>
      )}

      {a.cultivosTop.some((cr) => indice(cr.best_month) >= 0) && (
        <Tarjeta titulo={t.sowWhen}>
          <p className="-mt-1 mb-2 text-sm text-gris">{t.sowWhenLead}</p>
          <CalendarioSiembra
            meses={iniciales}
            hoy={new Date().getMonth()}
            filas={a.cultivosTop.filter((cr) => indice(cr.best_month) >= 0).map((cr) => ({ nombre: nombre(cr.id), mejor: indice(cr.best_month) }))}
          />
        </Tarjeta>
      )}

      {a.rotaciones.length > 0 && (
        <Tarjeta titulo={t.rotationsTitle}>
          <p className="-mt-1 mb-3 text-sm text-gris">{t.rotationsLead}</p>
          <ol className="space-y-2.5">
            {a.rotaciones.slice(0, 3).map((r, i) => (
              <li key={r.name} className={`rounded-[1.25rem] p-3.5 ${i === 0 ? 'bg-papel ring-2 ring-pradera/50' : 'bg-papel'}`}>
                {i === 0 && <p className="mb-2 text-xs font-bold tracking-wide text-pradera-osc uppercase">{t.rotationBest}</p>}
                <div className="flex flex-wrap items-center gap-1.5">
                  {r.seq.map((id, j) => (
                    <span key={id + j} className="flex items-center gap-1.5">
                      {j > 0 && <ArrowRight size={13} weight="bold" className="text-gris" aria-hidden />}
                      <span className="rounded-full bg-niebla px-3 py-1 text-sm font-bold text-bosque">{nombre(id)}</span>
                    </span>
                  ))}
                </div>
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {etiquetasRotacion(r.notes)
                    .slice(0, 3)
                    .map((e) => (
                      <li key={e.k}>
                        <Chip tono={e.ok ? 'bien' : 'atento'}>{fill(t.rotationTags[e.k], { crop: e.crop ? nombre(e.crop) : '' })}</Chip>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ol>
        </Tarjeta>
      )}
    </>
  )
}

/* ═════════ Tu parcela (dentro del lindero) ═════════ */
function TabParcela({ a, cargandoArea }: { a: Analisis; cargandoArea: boolean }) {
  const t = useDict().analisis
  const { n } = useNums()
  const ter = a.terreno
  if (cargandoArea && !ter) return <p className="rounded-tarjeta bg-niebla p-4 text-gris">{t.loadingArea}</p>
  const elev = ter?.elevacion_m
  const kPend = clasPendiente(ter?.pendiente_grados?.media)
  const ndvi = a.vegetacionFinca?.ndvi_sentinel2_10m?.media ?? a.vegetacionFinca?.ndvi_modis_250m?.media
  const kVerdor = clasVerdor(ndvi)
  const m = (v: number) => `${n(v)} m`
  return (
    <>
      <p className="text-sm text-gris">{t.insideLead}</p>
      {elev?.media != null && (
        <Tarjeta titulo={t.elevationAvg}>
          <p className="text-3xl font-bold text-bosque">{m(elev.media)}</p>
          {elev.min != null && elev.max != null && elev.max > elev.min && (
            <Rango min={elev.min} max={elev.max} media={elev.media} formato={m} etiquetaMedia={t.average} />
          )}
        </Tarjeta>
      )}
      {kPend !== null && (
        <Tarjeta titulo={t.slope} extra={<Chip tono={kPend >= 3 ? 'atento' : 'neutro'}>{n(ter?.pendiente_grados?.media, 0)}°</Chip>}>
          <p className="mb-3 text-2xl font-bold text-bosque">{t.slopeWord[PENDIENTES[kPend]]}</p>
          <Escalones pasos={PENDIENTES.map((p) => t.slopeWord[p])} activo={kPend} />
          {kPend >= 3 && <p className="mt-3 rounded-[1rem] bg-papa-suave p-3 text-sm text-papa-osc">{t.slopeTip}</p>}
        </Tarjeta>
      )}
      {kVerdor && ndvi != null && (
        <Tarjeta titulo={t.green}>
          <p className="mb-3 text-2xl font-bold text-bosque">{t.greenWord[kVerdor]}</p>
          <Gradiente valor={ndvi} bajo={t.greenLow} alto={t.greenHigh} />
        </Tarjeta>
      )}
    </>
  )
}

/* ═════════ Fuentes: de dónde sale cada dato, en un gráfico ═════════ */
function TabFuentes({ a, areaM2, nombre }: { a: Analisis; areaM2?: number; nombre: (id: string) => string }) {
  const t = useDict().analisis
  const m = t.more
  const { n, fecha } = useNums()
  const c = a.clima
  const ter = a.terreno
  const veg = a.vegetacionFinca
  const escala = partesEnCeldaPower(areaM2 ?? 0, [a.centro.lon, a.centro.lat])
  const mm = (v?: number) => n(v) && `${n(v)} mm`

  const filas = [
    ...(veg ? [{ nombre: 'Sentinel-2', mide: t.measures.verdor, metros: 10, etiqueta: '10 m' }] : []),
    { nombre: 'SRTM', mide: t.measures.relieve, metros: 30, etiqueta: '30 m' },
    { nombre: 'MODIS', mide: t.measures.verdor, metros: 250, etiqueta: '250 m' },
    { nombre: 'MODIS', mide: t.measures.calor, metros: 1000, etiqueta: '1 km' },
    { nombre: 'SMAP', mide: t.measures.humedad, metros: 9000, etiqueta: '9 km' },
    { nombre: 'GPM IMERG', mide: t.measures.lluvia, metros: 11000, etiqueta: '11 km' },
    { nombre: 'NASA POWER', mide: t.measures.clima, metros: 55000, etiqueta: '~55 km' },
  ]

  return (
    <>
      <Tarjeta titulo={t.sourcesLead}>
        <p className="-mt-1 mb-4 text-sm text-gris">{t.sourcesHint}</p>
        <EscalaResolucion filas={filas} izquierda={t.moreDetail} derecha={t.moreRegional} />
        <p className="mt-4 border-t border-borde pt-3 text-sm">
          <span className="font-bold text-tinta">{t.measures.aptitud}</span>
          <span className="text-gris"> · FAO EcoCrop{a.meta?.proc_version ? ` · Groundy ${a.meta.proc_version}` : ''}</span>
        </p>
      </Tarjeta>

      {a.meta?.generado_en && (
        <Tarjeta titulo={m.resultTitle}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gris">{m.computed}</dt>
              <dd className="font-bold text-tinta">{fecha(a.meta.generado_en)}</dd>
            </div>
            {a.meta.vigencia_hasta && (
              <div>
                <dt className="text-gris">{m.validUntil}</dt>
                <dd className="font-bold text-tinta">{fecha(a.meta.vigencia_hasta)}</dd>
              </div>
            )}
          </dl>
        </Tarjeta>
      )}

      {/* Para quien quiera el detalle: plegado */}
      <details className="group rounded-tarjeta bg-crema">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-bold text-tinta [&::-webkit-details-marker]:hidden">
          {t.technical}
          <CaretDown size={18} weight="bold" className="text-gris transition group-open:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-4 px-4 pb-4 text-sm">
          <dl className="divide-y divide-borde">
            {(
              [
                [m.rainPower, mm(c?.rain_mm_yr)],
                [m.rainImerg, mm(c?.rain_imerg_mm_yr)],
                [m.et0, mm(c?.et0_mm_yr)],
                [m.aridity, n(c?.aridity, 2)],
                [m.slopeDeg, n(ter?.pendiente_grados?.media, 1) && `${n(ter?.pendiente_grados?.media, 1)}°`],
                [m.ndviS2, n(veg?.ndvi_sentinel2_10m?.media, 2)],
                [m.ndviModis, n(veg?.ndvi_modis_250m?.media, 2)],
                ...a.rotaciones.slice(0, 3).map((r) => [fill(m.rotScore, { seq: r.seq.map(nombre).join(' → ') }), `${n(r.score, 0)} / 100`]),
                ...(a.confianza ? [[m.confidence, m.confidenceLevels[a.confianza] ?? a.confianza]] : []),
              ] as [string, string | null][]
            )
              .filter(([, v]) => v !== null)
              .map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 py-2">
                  <dt className="text-gris">{k}</dt>
                  <dd className="text-right font-bold whitespace-nowrap text-tinta">{v}</dd>
                </div>
              ))}
          </dl>
          <ul className="list-disc space-y-1.5 pl-5 text-gris">
            <li>{fill(areaM2 ? m.methodScalePlot : m.methodScalePoint, { km: n(escala.cellKm2), n: n(escala.partes) })}</li>
            <li>{m.methodSuit}</li>
            {a.rotaciones.length > 0 && <li>{m.methodRot}</li>}
            {c?.rain_range_mm && <li>{m.rainRange}</li>}
          </ul>
        </div>
      </details>
    </>
  )
}
