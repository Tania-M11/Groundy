import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { PaperPlaneRight, X } from '@phosphor-icons/react'
import { useDict } from '../../i18n/useDict'
import { sectionFromPath, useUi, type ContextoChat } from '../../app/uiStore'
import { db } from '../../data/db'
import { esActivo, useCatalogo } from '../../data/registros'
import { preguntar } from '../../lib/papanauta'

// Ubicación de ejemplo cuando todavía no hay parcelas ni punto elegido (Ipiales, Nariño).
const EJEMPLO = { lat: 0.8305, lon: -77.6395 }

/** Botón flotante: visible en «Mi finca» y Explorar, encima de la barra inferior en móvil. */
export function PotatonautFab() {
  const d = useDict().app.potatonaut
  const { chatOpen, openChat, hojaAbierta } = useUi()
  if (chatOpen) return null
  return (
    <button
      type="button"
      onClick={openChat}
      aria-label={d.open}
      className={`${hojaAbierta ? 'max-md:hidden' : ''} brillo-fab group fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 grid size-16 place-items-center rounded-full border-[3px] border-papel bg-papel transition hover:scale-105 lg:right-8 lg:bottom-8 lg:size-[4.5rem]`}
    >
      <img src="/brand/potatonaut-128.webp" alt="" className="h-12 w-auto transition group-hover:-rotate-6 lg:h-14" />
    </button>
  )
}

/**
 * Lugar del que habla Potatonaut: el que fije la pantalla (parcela abierta, temporada, punto explorado);
 * si no hay, la parcela con cultivo activo, luego la primera parcela y, por último, una ubicación de ejemplo.
 */
function useContexto(): ContextoChat & { ejemplo: boolean } {
  const fijado = useUi((s) => s.contexto)
  const auto = useLiveQuery(async () => {
    const activo = (await db.ciclos.toArray()).find(esActivo)
    const parcela = activo ? await db.parcelas.get(activo.parcelaId) : await db.parcelas.toCollection().first()
    return parcela ? { lat: parcela.centroide[1], lon: parcela.centroide[0], lugar: parcela.nombre, cultivoId: activo?.cultivoId } : null
  }, [])
  if (fijado) return { ...fijado, ejemplo: false }
  if (auto) return { ...auto, ejemplo: false }
  return { ...EJEMPLO, ejemplo: true }
}

/**
 * Panel de conversación con Potatonaut (servicio Papanauta del equipo).
 * Envía cada pregunta con la ubicación y el cultivo del contexto, y mantiene el hilo con conversation_id.
 */
export function PotatonautPanel() {
  const dict = useDict()
  const d = dict.app.potatonaut
  const { chatOpen, closeChat, messages, push, quitarErrores, conversacion, setConversacion, esperando, setEsperando, nuevaConversacion } = useUi()
  const section = sectionFromPath(useLocation().pathname)
  const ctx = useContexto()
  const { nombre } = useCatalogo()
  const [texto, setTexto] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chatOpen) return
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeChat()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chatOpen, closeChat])

  // La respuesta nueva se muestra desde su comienzo; lo demás (pregunta, «pensando…») baja al final.
  const lastRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const ultimo = messages[messages.length - 1]
    if (ultimo?.from === 'potatonaut' && !esperando) lastRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else endRef.current?.scrollIntoView({ behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, esperando])

  if (!chatOpen) return null

  const cultivo = ctx.cultivoId ? nombre(ctx.cultivoId) : undefined

  const enviar = async (q: string) => {
    const pregunta = q.trim()
    if (!pregunta || esperando) return
    quitarErrores()
    push({ from: 'user', text: pregunta, section })
    setTexto('')
    setEsperando(true)
    try {
      const r = await preguntar({ mensaje: pregunta, conversacion, lat: ctx.lat, lon: ctx.lon, cultivo })
      setConversacion(r.conversacion || conversacion)
      push({ from: 'potatonaut', text: r.respuesta, section })
    } catch {
      push({ from: 'potatonaut', text: d.error, section, error: true })
    } finally {
      setEsperando(false)
    }
  }

  const reintentar = () => {
    const ultima = [...messages].reverse().find((m) => m.from === 'user')
    if (!ultima) return
    quitarErrores()
    useUi.setState((s) => ({ messages: s.messages.filter((m) => m.id !== ultima.id) }))
    void enviar(ultima.text)
  }

  const lugar = ctx.ejemplo ? d.examplePlace : ctx.lugar ?? `${ctx.lat.toFixed(3)}°, ${ctx.lon.toFixed(3)}°`

  return (
    <>
      <div aria-hidden onClick={closeChat} className="fixed inset-0 z-40 bg-bosque/30 backdrop-blur-[2px] lg:bg-transparent lg:backdrop-blur-none" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Potatonaut"
        className="fixed inset-x-0 bottom-0 z-50 flex h-[85svh] flex-col overflow-hidden rounded-t-hoja bg-crema shadow-flota lg:inset-x-auto lg:top-6 lg:right-6 lg:bottom-6 lg:h-auto lg:w-[30rem] lg:rounded-hoja"
      >
        {/* Encabezado verde, como las tarjetas de la finca */}
        <header className="relative overflow-hidden bg-bosque px-5 pt-5 pb-4 text-crema">
          <div aria-hidden className="absolute -top-12 -right-10 size-36 rounded-full bg-pradera/25" />
          <div className="relative flex items-center gap-3">
            <img src="/brand/potatonaut-128.webp" alt="" className="h-14 w-auto" />
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl leading-none text-crema">Potatonaut</h2>
              <p className="mt-1.5 truncate text-sm text-casco">
                {d.about}: <span className="font-bold text-crema">{lugar}</span>
                {cultivo && <span className="text-crema"> · {cultivo}</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={closeChat}
              aria-label={d.close}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-crema/15 text-crema transition hover:bg-crema/25"
            >
              <X size={20} weight="bold" />
            </button>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={nuevaConversacion}
              disabled={esperando}
              className="relative mt-3 rounded-full border-2 border-crema/40 px-4 py-1.5 text-sm font-bold text-crema transition hover:bg-crema/10 disabled:opacity-50"
            >
              {d.newChat}
            </button>
          )}
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5" aria-live="polite">
          <Burbuja from="potatonaut">{d.greeting}</Burbuja>
          {ctx.ejemplo && <p className="rounded-[1.25rem] bg-agua px-4 py-3 text-sm text-tinta">{d.exampleNote}</p>}
          {messages.map((m, i) => (
            <div key={m.id} ref={i === messages.length - 1 ? lastRef : undefined} className="scroll-mt-4">
            {m.from === 'user' ? (
              <Burbuja key={m.id} from="user">
                {m.text}
              </Burbuja>
            ) : (
              <Burbuja key={m.id} from="potatonaut" error={m.error}>
                {m.error ? (
                  <>
                    <p>{m.text}</p>
                    <button onClick={reintentar} className="mt-2 rounded-full bg-bosque px-4 py-1.5 text-sm font-bold text-crema">
                      {d.retry}
                    </button>
                  </>
                ) : (
                  <Markdown texto={m.text} />
                )}
              </Burbuja>
            )}
            </div>
          ))}
          {esperando && (
            <Burbuja from="potatonaut">
              <span className="flex items-center gap-1.5 py-1" role="status" aria-label={d.thinking}>
                {[0, 150, 300].map((ms) => (
                  <span key={ms} className="size-2 animate-bounce rounded-full bg-pradera-osc" style={{ animationDelay: `${ms}ms` }} />
                ))}
              </span>
            </Burbuja>
          )}
          <div ref={endRef} />
        </div>

        <footer className="border-t border-borde bg-papel px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {messages.length === 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {d.suggestions[section].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => enviar(q)}
                  className="rounded-full bg-niebla px-4 py-2 text-left text-sm font-semibold text-bosque transition hover:bg-brote"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void enviar(texto)
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void enviar(texto)
                }
              }}
              placeholder={d.placeholder}
              aria-label={d.placeholder}
              className="max-h-32 min-h-12 min-w-0 flex-1 resize-none rounded-[1.5rem] border-2 border-borde bg-crema px-4 py-3 placeholder:text-gris focus:border-bosque focus:outline-none"
            />
            <button
              type="submit"
              disabled={esperando || !texto.trim()}
              aria-label={d.send}
              className="grid size-12 shrink-0 place-items-center rounded-full bg-bosque text-crema transition hover:bg-bosque-700 disabled:opacity-40"
            >
              <PaperPlaneRight size={20} weight="fill" />
            </button>
          </form>
        </footer>
      </section>
    </>
  )
}

function Burbuja({ from, error, children }: { from: 'user' | 'potatonaut'; error?: boolean; children: ReactNode }) {
  if (from === 'user')
    return <p className="ml-auto w-fit max-w-[85%] rounded-[1.5rem] rounded-br-md bg-bosque px-4 py-3 font-semibold whitespace-pre-wrap text-crema">{children}</p>
  return (
    <div className="flex max-w-[94%] items-start gap-2.5">
      <span className="mt-1 grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-casco">
        <img src="/brand/potatonaut-128.webp" alt="" className="h-7 w-auto" />
      </span>
      <div className={`min-w-0 rounded-[1.5rem] rounded-tl-md px-4 py-3 text-tinta shadow-suave ${error ? 'bg-arcilla-suave' : 'bg-papel'}`}>{children}</div>
    </div>
  )
}

/* ───────── Markdown mínimo y seguro (sin HTML): párrafos, listas, títulos, **negrita** y *cursiva* ───────── */
function enLinea(s: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g
  let i = 0
  for (const m of s.matchAll(re)) {
    if (m.index! > i) out.push(s.slice(i, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) out.push(<strong key={m.index} className="font-bold text-bosque">{tok.slice(2, -2)}</strong>)
    else if (tok.startsWith('`')) out.push(<code key={m.index} className="rounded bg-niebla px-1">{tok.slice(1, -1)}</code>)
    else out.push(<em key={m.index}>{tok.slice(1, -1)}</em>)
    i = m.index! + tok.length
  }
  if (i < s.length) out.push(s.slice(i))
  return out
}

function Markdown({ texto }: { texto: string }) {
  const bloques: ReactNode[] = []
  let lista: { tipo: 'ul' | 'ol'; items: string[] } | null = null
  const cerrarLista = () => {
    if (!lista) return
    const L = lista
    bloques.push(
      L.tipo === 'ul' ? (
        <ul key={bloques.length} className="list-disc space-y-1 pl-5">
          {L.items.map((x, j) => <li key={j}>{enLinea(x)}</li>)}
        </ul>
      ) : (
        <ol key={bloques.length} className="list-decimal space-y-1 pl-5">
          {L.items.map((x, j) => <li key={j}>{enLinea(x)}</li>)}
        </ol>
      ),
    )
    lista = null
  }
  for (const linea of texto.split('\n')) {
    const l = linea.trim()
    const ul = /^[-*•]\s+(.*)$/.exec(l)
    const ol = /^\d+[.)]\s+(.*)$/.exec(l)
    const h = /^#{1,4}\s+(.*)$/.exec(l)
    if (ul || ol) {
      const tipo = ul ? 'ul' : 'ol'
      if (lista && lista.tipo !== tipo) cerrarLista()
      lista ??= { tipo, items: [] }
      lista.items.push((ul ?? ol)![1])
      continue
    }
    cerrarLista()
    if (!l) continue
    if (h) bloques.push(<p key={bloques.length} className="font-display text-lg text-bosque">{enLinea(h[1])}</p>)
    else bloques.push(<p key={bloques.length}>{enLinea(l)}</p>)
  }
  cerrarLista()
  return <div className="space-y-2 leading-relaxed">{bloques}</div>
}
