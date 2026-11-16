import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDict } from '../../i18n/useDict'
import { clavePunto, db, type Ciclo, type Parcela } from '../../data/db'
import { unificar, type Analisis, type PuntoResp } from '../../lib/api'
import { diasDesde, esActivo, indiceMes, lineaDeTiempo, useCatalogo } from '../../data/registros'
import { EmptyState } from '../finca/pages'
import { ActividadForm, BOTON, BOTON_CLARO, EstadoChip, Linea, TarjetaClara, TarjetaVerde, fill, useFmt, useTiempoCiclo } from '../cultivos/ui'

/*
 * Inicio · «Hoy en mi finca».
 * Reúne lo que conviene revisar hoy (reglas sencillas sobre tus registros y el clima típico del mes),
 * los cultivos en curso, cómo suele ser este mes en tu zona y lo último que anotaste.
 * Solo usa análisis ya guardados en el dispositivo: Inicio nunca dispara consultas largas a la API.
 */

type Consejo = { key: string; texto: string; accion?: { label: string; to?: string; ciclo?: Ciclo } }

const cap = (s: string) => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s)

export default function HomePage() {
  const d = useDict()
  const s = d.app.sections.home
  const t = d.inicio
  const { nombre } = useCatalogo()
  const { lang, num } = useFmt()
  const [actividad, setActividad] = useState<Ciclo | null>(null)

  const parcelas = useLiveQuery(() => db.parcelas.toArray(), [])
  const ciclos = useLiveQuery(() => db.ciclos.toArray(), [])
  const eventos = useLiveQuery(() => db.eventos.toArray(), [])
  // Análisis guardados del centro de cada parcela (sin pedir nada nuevo a la API).
  const analisis = useLiveQuery(async () => {
    const out: Record<number, Analisis | null> = {}
    for (const p of parcelas ?? []) {
      const rec = await db.analisis.get(clavePunto(p.centroide[1], p.centroide[0]))
      out[p.id!] = rec ? unificar(rec.datos as PuntoResp) : null
    }
    return out
  }, [parcelas])

  const hoy = new Date()
  const mesHoy = hoy.getMonth()
  const mesNombre = (i: number) => new Intl.DateTimeFormat(lang, { month: 'long' }).format(new Date(2026, i, 15))

  const consejos = useMemo<Consejo[]>(() => {
    if (!parcelas || !ciclos || !eventos || !analisis) return []
    const out: Consejo[] = []
    const plot = (id: number) => parcelas.find((p) => p.id === id)?.nombre ?? ''

    // 1. Temporadas en curso: siembras pendientes y cultivos sin notas recientes.
    for (const c of ciclos.filter(esActivo)) {
      const v = { crop: nombre(c.cultivoId), plot: plot(c.parcelaId) }
      const ver = { label: t.goSeason, to: `/finca/cultivos/${c.id}` }
      if (c.estado === 'planificado') {
        const dd = diasDesde(c.fechaSiembra)
        if (dd === null) continue
        if (dd > 0) out.push({ key: `pl${c.id}`, texto: fill(t.tipPlannedLate, { ...v, n: dd }), accion: ver })
        else if (dd === 0) out.push({ key: `pt${c.id}`, texto: fill(t.tipPlannedToday, v), accion: ver })
        else if (dd >= -14) out.push({ key: `ps${c.id}`, texto: fill(t.tipPlannedSoon, { ...v, n: -dd }), accion: ver })
        continue
      }
      const propios = eventos.filter((e) => e.cicloId === c.id).map((e) => e.fecha).sort()
      const ultima = propios[propios.length - 1]
      const anotar = { label: t.goLog, ciclo: c }
      if (!ultima) {
        if ((diasDesde(c.fechaSiembra) ?? 0) >= 3) out.push({ key: `qn${c.id}`, texto: fill(t.tipQuietNever, v), accion: anotar })
      } else {
        const dd = diasDesde(ultima) ?? 0
        if (dd >= 14) out.push({ key: `q${c.id}`, texto: fill(t.tipQuiet, { ...v, n: dd }), accion: anotar })
      }
    }

    // 2. Clima típico del mes (una sola vez: las parcelas de una finca comparten zona).
    const conDatos = parcelas.find((p) => analisis[p.id!]?.mensual?.rain_imerg)
    if (conDatos) {
      const lluvia = analisis[conDatos.id!]!.mensual!.rain_imerg
      const validos = lluvia.map((v, i) => [v, i] as const).filter((x): x is readonly [number, number] => x[0] !== null)
      const orden = [...validos].sort((a, b) => a[0] - b[0]).map((x) => x[1])
      if (orden.length >= 6) {
        const v = { mes: cap(mesNombre(mesHoy)), plot: conDatos.nombre }
        if (orden.slice(0, 3).includes(mesHoy)) out.push({ key: 'seco', texto: fill(t.tipDry, v) })
        else if (orden.slice(-3).includes(mesHoy)) out.push({ key: 'lluvia', texto: fill(t.tipWet, v) })
      }
    }

    // 3. Parcelas libres en buena época de siembra.
    for (const p of parcelas) {
      if (ciclos.some((c) => c.parcelaId === p.id && esActivo(c))) continue
      const top = analisis[p.id!]?.cultivosTop.find((c) => {
        const m = indiceMes(c.best_month)
        return m === mesHoy || m === (mesHoy + 1) % 12
      })
      if (top)
        out.push({
          key: `sw${p.id}`,
          texto: fill(t.tipSow, { mes: cap(mesNombre(indiceMes(top.best_month))), crop: nombre(top.id), plot: p.nombre }),
          accion: { label: t.goStart, to: `/finca/cultivos?nuevo=1&parcela=${p.id}` },
        })
    }

    // 4. Parcelas sin analizar (solo la primera, para no llenar la lista).
    const sinAnalisis = parcelas.find((p) => analisis[p.id!] === null)
    if (sinAnalisis) out.push({ key: 'an', texto: fill(t.tipAnalyze, { plot: sinAnalisis.nombre }), accion: { label: t.goMap, to: '/finca/mapa' } })

    return out.slice(0, 5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcelas, ciclos, eventos, analisis, nombre, lang])

  if (!parcelas || !ciclos || !eventos) return null

  const fechaHoy = cap(new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' }).format(hoy))

  if (parcelas.length === 0)
    return (
      <>
        <Encabezado titulo={s.title} fecha={fechaHoy} lead={s.lead} />
        <EmptyState image="granjero" title={s.emptyTitle} text={s.emptyText} cta={{ label: s.cta, to: '/finca/mapa' }} />
      </>
    )

  const activos = ciclos.filter(esActivo)
  const recientes = lineaDeTiempo(ciclos, eventos)
    .filter((e) => e.evento)
    .slice(0, 4)
  const porParcela = Object.fromEntries(parcelas.map((p) => [p.id!, p])) as Record<number, Parcela>
  const zona = parcelas.find((p) => analisis?.[p.id!]?.mensual)
  const mensual = zona ? analisis?.[zona.id!]?.mensual : undefined

  return (
    <>
      <Encabezado titulo={s.title} fecha={fechaHoy} lead={s.lead} />

      <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          {/* Lo que conviene revisar hoy */}
          <TarjetaVerde personaje="potatonaut">
            <p className="text-xs font-bold tracking-wide text-casco uppercase">{t.tipsTitle}</p>
            {consejos.length === 0 ? (
              <p className="mt-3 max-w-xl font-display text-2xl leading-snug">{t.tipNothing}</p>
            ) : (
              <ul className="mt-3 divide-y divide-crema/15">
                {consejos.map((c) => (
                  <li key={c.key} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                    <p className="max-w-xl text-lg">{c.texto}</p>
                    {c.accion &&
                      (c.accion.to ? (
                        <Link to={c.accion.to} className={`${BOTON_CLARO} min-h-10 px-5 text-sm`}>
                          {c.accion.label}
                        </Link>
                      ) : (
                        <button onClick={() => setActividad(c.accion!.ciclo!)} className={`${BOTON_CLARO} min-h-10 px-5 text-sm`}>
                          {c.accion.label}
                        </button>
                      ))}
                  </li>
                ))}
              </ul>
            )}
          </TarjetaVerde>

          {/* Cultivos en curso */}
          <section>
            <h2 className="text-3xl">{t.nowTitle}</h2>
            {activos.length === 0 ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-hoja bg-papel p-6 shadow-suave">
                <p className="text-gris">{t.nowEmpty}</p>
                <Link to="/finca/cultivos?nuevo=1" className={BOTON}>
                  {d.cultivos.newCycle}
                </Link>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4">
                {activos.map((c) => (
                  <CultivoCorto key={c.id} ciclo={c} parcela={porParcela[c.parcelaId]} onAnotar={() => setActividad(c)} />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-8">
          {/* Este mes en tu zona */}
          <TarjetaClara mancha="agua">
            <h2 className="text-3xl">{fill(t.monthTitle, { mes: cap(mesNombre(mesHoy)) })}</h2>
            {zona && mensual ? (
              <>
                <p className="mt-1 text-gris">{fill(t.monthPlot, { plot: zona.nombre })}</p>
                <dl className="mt-5 space-y-3">
                  <MesDato
                    label={t.rainMonth}
                    valor={mensual.rain_imerg?.[mesHoy] != null ? `${num(mensual.rain_imerg[mesHoy]!)} mm` : null}
                    nota={comparar(mensual.rain_imerg, mesHoy, t.rainCompare)}
                  />
                  <MesDato label={t.soilHeat} valor={mensual.lst_c?.[mesHoy] != null ? `${num(mensual.lst_c[mesHoy]!, 1)} °C` : null} />
                  <MesDato label={t.green} valor={verdor(mensual.ndvi?.[mesHoy], d.analisis.greenWord)} />
                </dl>
              </>
            ) : (
              <p className="mt-2 text-gris">{t.monthNoData}</p>
            )}
          </TarjetaClara>

          {/* Lo último anotado */}
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-3xl">{t.recentTitle}</h2>
              <Link to="/finca/historial" className="font-bold text-cielo-osc hover:underline">
                {t.recentAll}
              </Link>
            </div>
            <div className="mt-4">
              {recientes.length > 0 ? (
                <Linea entradas={recientes} parcelas={porParcela} contexto />
              ) : (
                <p className="rounded-hoja bg-papel/70 p-5 text-gris">{t.recentEmpty}</p>
              )}
            </div>
          </section>
        </div>
      </div>

      {actividad && <ActividadForm ciclo={actividad} onClose={() => setActividad(null)} />}
    </>
  )
}

function Encabezado({ titulo, fecha, lead }: { titulo: string; fecha: string; lead: string }) {
  return (
    <header className="pt-4 pb-8 lg:pt-8">
      <p className="font-bold text-cielo-osc">{fecha}</p>
      <h1 className="mt-1 text-4xl leading-tight lg:text-6xl">{titulo}</h1>
      <p className="mt-3 max-w-2xl text-lg text-gris">{lead}</p>
    </header>
  )
}

function CultivoCorto({ ciclo, parcela, onAnotar }: { ciclo: Ciclo; parcela?: Parcela; onAnotar: () => void }) {
  const t = useDict().cultivos
  const { nombre } = useCatalogo()
  const tiempo = useTiempoCiclo()
  return (
    <article className="flex flex-col rounded-hoja bg-papel p-5 shadow-suave">
      <p className="text-xs font-bold tracking-wide text-gris uppercase">{parcela?.nombre}</p>
      <h3 className="mt-1 text-3xl">{nombre(ciclo.cultivoId)}</h3>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <EstadoChip estado={ciclo.estado} />
        <span className="text-sm font-semibold text-tinta">{tiempo(ciclo)}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 pt-1">
        <button onClick={onAnotar} className="min-h-11 rounded-full bg-bosque px-5 font-bold text-crema transition hover:bg-bosque-700">
          {t.addActivity}
        </button>
        <Link to={`/finca/cultivos/${ciclo.id}`} className="inline-flex min-h-11 items-center rounded-full px-4 font-bold text-bosque hover:bg-niebla">
          {t.viewDetail}
        </Link>
      </div>
    </article>
  )
}

function MesDato({ label, valor, nota }: { label: string; valor: string | null; nota?: ReactNode }) {
  if (valor === null) return null
  return (
    <div className="rounded-[1.25rem] bg-crema p-4">
      <dt className="text-sm font-semibold text-gris">{label}</dt>
      <dd className="cifra text-2xl font-bold text-bosque">{valor}</dd>
      {nota && <dd className="mt-1 text-sm text-tinta">{nota}</dd>}
    </div>
  )
}

/** Compara el mes con el promedio del año (±15 %). */
function comparar(serie: (number | null)[] | undefined, mes: number, textos: Record<string, string>) {
  const v = serie?.[mes]
  const validos = (serie ?? []).filter((x): x is number => x !== null)
  if (v == null || validos.length < 6) return undefined
  const media = validos.reduce((a, b) => a + b, 0) / validos.length
  return textos[v > media * 1.15 ? 'mas' : v < media * 0.85 ? 'menos' : 'igual']
}

function verdor(v: number | null | undefined, palabras: Record<string, string>) {
  if (v == null) return null
  return palabras[v < 0.2 ? 'desnudo' : v < 0.4 ? 'poca' : v < 0.6 ? 'moderada' : 'densa']
}
