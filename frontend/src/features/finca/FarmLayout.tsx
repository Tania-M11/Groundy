import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { House, MapTrifold, Plant, ClockCounterClockwise, UserCircle, Translate, type Icon } from '@phosphor-icons/react'
import { useDict } from '../../i18n/useDict'
import { toggleLanguage } from '../../i18n'
import { SECTION_PATH, sectionFromPath, type SectionKey } from '../../app/uiStore'
import { PotatonautFab, PotatonautPanel } from '../potatonaut/Potatonaut'

const MAIN: { key: Exclude<SectionKey, 'profile'>; icon: Icon }[] = [
  { key: 'home', icon: House },
  { key: 'map', icon: MapTrifold },
  { key: 'crops', icon: Plant },
  { key: 'history', icon: ClockCounterClockwise },
]

/**
 * Estructura de «Mi finca».
 * Escritorio: riel lateral con las 4 secciones; el contenido ocupa el resto (el mapa podrá llenar la pantalla).
 * Móvil: encabezado con logo y avatar, barra inferior de 4 secciones y Potatonaut flotando encima.
 * El perfil no es una quinta sección: se abre desde el avatar.
 */
export default function FarmLayout() {
  const dict = useDict()
  const d = dict.app
  const section = sectionFromPath(useLocation().pathname)

  return (
    <div className="min-h-[100svh] bg-crema lg:grid lg:grid-cols-[15.5rem_1fr]">
      {/* Riel lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-[100svh] flex-col border-r border-borde bg-papel px-4 py-7 lg:flex">
        <Link to="/" aria-label={d.nav.site} className="px-3">
          <img src="/brand/logo-groundy.webp" alt="Groundy" className="h-8 w-auto" />
        </Link>
        <nav aria-label={d.nav.main} className="mt-10">
          <ul className="space-y-1.5">
            {MAIN.map(({ key, icon: Ico }) => (
              <li key={key}>
                <NavLink
                  to={SECTION_PATH[key]}
                  end={key === 'home'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-chip px-3 py-2.5 font-semibold transition ${
                      isActive ? 'bg-niebla text-bosque' : 'text-gris hover:bg-crema hover:text-bosque'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Ico size={24} weight={isActive ? 'fill' : 'duotone'} aria-hidden />
                      {d.nav[key]}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-auto space-y-1.5">
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex w-full items-center gap-3 rounded-chip px-3 py-2.5 font-semibold text-gris transition hover:bg-crema hover:text-bosque"
          >
            <Translate size={22} weight="duotone" aria-hidden />
            {dict.nav.lang}
          </button>
          <NavLink
            to={SECTION_PATH.profile}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-chip px-3 py-2.5 font-semibold transition ${
                isActive ? 'bg-niebla text-bosque' : 'text-gris hover:bg-crema hover:text-bosque'
              }`
            }
          >
            <UserCircle size={24} weight={section === 'profile' ? 'fill' : 'duotone'} aria-hidden />
            {d.nav.profile}
          </NavLink>
        </div>
      </aside>

      <div className="flex min-h-[100svh] min-w-0 flex-col">
        {/* Encabezado */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 bg-crema/90 px-5 backdrop-blur lg:h-20 lg:px-10">
          <Link to="/" aria-label={d.nav.site} className="lg:hidden">
            <img src="/brand/logo-groundy.webp" alt="Groundy" className="h-7 w-auto" />
          </Link>
          <p className="hidden font-display text-xl text-bosque lg:block">{d.farmFallback}</p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={dict.nav.lang}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-bosque transition hover:bg-niebla lg:hidden"
            >
              <Translate size={18} weight="bold" aria-hidden />
              {dict.nav.langCode}
            </button>
            <NavLink
              to={SECTION_PATH.profile}
              aria-label={d.nav.profile}
              className={({ isActive }) =>
                `grid size-11 place-items-center rounded-full transition ${
                  isActive ? 'bg-bosque text-crema' : 'bg-niebla text-bosque hover:bg-casco'
                }`
              }
            >
              <UserCircle size={26} weight="duotone" />
            </NavLink>
          </div>
        </header>

        <main className="flex-1 px-5 pt-2 pb-36 lg:px-10 lg:pb-16">
          <Outlet />
        </main>
      </div>

      {/* Barra inferior (móvil) */}
      <nav
        aria-label={d.nav.main}
        className="fixed inset-x-0 bottom-0 z-30 rounded-t-hoja bg-papel px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_rgb(14_59_35/0.2)] lg:hidden"
      >
        <ul className="grid grid-cols-4">
          {MAIN.map(({ key, icon: Ico }) => (
            <li key={key}>
              <NavLink
                to={SECTION_PATH[key]}
                end={key === 'home'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2.5 text-xs font-bold transition ${
                    isActive ? 'text-bosque' : 'text-gris'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`grid h-8 w-14 place-items-center rounded-full transition ${isActive ? 'bg-niebla' : ''}`}
                    >
                      <Ico size={24} weight={isActive ? 'fill' : 'duotone'} aria-hidden />
                    </span>
                    {d.nav[key]}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <PotatonautFab />
      <PotatonautPanel />
    </div>
  )
}
