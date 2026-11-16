import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  Polygon,
  CalendarCheck,
  Plant,
  MagnifyingGlass,
  SealCheck,
  WifiSlash,
  Planet,
  Cpu,
  DeviceMobile,
  ArrowRight,
  X,
  ListMagnifyingGlass,
} from '@phosphor-icons/react'
import { useDict } from '../../i18n/useDict'
import type { ClaveEscala } from './MapaEscala'

const contenedor = 'mx-auto w-full max-w-6xl px-5 md:px-8'


/* ───────────── Globo 3D: las variables de la NASA ───────────── */
// Three.js pesa: el globo se descarga solo cuando la sección se acerca a la pantalla.
const Globo = lazy(() => import('./Globo'))

function useCerca<T extends Element>() {
  const ref = useRef<T>(null)
  const [cerca, setCerca] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || cerca) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setCerca(true), { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [cerca])
  return { ref, cerca }
}

export function GlobeSection() {
  const d = useDict().globe
  const { ref, cerca } = useCerca<HTMLDivElement>()
  const cabecera = (
    <>
      <h2 className="text-3xl md:text-[2.75rem]">{d.title}</h2>
      <p className="mt-4 max-w-md text-lg text-gris">{d.lead}</p>
    </>
  )
  // Mientras llega Three.js se reserva el mismo espacio para que la página no salte.
  const espera = (
    <div className="grid items-center gap-x-14 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div>{cabecera}</div>
      <div className="mx-auto aspect-square w-full max-w-[min(38rem,calc(100svh-9rem))]" aria-hidden />
    </div>
  )
  return (
    <section ref={ref} className={`${contenedor} flex flex-col justify-center py-14 md:py-16 lg:min-h-svh`}>
      {cerca ? <Suspense fallback={espera}>{<Globo cabecera={cabecera} />}</Suspense> : espera}
    </section>
  )
}

/* ───────────── Edge: el motor en la finca (Orange Pi 5B) ───────────── */
export function EdgeSection() {
  const d = useDict().edge
  const pasos = [
    { Icon: Planet, label: d.flow[0] },
    { Icon: Cpu, label: d.flow[1] },
    { Icon: DeviceMobile, label: d.flow[2] },
  ]
  return (
    <section className="bg-niebla py-20 md:py-32">
      <div className={`${contenedor} grid items-center gap-12 md:grid-cols-2 md:gap-16`}>
        <div className="relative">
          <div aria-hidden className="absolute inset-x-8 inset-y-2 rounded-full bg-papel" />
          <img
            src="/brand/orange-pi-5b-960.webp"
            srcSet="/brand/orange-pi-5b-480.webp 480w, /brand/orange-pi-5b-960.webp 960w"
            sizes="(min-width: 768px) 32rem, 90vw"
            width={960}
            height={767}
            alt="Orange Pi 5B"
            loading="lazy"
            className="relative mx-auto h-auto w-full max-w-lg drop-shadow-[0_30px_30px_rgb(14_59_35/0.25)]"
          />
        </div>
        <div>
          <h2 className="text-3xl md:text-[2.75rem]">{d.title}</h2>
          <p className="mt-5 max-w-lg text-lg text-gris">{d.text}</p>
        </div>
      </div>
      <ol className={`${contenedor} mt-16 flex flex-col items-center gap-4 md:mt-20 md:flex-row md:justify-center md:gap-6`}>
        {pasos.map(({ Icon, label }, i) => (
          <li key={label} className="flex flex-col items-center gap-4 md:flex-row md:gap-6">
            {i > 0 && <ArrowRight size={28} weight="bold" className="rotate-90 text-pradera md:rotate-0" aria-hidden />}
            <span className="flex items-center gap-3 rounded-full bg-papel py-2.5 pr-6 pl-2.5 shadow-suave">
              <span className={`grid size-12 place-items-center rounded-full ${i === 1 ? 'bg-papa text-bosque' : 'bg-bosque text-crema'}`}>
                <Icon size={24} weight="duotone" aria-hidden />
              </span>
              <span className="font-bold whitespace-nowrap text-bosque">{label}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ───────────── La plataforma ───────────── */
export function Platform() {
  const d = useDict()
  const iconos = [Polygon, CalendarCheck, Plant, MagnifyingGlass, SealCheck, WifiSlash]
  return (
    <section className="relative bg-papel py-16 md:py-24">
      <div className={contenedor}>
        <h2 className="max-w-2xl text-3xl md:text-[2.75rem]">{d.platform.title}</h2>
        <ul className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {d.platform.items.map((it, i) => {
            const Icon = iconos[i]
            return (
              <li key={it.title}>
                <Icon size={34} weight="duotone" className="text-pradera-osc" aria-hidden />
                <h3 className="mt-3 font-sans text-xl font-bold text-bosque">{it.title}</h3>
                <p className="mt-1.5 text-gris">{it.text}</p>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

/* ───────────── Lupa de escala (el elemento memorable) ───────────── */
// MapLibre pesa: el mapa satelital se descarga solo cuando la sección se acerca a la pantalla.
const MapaEscala = lazy(() => import('./MapaEscala'))
const ORDEN: ClaveEscala[] = ['s2', 'plot', 'modis', 'smap', 'imerg', 'power']

export function ScaleLens() {
  const d = useDict()
  const [sel, setSel] = useState<ClaveEscala>('s2')
  const info = d.scale.items[sel]
  const { ref, cerca } = useCerca<HTMLElement>()
  return (
    <section ref={ref} id="datos" className="relative scroll-mt-24 overflow-hidden bg-bosque py-16 text-crema md:py-24">
      <div className={`${contenedor} grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]`}>
        <div>
          <h2 className="text-3xl text-crema md:text-[2.75rem]">{d.scale.title}</h2>
          <p className="mt-4 text-lg text-crema/85">{d.scale.lead}</p>
          <p className="mt-8 text-sm font-bold text-papa">{d.scale.hint}</p>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={d.scale.hint}>
            {ORDEN.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={sel === k}
                onClick={() => setSel(k)}
                className={`rounded-chip px-3.5 py-2 text-sm font-bold transition ${
                  sel === k ? 'bg-papa text-bosque' : 'bg-white/10 text-crema hover:bg-white/20'
                }`}
              >
                {d.scale.items[k].label}
              </button>
            ))}
          </div>
          <div className="mt-6 min-h-24 rounded-tarjeta bg-white/8 p-5" aria-live="polite">
            <p className="font-bold">
              {info.label} · <span className="cifra text-papa">{info.size}</span>
            </p>
            <p className="mt-1 text-crema/85">{info.text}</p>
          </div>
          <EspecificacionesFuentes />
        </div>

        <figure className="w-full">
          <div className="relative h-[min(34rem,72svh)] min-h-80 overflow-hidden rounded-hoja bg-bosque-700 shadow-flota ring-1 ring-white/10">
            {cerca && (
              <Suspense fallback={null}>
                <MapaEscala sel={sel} etiqueta={sel === 'plot' ? info.label : `${d.scale.cell}: ${info.size}`} />
              </Suspense>
            )}
          </div>
          <figcaption className="mt-3 text-sm text-crema/70">{d.scale.note}</figcaption>
        </figure>
      </div>
    </section>
  )
}

/* ───────────── Datos NASA ───────────── */
// Color por lo que mide cada fuente (la identidad también va escrita: nunca solo el color).
const COLOR_CAT: Record<string, string> = {
  clima: '#1D6F84',
  lluvia: '#3C9CB4',
  verdor: '#7AB22A',
  calor: '#E49C54',
  humedad: '#0E3B23',
  relieve: '#9A5A1C',
}
const L_MIN = Math.log10(5)
const L_MAX = Math.log10(100_000)
const posRes = (m: number) => ((Math.log10(m) - L_MIN) / (L_MAX - L_MIN)) * 100
/** «0,5° × 0,625° (~55 × 69 km)» → «~55 km»; el resto queda igual. */
const resCorta = (r: string) => {
  const m = /\(~?([\d.,]+)[^)]*?(km|m)\)/.exec(r)
  return m ? `~${m[1]} ${m[2]}` : r
}

/** Botón de la lupa de escala que abre, en una ventana aparte, el detalle técnico de las fuentes (antes iba en el inicio). */
function EspecificacionesFuentes() {
  const d = useDict()
  const dlg = useRef<HTMLDialogElement>(null)
  return (
    <>
      <button
        type="button"
        onClick={() => dlg.current?.showModal()}
        className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-5 py-3 font-bold text-crema transition hover:bg-white/20"
      >
        <ListMagnifyingGlass size={20} weight="bold" aria-hidden />
        {d.data.open}
      </button>
      <dialog
        ref={dlg}
        onClick={(e) => e.target === dlg.current && dlg.current?.close()}
        className="m-auto max-h-[90svh] w-[min(72rem,calc(100%-1.5rem))] overflow-y-auto overscroll-contain rounded-hoja bg-crema p-5 text-tinta shadow-flota backdrop:bg-bosque/60 md:p-10"
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => dlg.current?.close()}
            aria-label={d.mapa.close}
            className="grid size-11 place-items-center rounded-full bg-niebla text-bosque"
          >
            <X size={20} weight="bold" />
          </button>
        </div>
        <DataSources />
      </dialog>
    </>
  )
}

function DataSources() {
  const d = useDict()
  const t = d.data
  const [volteada, setVolteada] = useState<string | null>(null)
  const fuentes = [...t.rows].sort((a, b) => a.metros - b.metros)
  const parcela = posRes(100)

  return (
    <section>
      <h2 className="max-w-2xl text-3xl md:text-[2.75rem]">{t.title}</h2>
      <p className="mt-4 max-w-2xl text-lg text-gris">{t.lead}</p>

      {/* Regla de distancias: dónde «mira» cada satélite, frente al tamaño de una parcela */}
      <div className="mt-10 rounded-hoja bg-papel p-6 shadow-suave md:p-8">
        <h3 className="font-sans text-xl font-bold text-tinta">{t.scaleTitle}</h3>
        <p className="mt-1 text-gris">{t.scaleLead}</p>

        {/* Escritorio: regla horizontal */}
        <div className="relative mt-8 hidden h-72 md:block" role="img" aria-label={fuentes.map((f) => `${f.source}: ${f.res}`).join(', ')}>
          <div className="absolute inset-y-0 left-0 rounded-l-[1.25rem] bg-brote" style={{ width: `${parcela}%` }} />
          <div className="absolute inset-y-0 right-0 rounded-r-[1.25rem] bg-agua" style={{ left: `${parcela}%` }} />
          <span className="absolute top-3 left-4 text-sm font-bold text-pradera-osc">← {t.near}</span>
          <span className="absolute top-3 right-4 text-sm font-bold text-cielo-osc">{t.far} →</span>
          {/* Eje */}
          <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gris/30" />
          {[10, 100, 1000, 10000, 100000].map((m) => (
            <span
              key={m}
              className={`absolute bottom-2 text-xs font-semibold whitespace-nowrap text-gris ${m === 100000 ? '-translate-x-[110%]' : '-translate-x-1/2'}`}
              style={{ left: `${posRes(m)}%` }}
            >
              {m >= 1000 ? `${m / 1000} km` : `${m} m`}
            </span>
          ))}
          {/* Tamaño de una parcela */}
          <div className="absolute inset-y-6 border-l-2 border-dashed border-bosque/50" style={{ left: `${parcela}%` }} />
          <span className="absolute bottom-7 ml-2 rounded-full bg-papel px-2.5 py-0.5 text-xs font-bold text-bosque shadow-suave" style={{ left: `${parcela}%` }}>
            {t.plotMark}
          </span>
          {/* Fuentes */}
          {fuentes.map((f, i) => {
            const x = posRes(f.metros)
            const arriba = i % 2 === 0
            const alinear = x > 85 ? '-translate-x-full' : x < 10 ? '' : '-translate-x-1/2'
            return (
              <div key={f.source} className="absolute top-1/2" style={{ left: `${x}%` }}>
                <span className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-papel" style={{ background: COLOR_CAT[f.cat] }} />
                <span className={`absolute w-px bg-gris/40 ${arriba ? 'bottom-2 h-9' : 'top-2 h-9'}`} />
                <span
                  className={`absolute rounded-2xl bg-papel px-3 py-1.5 whitespace-nowrap shadow-suave ${alinear} ${arriba ? 'bottom-11' : 'top-11'}`}
                >
                  <span className="block text-sm font-bold text-tinta">{f.source}</span>
                  <span className="block text-xs text-gris">
                    {t.cats[f.cat]} · <span className="font-bold text-tinta">{resCorta(f.res)}</span>
                  </span>
                </span>
              </div>
            )
          })}
        </div>

        {/* Móvil: barras en la misma escala */}
        <ul className="mt-6 space-y-3 md:hidden">
          {fuentes.map((f) => (
            <li key={f.source}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-bold text-tinta">{f.source}</span>
                <span className="font-semibold text-tinta">{resCorta(f.res)}</span>
              </div>
              <div className="mt-1 h-2.5 rounded-full bg-niebla">
                <div className="h-full rounded-full" style={{ width: `${Math.max(6, posRes(f.metros))}%`, background: COLOR_CAT[f.cat] }} />
              </div>
            </li>
          ))}
          <li className="flex justify-between pt-1 text-xs font-bold">
            <span className="text-pradera-osc">← {t.near}</span>
            <span className="text-cielo-osc">{t.far} →</span>
          </li>
        </ul>
      </div>

      {/* Tarjetas cortas; al tocar, se voltean y cuentan lo que esa fuente no puede ver */}
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {t.rows.map((r) => {
          const vuelta = volteada === r.source
          return (
            <li key={r.source}>
              <button
                type="button"
                onClick={() => setVolteada(vuelta ? null : r.source)}
                aria-expanded={vuelta}
                className={`flex h-full min-h-44 w-full flex-col rounded-tarjeta p-4 text-left shadow-suave transition hover:-translate-y-0.5 sm:min-h-48 sm:p-5 ${vuelta ? 'bg-bosque text-crema' : 'bg-papel'}`}
              >
                {vuelta ? (
                  <>
                    <span className="text-xs font-bold tracking-wide text-casco uppercase">{t.cannotTitle}</span>
                    <span className="mt-2 leading-snug font-semibold sm:text-lg">{r.cannot}</span>
                    <span className="mt-auto pt-4 text-sm font-bold text-casco">← {t.back}</span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-2 text-xs font-bold tracking-wide text-gris uppercase">
                      <span className="size-2.5 rounded-full" style={{ background: COLOR_CAT[r.cat] }} aria-hidden />
                      {t.cats[r.cat]}
                    </span>
                    <span className="mt-3 font-display text-xl leading-tight text-bosque sm:text-2xl">{r.source}</span>
                    <span className="mt-1 font-semibold text-tinta">{r.short}</span>
                    {'partner' in r && r.partner && <span className="mt-1 text-xs text-gris">{t.partner}</span>}
                    <span className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-4">
                      <span className="rounded-full bg-niebla px-3 py-1 text-sm font-bold whitespace-nowrap text-bosque">{resCorta(r.res)}</span>
                      <span className="text-sm font-bold text-cielo-osc">{t.cannotBtn}</span>
                    </span>
                  </>
                )}
              </button>
            </li>
          )
        })}
        <li className="col-span-2 flex flex-col justify-end rounded-tarjeta bg-niebla p-5 text-sm text-tinta sm:col-span-1 lg:min-h-48">{t.foot}</li>
      </ul>
    </section>
  )
}

/* ───────────── Cómo funciona + lectura real ───────────── */
export function HowItWorks() {
  const d = useDict()
  const ex = d.how.example
  return (
    <section id="como" className="scroll-mt-24 bg-niebla py-16 md:py-24">
      <div className={`${contenedor} grid gap-12 lg:grid-cols-[1.1fr_0.9fr]`}>
        <div>
          <h2 className="text-3xl md:text-[2.75rem]">{d.how.title}</h2>
          <ol className="mt-10 space-y-7">
            {d.how.steps.map((s, i) => (
              <li key={s.title} className="flex gap-5">
                <span className="cifra grid size-11 shrink-0 place-items-center rounded-full bg-bosque font-display text-lg text-crema">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-sans text-lg font-bold text-bosque">{s.title}</h3>
                  <p className="text-gris">{s.text}</p>
                  {'edge' in s && s.edge && (
                    <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-pradera-osc">
                      <Cpu size={18} weight="duotone" className="mt-0.5 shrink-0" aria-hidden />
                      {s.edge}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <aside className="self-center rounded-hoja bg-papel p-7 shadow-suave md:p-8">
          <h3 className="text-2xl">{ex.title}</h3>
          <dl className="mt-6 divide-y divide-borde">
            {ex.rows.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-gris">{k}</dt>
                <dd className="cifra text-right text-lg font-bold whitespace-nowrap text-bosque">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 rounded-chip bg-casco/60 p-4 text-sm text-tinta">{ex.note}</p>
          <p className="mt-4 text-xs text-gris">{ex.source}</p>
        </aside>
      </div>
    </section>
  )
}

/* ───────────── Potatonaut ───────────── */
export function MeetPotatonaut() {
  const d = useDict()
  return (
    <section className={`${contenedor} grid items-center gap-12 py-16 md:grid-cols-[0.8fr_1.2fr] md:py-24`}>
      <div className="relative mx-auto w-60 md:w-80">
        <div aria-hidden className="absolute inset-4 rounded-full bg-casco" />
        <img
          src="/brand/potatonaut-512.webp"
          alt="Potatonaut"
          className="relative mx-auto h-auto w-4/5 drop-shadow-2xl"
          loading="lazy"
        />
      </div>
      <div>
        <h2 className="text-3xl md:text-[2.75rem]">{d.potatonaut.title}</h2>
        <p className="mt-4 max-w-2xl text-lg text-gris">{d.potatonaut.lead}</p>
        <div className="mt-8 space-y-5">
          {d.potatonaut.chat.map((c) => (
            <div key={c.q} className="space-y-2">
              <p className="ml-auto w-fit max-w-[85%] rounded-3xl rounded-br-md bg-bosque px-4 py-2.5 font-semibold text-crema">
                {c.q}
              </p>
              <div className="flex max-w-[92%] items-end gap-2">
                <img src="/brand/potatonaut-128.webp" alt="" className="size-8 shrink-0" />
                <p className="rounded-3xl rounded-bl-md bg-papel px-4 py-2.5 shadow-suave">{c.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ───────────── Equipo + llamado final ───────────── */
/** Integrantes en el orden de `d.team.members`. La foto va en /team/<foto>.webp (cuadrada); sin ella se ven las iniciales. */
const EQUIPO = [
  { nombre: 'Tania Milena Cuastuza Guaquez', foto: 'tania' },
  { nombre: 'Jhon Alvaro Cuastuza Guaquez', foto: 'jhon' },
  { nombre: 'Jean Lucas Cuasquer Criollo', foto: 'jean' },
  { nombre: 'Camilo Alexander Ceron Benavides', foto: 'camilo' },
  { nombre: 'Santiago Andres Sinza Goyes', foto: 'santiago' },
]
const FONDOS = ['bg-brote', 'bg-agua', 'bg-hoja', 'bg-niebla', 'bg-brote']

function FotoIntegrante({ nombre, foto, fondo }: { nombre: string; foto: string; fondo: string }) {
  const [falta, setFalta] = useState(false)
  const iniciales = nombre.split(' ').filter((_, i) => i === 0 || i === 2).map((p) => p[0]).join('')
  return (
    <div className={`relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-full ring-4 ring-papel shadow-suave sm:size-32 md:size-36 ${fondo}`}>
      {falta ? (
        <span aria-hidden className="font-display text-3xl text-bosque/70 sm:text-4xl">{iniciales}</span>
      ) : (
        <img src={`/team/${foto}.webp`} alt="" loading="lazy" className="size-full object-cover" onError={() => setFalta(true)} />
      )}
    </div>
  )
}

export function TeamAndCta() {
  const d = useDict()
  return (
    <section id="equipo" className={`${contenedor} scroll-mt-24 pb-20`}>
      <div className="max-w-2xl">
        <h2 className="text-3xl md:text-[2.75rem]">{d.team.title}</h2>
        <p className="mt-4 text-lg text-gris">{d.team.lead}</p>
      </div>

      <ul className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
        {EQUIPO.map((p, i) => {
          const m = d.team.members[i]
          return (
            <li key={p.foto} className="flex items-center gap-5 sm:flex-col sm:text-center">
              <FotoIntegrante nombre={p.nombre} foto={p.foto} fondo={FONDOS[i]} />
              <div className="min-w-0">
                <h3 className="font-sans text-lg leading-snug font-bold text-bosque text-balance">{p.nombre}</h3>
                <p className="mt-1 text-sm font-semibold text-pradera-osc">{m.study}</p>
                <p className="mt-2 text-sm leading-relaxed text-gris">{m.skills}</p>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="relative mt-14 overflow-hidden rounded-hoja bg-cielo px-7 py-10 md:px-12 md:py-14">
        <div aria-hidden className="absolute -right-16 -bottom-24 hidden size-72 rounded-full bg-pradera/80 sm:block" />
        <div aria-hidden className="absolute right-24 -bottom-32 hidden size-72 rounded-full bg-pradera sm:block" />
        <img
          src="/brand/potatonaut-256.webp"
          alt=""
          className="absolute right-6 bottom-6 hidden w-36 drop-shadow-xl sm:block md:right-16 md:w-44"
          loading="lazy"
        />
        <div className="relative max-w-lg">
          <h2 className="text-3xl text-white md:text-5xl">{d.cta.title}</h2>
          <p className="mt-3 text-lg font-semibold text-white">{d.cta.lead}</p>
          <Link
            to="/finca"
            className="mt-7 inline-block rounded-full bg-bosque px-7 py-3.5 font-bold text-crema shadow-flota transition hover:bg-bosque-700"
          >
            {d.cta.button}
          </Link>
        </div>
      </div>
    </section>
  )
}
