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

export type ChatMessage = { id: number; from: 'user' | 'potatonaut'; text: string; section: SectionKey }

type UiState = {
  chatOpen: boolean
  messages: ChatMessage[]
  openChat: () => void
  closeChat: () => void
  push: (m: Omit<ChatMessage, 'id'>) => void
}

let nextId = 1

export const useUi = create<UiState>((set) => ({
  chatOpen: false,
  messages: [],
  openChat: () => set({ chatOpen: true }),
  closeChat: () => set({ chatOpen: false }),
  push: (m) => set((s) => ({ messages: [...s.messages, { ...m, id: nextId++ }] })),
}))
