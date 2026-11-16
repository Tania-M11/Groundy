// Cliente del asistente Potatonaut (servicio «Papanauta» del equipo).
// POST /chat/papanauta { message, conversation_id?, farm_lat, farm_lon, farm_crop? }
//   → { assistant, conversation_id, answer (Markdown), meta }

export const CHAT_URL = (import.meta.env.VITE_CHAT_URL as string | undefined) ?? 'https://papanauta.groundy.site'

export type PreguntaChat = {
  mensaje: string
  conversacion?: string
  lat: number
  lon: number
  cultivo?: string
}

export type RespuestaChat = { respuesta: string; conversacion: string }

export class ChatError extends Error {}

export async function preguntar(p: PreguntaChat, timeoutMs = 90_000): Promise<RespuestaChat> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(`${CHAT_URL}/chat/papanauta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: p.mensaje,
        conversation_id: p.conversacion ?? null,
        farm_lat: +p.lat.toFixed(5),
        farm_lon: +p.lon.toFixed(5),
        ...(p.cultivo ? { farm_crop: p.cultivo } : {}),
      }),
      signal: ctrl.signal,
    })
    if (!r.ok) throw new ChatError(`chat ${r.status}`)
    const d = (await r.json()) as { answer?: string; conversation_id?: string }
    if (!d.answer) throw new ChatError('empty answer')
    return { respuesta: d.answer, conversacion: d.conversation_id ?? p.conversacion ?? '' }
  } catch (e) {
    throw e instanceof ChatError ? e : new ChatError((e as Error).name === 'AbortError' ? 'timeout' : 'network')
  } finally {
    clearTimeout(t)
  }
}
