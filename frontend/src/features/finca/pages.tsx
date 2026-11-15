import { useState } from 'react'
import { Link } from 'react-router'
import { Plus, Translate, HardDrives, ArrowSquareOut } from '@phosphor-icons/react'
import { useDict } from '../../i18n/useDict'
import { toggleLanguage } from '../../i18n'

// Pantallas de F2: estructura y estados vacíos. Cada una se llena en su paso:
// Mapa (F4), Cultivos (F5), análisis y ficha (F6–F7), Inicio e Historial (F8).

function SectionHeader({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="max-w-2xl pt-4 pb-8 lg:pt-6">
      <h1 className="text-4xl lg:text-5xl">{title}</h1>
      <p className="mt-3 text-lg text-gris">{lead}</p>
    </div>
  )
}

function EmptyState({
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
  const src = image === 'granjero' ? '/brand/granjero-360.webp' : '/brand/potatonaut-256.webp'
  return (
    <div className="relative overflow-hidden rounded-hoja bg-papel p-7 shadow-suave sm:flex sm:items-center sm:gap-8 lg:p-10">
      <div aria-hidden className="absolute -right-20 -bottom-24 size-64 rounded-full bg-niebla" />
      <img src={src} alt="" className="relative mx-auto h-40 w-auto sm:mx-0 lg:h-48" />
      <div className="relative mt-6 sm:mt-0">
        {soon && (
          <span className="inline-block rounded-full bg-papa-suave px-3 py-1 text-xs font-bold text-papa-osc">{soon}</span>
        )}
        <h2 className="mt-2 text-2xl lg:text-3xl">{title}</h2>
        <p className="mt-2 max-w-lg text-gris">{text}</p>
        {cta && (
          <Link
            to={cta.to}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-bosque px-6 py-3 font-bold text-crema shadow-flota transition hover:bg-bosque-700"
          >
            <Plus size={18} weight="bold" aria-hidden />
            {cta.label}
          </Link>
        )}
      </div>
    </div>
  )
}

export function HomePage() {
  const s = useDict().app.sections.home
  return (
    <>
      <SectionHeader title={s.title} lead={s.lead} />
      <EmptyState image="granjero" title={s.emptyTitle} text={s.emptyText} cta={{ label: s.cta, to: '/finca/cultivos' }} />
    </>
  )
}

export function MapPage() {
  const a = useDict().app
  const s = a.sections.map
  return (
    <>
      <SectionHeader title={s.title} lead={s.lead} />
      <EmptyState image="potatonaut" title={s.emptyTitle} text={s.emptyText} soon={a.soonBadge} />
    </>
  )
}

export function CropsPage() {
  const a = useDict().app
  const s = a.sections.crops
  return (
    <>
      <SectionHeader title={s.title} lead={s.lead} />
      <EmptyState image="granjero" title={s.emptyTitle} text={s.emptyText} soon={a.soonBadge} />
    </>
  )
}

export function HistoryPage() {
  const s = useDict().app.sections.history
  const [tab, setTab] = useState<'farm' | 'climate'>('farm')
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
          <EmptyState image="granjero" title={s.emptyFarmTitle} text={s.emptyFarmText} />
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
