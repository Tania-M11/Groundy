import { useEffect } from 'react'
import { create } from 'zustand'

export type SectionKey = 'home' | 'map' | 'crops' | 'history' | 'profile'

/** Ruta de cada sección de «Mi finca». */
export const SECTION_PATH: Record<SectionKey, string> = {
  home: '/finca',
  map: '/finca/mapa',
  crops: '/finca/cultivos',
  history: '/finca/historial',
  profile: '/finca/perfil',
}

export function sectionFromPath(pathname: string): SectionKey {
  const hit = (Object.entries(SECTION_PATH) as [SectionKey, string][])
    .filter(([k]) => k !== 'home')
    .find(([, p]) => pathname.startsWith(p))
  return hit ? hit[0] : 'home'
}

export type ChatMessage = { id: number; from: 'user' | 'potatonaut'; text: string; section: SectionKey; error?: boolean }

/** De qué lugar (y cultivo) está hablando Potatonaut. Lo fija la pantalla activa: parcela, temporada o punto explorado. */
export type ContextoChat = { lat: number; lon: number; lugar?: string; cultivoId?: string }

type UiState = {
  chatOpen: boolean
  /** Hay una ficha abierta sobre el mapa: en móvil el botón flotante de Potatonaut se oculta para no taparla. */
  hojaAbierta: boolean
  setHojaAbierta: (v: boolean) => void
  messages: ChatMessage[]
  conversacion?: string
  esperando: boolean
  contexto: ContextoChat | null
  openChat: () => void
  closeChat: () => void
  push: (m: Omit<ChatMessage, 'id'>) => void
  quitarErrores: () => void
  setConversacion: (id?: string) => void
  setEsperando: (v: boolean) => void
  setContexto: (c: ContextoChat | null) => void
  nuevaConversacion: () => void
}

let nextId = 1

export const useUi = create<UiState>((set) => ({
  chatOpen: false,
  hojaAbierta: false,
  setHojaAbierta: (hojaAbierta) => set({ hojaAbierta }),
  messages: [],
  esperando: false,
  contexto: null,
  openChat: () => set({ chatOpen: true }),
  closeChat: () => set({ chatOpen: false }),
  push: (m) => set((s) => ({ messages: [...s.messages, { ...m, id: nextId++ }] })),
  quitarErrores: () => set((s) => ({ messages: s.messages.filter((m) => !m.error) })),
  setConversacion: (conversacion) => set({ conversacion }),
  setEsperando: (esperando) => set({ esperando }),
  setContexto: (contexto) => set({ contexto }),
  nuevaConversacion: () => set({ messages: [], conversacion: undefined }),
}))

/** Una pantalla fija de qué lugar habla Potatonaut mientras está abierta; al salir, vuelve al contexto automático. */
export function useContextoChat(c: ContextoChat | null) {
  const clave = c ? `${c.lat.toFixed(5)},${c.lon.toFixed(5)},${c.lugar ?? ''},${c.cultivoId ?? ''}` : ''
  useEffect(() => {
    useUi.getState().setContexto(c)
    return () => useUi.getState().setContexto(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])
}
