import { createBrowserRouter, RouterProvider, useLocation } from 'react-router'
import { lazy, Suspense, useEffect } from 'react'
import LandingPage from './features/landing/LandingPage'
import ComingSoonPage from './features/landing/ComingSoonPage'
import EstiloPage from './features/estilo/EstiloPage'
import FarmLayout from './features/finca/FarmLayout'
import { HistoryPage, ProfilePage } from './features/finca/pages'
import HomePage from './features/inicio/HomePage'
import CropsPage from './features/cultivos/CropsPage'
import CycleDetailPage from './features/cultivos/CycleDetailPage'

// El mapa (MapLibre, Terra Draw) es la parte más pesada: se descarga solo al abrir Mapa o Explorar.
const FarmMapPage = lazy(() => import('./features/mapa/FarmMapPage'))
const ExplorePage = lazy(() => import('./features/mapa/ExplorePage'))
const cargando = (el: React.ReactNode) => (
  <Suspense fallback={<div className="grid h-full min-h-[60svh] place-items-center"><img src="/brand/potatonaut-128.webp" alt="" className="h-16 animate-bounce" /></div>}>{el}</Suspense>
)

/** Al navegar a una ruta con #ancla, desplaza hasta la sección; si no, sube al inicio. */
function ScrollManager({ children }: { children: React.ReactNode }) {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
    } else {
      window.scrollTo(0, 0)
    }
  }, [pathname, hash])
  return children
}

const conScroll = (el: React.ReactNode) => <ScrollManager>{el}</ScrollManager>

const router = createBrowserRouter([
  { path: '/', element: conScroll(<LandingPage />) },
  { path: '/estilo', element: conScroll(<EstiloPage />) },
  {
    path: '/finca',
    element: conScroll(<FarmLayout />),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'mapa', element: cargando(<FarmMapPage />) },
      { path: 'cultivos', element: <CropsPage /> },
      { path: 'cultivos/:id', element: <CycleDetailPage /> },
      { path: 'historial', element: <HistoryPage /> },
      { path: 'perfil', element: <ProfilePage /> },
    ],
  },
  { path: '/explorar', element: conScroll(cargando(<ExplorePage />)) },
  { path: '*', element: conScroll(<ComingSoonPage />) },
])

export default function App() {
  return <RouterProvider router={router} />
}
