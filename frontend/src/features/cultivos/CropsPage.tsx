import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDict } from '../../i18n/useDict'
import { db, type Ciclo, type Parcela } from '../../data/db'
import { esActivo, useCatalogo } from '../../data/registros'
import { formatArea } from '../../lib/geo'
import {
  ActividadForm,
  Escena,
  BOTON,
  BOTON_2,
  BOTON_CLARO,
  BOTON_CLARO_2,
  CicloForm,
  EstadoChip,
  TarjetaClara,
  TarjetaVerde,
  fill,
  useFmt,
  useTiempoCiclo,
} from './ui'

/** Cultivos: cada parcela con su temporada en curso y las anteriores; atajos para anotar. */
export default function CropsPage() {
  const d = useDict()
  const s = d.app.sections.crops
  const t = d.cultivos
  const [params, setParams] = useSearchParams()
  const parcelas = useLiveQuery(() => db.parcelas.toArray(), [])
  const ciclos = useLiveQuery(() => db.ciclos.toArray(), [])
  const eventos = useLiveQuery(() => db.eventos.toArray(), [])
  const [actividad, setActividad] = useState<Ciclo | null>(null)

  const nuevo = params.get('nuevo') === '1'
  const parcelaInicial = params.get('parcela') ? Number(params.get('parcela')) : undefined
  const abrirNuevo = (pid?: number) => setParams(pid ? { nuevo: '1', parcela: String(pid) } : { nuevo: '1' })
  const cerrarNuevo = () => setParams({}, { replace: true })

  const conteo = useMemo(() => {
    const m: Record<number, number> = {}
    for (const e of eventos ?? []) if (e.cicloId !== undefined) m[e.cicloId] = (m[e.cicloId] ?? 0) + 1
    return m
  }, [eventos])

  if (!parcelas || !ciclos) return null
  const hay = parcelas.length > 0

  return (
    <>
      <header className="grid items-center gap-8 pt-4 pb-10 lg:grid-cols-[1.15fr_1fr] lg:pt-8">
        <div>
          <h1 className="text-4xl leading-tight lg:text-6xl">{s.title}</h1>
          <p className="mt-3 max-w-xl text-lg text-gris">{s.lead}</p>
          {hay && (
            <div className="mt-7 flex flex-wrap gap-3">
              <button onClick={() => abrirNuevo()} className={BOTON}>
                {t.newCycle}
              </button>
              <Link to="/finca/mapa" className={BOTON_2}>
                {t.addPlot}
              </Link>
            </div>
          )}
        </div>
        {hay ? (
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ['bg-brote', parcelas.length, t.summaryPlots],
                ['bg-agua', ciclos.filter(esActivo).length, t.summaryActive],
                ['bg-niebla', eventos?.length ?? 0, t.summaryActivities],
              ] as const
            ).map(([fondo, n, label]) => (
              <div key={label} className={`flex flex-col justify-center rounded-hoja p-5 ${fondo}`}>
                <p className="font-display text-5xl text-bosque">{n}</p>
                <p className="text-sm font-semibold text-gris">{label}</p>
              </div>
            ))}
          </div>
        ) : (
          <Escena className="hidden lg:block" />
        )}
      </header>

      {!hay ? (
        <TarjetaClara personaje="abuelo" mancha="brote">
          <h2 className="text-3xl">{s.emptyTitle}</h2>
          <p className="mt-2 max-w-md text-gris">{s.emptyText}</p>
          <Link to="/finca/mapa" className={`${BOTON} mt-6`}>
            {t.addPlot}
          </Link>
        </TarjetaClara>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,30rem),1fr))] gap-6">
          {parcelas.map((p) => {
            const propios = ciclos.filter((c) => c.parcelaId === p.id).sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
            const activo = propios.find(esActivo)
            return (
              <TarjetaParcela
                key={p.id}
                parcela={p}
                activo={activo}
                pasados={propios.filter((c) => !esActivo(c))}
                actividades={activo?.id !== undefined ? (conteo[activo.id] ?? 0) : 0}
                onNuevo={() => abrirNuevo(p.id)}
                onActividad={setActividad}
              />
            )
          })}
        </div>
      )}

      {nuevo && hay && <CicloForm parcelas={parcelas} ciclos={ciclos} parcelaInicial={parcelaInicial} onClose={cerrarNuevo} />}
      {actividad && <ActividadForm ciclo={actividad} onClose={() => setActividad(null)} />}
    </>
  )
}

function TarjetaParcela({
  parcela,
  activo,
  pasados,
  actividades,
  onNuevo,
  onActividad,
}: {
  parcela: Parcela
  activo?: Ciclo
  pasados: Ciclo[]
  actividades: number
  onNuevo: () => void
  onActividad: (c: Ciclo) => void
}) {
  const t = useDict().cultivos
  const { nombre } = useCatalogo()
  const { lang, fecha } = useFmt()
  const tiempo = useTiempoCiclo()
  const rotulo = `${parcela.nombre} · ${formatArea(parcela.areaM2, lang)}`

  return (
    <article className="flex flex-col gap-3">
      {activo ? (
        <TarjetaVerde personaje={activo.estado === 'planificado' ? 'abuelita' : 'regadera'} className="flex-1">
          <p className="text-xs font-bold tracking-wide text-casco uppercase">{rotulo}</p>
          <h2 className="mt-2 text-4xl leading-none text-crema">{nombre(activo.cultivoId)}</h2>
          {activo.variedad && <p className="mt-1.5 text-crema/80">{activo.variedad}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <EstadoChip estado={activo.estado} sobreOscuro />
            <span className="font-semibold">{tiempo(activo)}</span>
          </div>
          <p className="mt-1 text-sm text-crema/70">{fill(t.activitiesCount, { n: actividades })}</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <button onClick={() => onActividad(activo)} className={BOTON_CLARO}>
              {t.addActivity}
            </button>
            <Link to={`/finca/cultivos/${activo.id}`} className={BOTON_CLARO_2}>
              {t.viewDetail}
            </Link>
          </div>
        </TarjetaVerde>
      ) : (
        <TarjetaClara mancha="agua">
          <p className="text-xs font-bold tracking-wide text-gris uppercase">{rotulo}</p>
          <h2 className="mt-2 text-3xl">{t.noActive}</h2>
          <p className="mt-2 text-gris">{t.noActiveText}</p>
          <button onClick={onNuevo} className={`${BOTON} mt-6`}>
            {t.startSeason}
          </button>
        </TarjetaClara>
      )}

      {pasados.length > 0 && (
        <div className="rounded-hoja bg-papel/70 px-5 py-3">
          <p className="pt-1 text-xs font-bold tracking-wide text-gris uppercase">{t.pastSeasons}</p>
          <ul className="divide-y divide-borde">
            {pasados.map((c) => (
              <li key={c.id}>
                <Link to={`/finca/cultivos/${c.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-bosque">
                  <span className="font-bold text-tinta">
                    {nombre(c.cultivoId)}
                    {c.fechaSiembra && <span className="ml-2 text-sm font-medium text-gris">{fecha(c.fechaSiembra, 'medium')}</span>}
                  </span>
                  <EstadoChip estado={c.estado} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}
