import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { PaperPlaneRight, X } from '@phosphor-icons/react'
import { useDict } from '../../i18n/useDict'
import { sectionFromPath, useUi } from '../../app/uiStore'

/** Botón flotante: visible en todas las secciones de «Mi finca», encima de la barra inferior en móvil. */
export function PotatonautFab() {
  const d = useDict().app.potatonaut
  const { chatOpen, openChat } = useUi()
  if (chatOpen) return null
  return (
    <button
      type="button"
      onClick={openChat}
      aria-label={d.open}
      className="group fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 grid size-16 place-items-center rounded-full bg-papel shadow-flota ring-4 ring-casco transition hover:scale-105 lg:right-8 lg:bottom-8 lg:size-[4.5rem]"
    >
      <img src="/brand/potatonaut-128.webp" alt="" className="h-12 w-auto transition group-hover:-rotate-6 lg:h-14" />
    </button>
  )
}

/**
 * Panel de conversación. Hoja inferior en móvil y panel lateral en escritorio; no cambia de pantalla.
 * Recibe la sección activa como contexto. En F9 las respuestas saldrán de plantillas con los hechos del análisis;
 * por ahora responde con honestidad que todavía está aprendiendo.
 */
export function PotatonautPanel() {
  const dict = useDict()
  const d = dict.app.potatonaut
  const { chatOpen, closeChat, messages, push } = useUi()
  const section = sectionFromPath(useLocation().pathname)
  const closeRef = useRef<HTMLButtonElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chatOpen) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeChat()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chatOpen, closeChat])

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages.length])

  if (!chatOpen) return null

  const ask = (q: string) => {
    push({ from: 'user', text: q, section })
    push({ from: 'potatonaut', text: d.learning, section })
  }

  return (
    <>
      <div aria-hidden onClick={closeChat} className="fixed inset-0 z-40 bg-bosque/30 backdrop-blur-[2px] lg:bg-transparent lg:backdrop-blur-none" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Potatonaut"
        className="fixed inset-x-0 bottom-0 z-50 flex h-[80svh] flex-col rounded-t-hoja bg-papel shadow-flota lg:inset-x-auto lg:top-6 lg:right-6 lg:bottom-6 lg:h-auto lg:w-[26rem] lg:rounded-hoja"
      >
        <header className="flex items-center gap-3 rounded-t-hoja bg-casco/60 px-5 pt-5 pb-4">
          <img src="/brand/potatonaut-128.webp" alt="" className="h-12 w-auto" />
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl leading-none">Potatonaut</h2>
            <p className="mt-1 text-sm text-gris">
              {d.context}: <span className="font-bold text-bosque">{dict.app.nav[section]}</span>
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={closeChat}
            aria-label={d.close}
            className="grid size-10 place-items-center rounded-full bg-papel text-bosque transition hover:bg-niebla"
          >
            <X size={20} weight="bold" />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5" aria-live="polite">
          <Bubble from="potatonaut" text={d.greeting} />
          {messages.map((m) => (
            <Bubble key={m.id} from={m.from} text={m.text} />
          ))}
          <div ref={endRef} />
        </div>

        <footer className="border-t border-borde px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <p className="text-xs font-bold text-gris">{d.suggested}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {d.suggestions[section].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => ask(q)}
                className="rounded-chip bg-niebla px-3 py-2 text-left text-sm font-semibold text-bosque transition hover:bg-casco"
              >
                {q}
              </button>
            ))}
          </div>
          <form className="mt-3 flex items-center gap-2" onSubmit={(e) => e.preventDefault()}>
            <input
              disabled
              placeholder={d.placeholder}
              aria-describedby="pn-soon"
              className="min-w-0 flex-1 rounded-full border-2 border-borde bg-crema px-4 py-2.5 text-sm placeholder:text-gris disabled:opacity-70"
            />
            <button
              type="submit"
              disabled
              aria-label={d.send}
              className="grid size-11 place-items-center rounded-full bg-bosque text-crema disabled:opacity-40"
            >
              <PaperPlaneRight size={18} weight="fill" />
            </button>
          </form>
          <p id="pn-soon" className="mt-2 text-xs text-gris">
            {d.inputSoon}
          </p>
        </footer>
      </section>
    </>
  )
}

function Bubble({ from, text }: { from: 'user' | 'potatonaut'; text: string }) {
  if (from === 'user')
    return (
      <p className="ml-auto w-fit max-w-[85%] rounded-3xl rounded-br-md bg-bosque px-4 py-2.5 font-semibold text-crema">
        {text}
      </p>
    )
  return (
    <div className="flex max-w-[92%] items-end gap-2">
      <img src="/brand/potatonaut-128.webp" alt="" className="size-7 shrink-0" />
      <p className="rounded-3xl rounded-bl-md bg-crema px-4 py-2.5">{text}</p>
    </div>
  )
}
