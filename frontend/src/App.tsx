import { createBrowserRouter, RouterProvider, useLocation } from 'react-router'
import { useEffect } from 'react'
import LandingPage from './features/landing/LandingPage'
import ComingSoonPage from './features/landing/ComingSoonPage'
import EstiloPage from './features/estilo/EstiloPage'
import FarmLayout from './features/finca/FarmLayout'
import { HomePage, MapPage, CropsPage, HistoryPage, ProfilePage } from './features/finca/pages'

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
      { path: 'mapa', element: <MapPage /> },
      { path: 'cultivos', element: <CropsPage /> },
      { path: 'historial', element: <HistoryPage /> },
      { path: 'perfil', element: <ProfilePage /> },
    ],
  },
  // Pendientes: Explorar (F6) y Datos y métodos (F7).
  { path: '/explorar', element: conScroll(<ComingSoonPage />) },
  { path: '*', element: conScroll(<ComingSoonPage />) },
])

export default function App() {
  return <RouterProvider router={router} />
}
