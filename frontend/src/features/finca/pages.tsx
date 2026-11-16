import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { Translate, HardDrives, ArrowSquareOut } from '@phosphor-icons/react'
import { useDict } from '../../i18n/useDict'
import { toggleLanguage } from '../../i18n'
import { borrarDatosLocales, db } from '../../data/db'
import { BOTON, BOTON_2, Escena, Linea, TarjetaClara } from '../cultivos/ui'
import { lineaDeTiempo } from '../../data/registros'

// Pantallas de F2: estructura y estados vacíos. Cada una se llena en su paso:
// Mapa (F4), Cultivos (F5), análisis y ficha (F6–F7), Inicio e Historial (F8).

export function SectionHeader({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="grid items-center gap-8 pt-4 pb-10 lg:grid-cols-[1.15fr_1fr] lg:pt-8">
      <div>
        <h1 className="text-4xl leading-tight lg:text-6xl">{title}</h1>
        <p className="mt-3 max-w-xl text-lg text-gris">{lead}</p>
      </div>
      <Escena className="hidden lg:block" />
    </div>
  )
}

export function EmptyState({
  image,
  title,
  text,
  cta,
  soon,
}: {
  image: 'granjero' | 'potatonaut'
  title: string
  text: string
  cta?: { label: string; to: string }
  soon?: string
}) {
  return (
    <TarjetaClara personaje={image === 'granjero' ? 'abuelo' : 'potatonaut'} mancha={image === 'granjero' ? 'brote' : 'casco'}>
      {soon && <span className="inline-block rounded-full bg-papa-suave px-3 py-1 text-xs font-bold text-papa-osc">{soon}</span>}
      <h2 className="mt-2 text-3xl">{title}</h2>
      <p className="mt-2 max-w-md text-gris">{text}</p>
      {cta && (
        <Link to={cta.to} className={`${BOTON} mt-6`}>
          {cta.label}
        </Link>
      )}
    </TarjetaClara>
  )
}

export function HistoryPage() {
  const s = useDict().app.sections.history
  const [tab, setTab] = useState<'farm' | 'climate'>('farm')
  const eventos = useLiveQuery(() => db.eventos.toArray(), [])
  const ciclos = useLiveQuery(() => db.ciclos.toArray(), [])
  const parcelas = useLiveQuery(() => db.parcelas.toArray(), [])
  const entradas = useMemo(() => lineaDeTiempo(ciclos ?? [], eventos ?? []), [ciclos, eventos])
  const porParcela = useMemo(() => Object.fromEntries((parcelas ?? []).map((p) => [p.id!, p])), [parcelas])
  return (
    <>
      <SectionHeader title={s.title} lead={s.lead} />
      <div role="tablist" aria-label={s.title} className="mb-6 inline-flex rounded-full bg-papel p-1.5 shadow-suave">
        {(['farm', 'climate'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-full px-5 py-2.5 font-bold transition ${
              tab === t ? 'bg-bosque text-crema' : 'text-gris hover:text-bosque'
            }`}
          >
            {t === 'farm' ? s.farmTab : s.climateTab}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'farm' ? (
          entradas.length > 0 ? (
            <div>
              <Linea entradas={entradas} parcelas={porParcela} contexto />
            </div>
          ) : (
            <EmptyState image="granjero" title={s.emptyFarmTitle} text={s.emptyFarmText} />
          )
        ) : (
          <EmptyState image="potatonaut" title={s.emptyClimateTitle} text={s.emptyClimateText} />
        )}
      </div>
    </>
  )
}

export function ProfilePage() {
  const dict = useDict()
  const s = dict.app.sections.profile
  const REPO = 'https://github.com/Tania-M11/Groundy'
  const [listo, setListo] = useState(false)
  const borrar = async (todo: boolean) => {
    if (!window.confirm(todo ? s.confirmAll : s.confirmCrops)) return
    await borrarDatosLocales(todo)
    setListo(true)
  }
  return (
    <>
      <SectionHeader title={s.title} lead={s.lead} />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-hoja bg-papel p-7 shadow-suave">
          <h2 className="text-2xl">{s.language}</h2>
          <button
            type="button"
            onClick={toggleLanguage}
            className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-bosque px-5 py-2.5 font-bold text-bosque transition hover:bg-niebla"
          >
            <Translate size={20} weight="bold" aria-hidden />
            {dict.nav.lang}
          </button>
        </div>
        <div className="rounded-hoja bg-papel p-7 shadow-suave">
          <h2 className="flex items-center gap-2 text-2xl">
            <HardDrives size={26} weight="duotone" className="text-cielo-osc" aria-hidden />
            {s.storage}
          </h2>
          <p className="mt-3 text-gris">{s.storageText}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => borrar(false)} className={BOTON_2}>
              {s.resetCrops}
            </button>
            <button type="button" onClick={() => borrar(true)} className="min-h-14 rounded-full px-5 font-bold text-arcilla hover:bg-arcilla-suave">
              {s.resetAll}
            </button>
          </div>
          {listo && (
            <p className="mt-3 font-semibold text-pradera-osc" role="status">
              {s.resetDone}
            </p>
          )}
        </div>
        <div className="rounded-hoja bg-papel p-7 shadow-suave lg:col-span-2">
          <h2 className="text-2xl">{s.links}</h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            <li>
              <Link to="/#datos" className="inline-flex rounded-full bg-niebla px-4 py-2 font-bold text-bosque hover:bg-casco">
                {s.methods}
              </Link>
            </li>
            <li>
              <a
                href={`${REPO}/blob/main/AI_USAGE.md`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-niebla px-4 py-2 font-bold text-bosque hover:bg-casco"
              >
                {s.ai}
                <ArrowSquareOut size={16} weight="bold" aria-hidden />
              </a>
            </li>
            <li>
              <Link to="/" className="inline-flex rounded-full bg-niebla px-4 py-2 font-bold text-bosque hover:bg-casco">
                {s.site}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </>
  )
}
