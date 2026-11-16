import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from '@phosphor-icons/react'
import { useDict } from '../../i18n/useDict'
import type { Ciclo, Evento, Parcela } from '../../data/db'
import { useAnalisis } from '../../data/analysis'
import { formatArea, openRing } from '../../lib/geo'
import {
  ACTIVIDADES,
  ajusteCultivo,
  anotar,
  borrarCiclo,
  borrarEvento,
  cerrarCiclo,
  crearCiclo,
  distanciaMeses,
  diasDesde,
  editarCiclo,
  editarEvento,
  esActivo,
  hoyISO,
  indiceMes,
  useCatalogo,
  type Entrada,
  type TipoActividad,
} from '../../data/registros'

/* ════════════ Utilidades ════════════ */
export const fill = (s: string, v: Record<string, string | number | null | undefined>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''))

export function useFmt() {
  const { i18n } = useTranslation()
  const lang = i18n.resolvedLanguage === 'es' ? 'es-CO' : 'en-US'
  const fecha = (iso?: string, estilo: 'long' | 'medium' = 'long') =>
    iso ? new Intl.DateTimeFormat(lang, { dateStyle: estilo }).format(new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)) : ''
  const mesLargo = (abbr?: string) => {
    const i = indiceMes(abbr)
    return i < 0 ? (abbr ?? '') : new Intl.DateTimeFormat(lang, { month: 'long' }).format(new Date(2026, i, 15))
  }
  const num = (v: number, d = 0) => v.toLocaleString(lang, { maximumFractionDigits: d })
  return { lang, fecha, mesLargo, num }
}

/** «Sembrado hace 42 días» / «Siembra prevista en 10 días». */
export function useTiempoCiclo() {
  const t = useDict().cultivos
  return (c: Ciclo) => {
    const d = diasDesde(c.fechaSiembra)
    if (d === null) return ''
    if (c.estado === 'planificado') return d < 0 ? fill(t.plannedIn, { n: -d }) : d === 0 ? t.plannedToday : fill(t.plannedLate, { n: d })
    if (!esActivo(c)) return ''
    return d <= 0 ? t.sownToday : fill(t.daysSince, { n: d })
  }
}

/* ════════════ Avatares (personajes 3D del equipo) ════════════ */
export type AvatarKey = 'abuelita' | 'granjera' | 'cubeta' | 'regadera' | 'abuelo' | 'potatonaut'
const FONDO = {
  niebla: 'bg-niebla',
  casco: 'bg-casco',
  brote: 'bg-brote',
  hoja: 'bg-hoja',
  agua: 'bg-agua',
} as const
type Fondo = keyof typeof FONDO

export function Avatar({ k, fondo = 'niebla', className = 'size-14' }: { k: AvatarKey; fondo?: Fondo; className?: string }) {
  return (
    <span className={`inline-block shrink-0 overflow-hidden rounded-full ${FONDO[fondo]} ${className}`} aria-hidden>
      <img src={`/brand/avatares/${k}-cara.webp`} alt="" className="size-full object-cover object-top" loading="lazy" />
    </span>
  )
}

/** Personaje y color de cada tipo de registro. */
export const PERSONAJE: Record<string, { k: AvatarKey; fondo: Fondo } | undefined> = {
  ciclo_planeado: { k: 'potatonaut', fondo: 'casco' },
  siembra: { k: 'granjera', fondo: 'brote' },
  riego: { k: 'regadera', fondo: 'agua' },
  abono: { k: 'cubeta', fondo: 'hoja' },
  control: { k: 'abuelo', fondo: 'casco' },
  labor: { k: 'abuelo', fondo: 'niebla' },
  observacion: { k: 'abuelita', fondo: 'agua' },
  cosecha: { k: 'granjera', fondo: 'hoja' },
}

/** Un personaje de cuerpo entero sobre una mancha de color (lado derecho de los encabezados en escritorio). */
export function Escena({ k = 'regadera', className = '' }: { k?: AvatarKey; className?: string }) {
  return (
    <div className={`relative h-64 ${className}`} aria-hidden>
      <div className="absolute right-[12%] bottom-0 size-56 rounded-full bg-brote" />
      <div className="absolute top-4 right-[8%] size-20 rounded-full bg-agua" />
      <img src={`/brand/avatares/${k}-360.webp`} alt="" className="absolute right-[18%] bottom-0 h-60 w-auto" />
    </div>
  )
}

/* ════════════ Piezas de estilo ════════════ */
const TONO_ESTADO: Record<Ciclo['estado'], string> = {
  planificado: 'bg-casco text-cielo-osc',
  sembrado: 'bg-pradera/25 text-pradera-osc',
  en_desarrollo: 'bg-pradera/25 text-pradera-osc',
  cosechado: 'bg-papa-suave text-papa-osc',
  perdido: 'bg-arcilla-suave text-arcilla',
  cancelado: 'bg-niebla text-gris',
  descanso: 'bg-niebla text-gris',
}

export function EstadoChip({ estado, sobreOscuro = false }: { estado: Ciclo['estado']; sobreOscuro?: boolean }) {
  const t = useDict().cultivos
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${sobreOscuro ? 'bg-crema/15 text-crema' : TONO_ESTADO[estado]}`}>
      {t.states[estado]}
    </span>
  )
}

export const BOTON =
  'inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-bosque px-7 font-bold text-crema transition hover:bg-bosque-700 disabled:opacity-50'
export const BOTON_2 =
  'inline-flex min-h-14 items-center justify-center gap-2 rounded-full border-2 border-bosque bg-papel px-7 font-bold text-bosque transition hover:bg-niebla'
export const BOTON_CLARO =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-crema px-6 font-bold text-bosque transition hover:bg-niebla'
export const BOTON_CLARO_2 =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-crema/60 px-6 font-bold text-crema transition hover:bg-crema/10'
export const INPUT =
  'h-14 w-full rounded-[1.25rem] border-2 border-borde bg-papel px-5 text-tinta transition placeholder:text-gris/70 focus:border-bosque focus:outline-none'

export function Campo({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block font-bold text-tinta">{label}</span>
      {children}
      {help && <span className="mt-1.5 block text-sm text-gris">{help}</span>}
    </label>
  )
}

function Pildoras<T extends string>({ value, onChange, opts }: { value: T; onChange: (v: T) => void; opts: { v: T; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {opts.map(({ v, label }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`min-h-12 rounded-full border-2 px-5 font-bold transition ${
            value === v ? 'border-bosque bg-bosque text-crema' : 'border-borde bg-papel text-tinta hover:border-bosque'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** Tarjeta verde bosque con mancha y personaje (el estilo de «En pocas palabras»). */
export function TarjetaVerde({ personaje, children, className = '' }: { personaje?: AvatarKey; children: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-hoja bg-bosque p-6 text-crema lg:p-7 ${className}`}>
      <div aria-hidden className="absolute -top-12 -right-12 size-44 rounded-full bg-pradera/25" />
      <div aria-hidden className="absolute -bottom-20 -left-16 size-40 rounded-full bg-cielo/15" />
      {personaje && (
        <img
          src={`/brand/avatares/${personaje}-360.webp`}
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-2 bottom-0 h-40 w-auto opacity-95 sm:h-48"
        />
      )}
      <div className={`relative ${personaje ? 'pr-24 sm:pr-32' : ''}`}>{children}</div>
    </div>
  )
}

/** Tarjeta clara con mancha pastel (para estados vacíos y apoyos). */
export function TarjetaClara({ personaje, mancha = 'niebla', children }: { personaje?: AvatarKey; mancha?: Fondo; children: ReactNode }) {
  return (
    <div className={`relative overflow-hidden rounded-hoja bg-papel p-6 shadow-suave lg:p-7 ${personaje ? 'min-h-44 sm:min-h-52' : ''}`}>
      <div aria-hidden className={`absolute -right-14 -bottom-16 size-48 rounded-full ${FONDO[mancha]}`} />
      {personaje && <img src={`/brand/avatares/${personaje}-360.webp`} alt="" aria-hidden className="pointer-events-none absolute right-3 bottom-0 h-36 w-auto sm:h-44" />}
      <div className={`relative ${personaje ? 'pr-24 sm:pr-32' : ''}`}>{children}</div>
    </div>
  )
}

/* ════════════ Ventana (hoja inferior en móvil, centrada en escritorio) ════════════ */
export function Modal({ title, lead, onClose, children }: { title: string; lead?: string; onClose: () => void; children: ReactNode }) {
  const t = useDict().mapa
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-bosque/30 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[94svh] w-full flex-col overflow-hidden rounded-t-hoja bg-crema shadow-flota sm:max-w-xl sm:rounded-hoja"
      >
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 size-64 rounded-full bg-niebla" />
        <div aria-hidden className="pointer-events-none absolute top-40 -right-32 size-64 rounded-full bg-agua" />
        <header className="relative px-6 pt-6 pb-2 sm:px-8">
          <button onClick={onClose} aria-label={t.close} className="grid size-12 place-items-center rounded-full bg-papel text-tinta shadow-suave">
            <X size={20} weight="bold" />
          </button>
          <h2 className="mt-5 text-3xl leading-tight sm:text-4xl">{title}</h2>
          {lead && <p className="mt-2 text-lg text-gris">{lead}</p>}
        </header>
        <div className="relative overflow-y-auto px-6 pt-4 pb-8 sm:px-8">{children}</div>
      </div>
    </div>
  )
}

/* ════════════ Lo que dice Potatonaut sobre el cultivo en esa parcela ════════════ */
export function useAnalisisParcela(p: Parcela | null | undefined) {
  const obj = useMemo(() => (p ? { tipo: 'area' as const, centro: p.centroide, anillo: openRing(p.geom) } : null), [p])
  return useAnalisis(obj)
}

export function AjusteBox({ parcela, cultivoId, fecha }: { parcela: Parcela; cultivoId: string; fecha?: string }) {
  const d = useDict()
  const t = d.cultivos.fit
  const { nombre } = useCatalogo()
  const { mesLargo, num } = useFmt()
  const { datos } = useAnalisisParcela(parcela)
  if (!cultivoId) return null

  let tono = 'bg-papel'
  let lineas: ReactNode[] = []
  if (!datos) lineas = [<span className="text-gris">{t.checking}</span>]
  else {
    const aj = ajusteCultivo(datos, cultivoId)
    if (!aj) {
      tono = 'bg-papa-suave'
      const mejores = datos.cultivosTop.slice(0, 3).map((c) => nombre(c.id)).join(', ')
      lineas = [<strong>{t.notTop}</strong>, mejores && fill(t.tryInstead, { list: mejores })]
    } else {
      const k = aj.suit >= 0.8 ? 'muyBuena' : aj.suit >= 0.6 ? 'buena' : aj.suit >= 0.4 ? 'regular' : 'dificil'
      const dist = distanciaMeses(fecha, aj.best_month)
      tono = aj.suit >= 0.6 && (dist === null || dist <= 1) ? 'bg-niebla' : 'bg-papa-suave'
      lineas = [
        <strong>{fill(t.good, { word: d.analisis.suitWord[k], pct: num(Math.round(aj.suit * 100)) })}</strong>,
        aj.best_month && fill(t.bestMonth, { mes: mesLargo(aj.best_month) }),
        dist !== null && (dist === 0 ? t.onTime : dist === 1 ? t.near : fill(t.far, { mes: mesLargo(aj.best_month) })),
        aj.limits && aj.limits !== 'ninguno' && (d.analisis.limits[aj.limits] ?? aj.limits),
      ]
    }
  }
  return (
    <div className="flex items-start gap-3">
      <Avatar k="potatonaut" fondo="casco" className="size-14" />
      <div className={`relative flex-1 rounded-[1.5rem] rounded-tl-md p-4 text-tinta ${tono}`}>
        <p className="text-xs font-bold tracking-wide text-gris uppercase">{t.title}</p>
        <div className="mt-1 space-y-0.5">
          {lineas.filter(Boolean).map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ════════════ Formulario de temporada (nueva o edición) ════════════ */
type EstadoForm = 'planificado' | 'sembrado' | 'cosechado' | 'perdido'

export function CicloForm({
  parcelas,
  ciclos,
  parcelaInicial,
  editar,
  onClose,
  onDeleted,
}: {
  parcelas: Parcela[]
  ciclos: Ciclo[]
  parcelaInicial?: number
  editar?: Ciclo
  onClose: () => void
  onDeleted?: () => void
}) {
  const t = useDict().cultivos
  const f = t.form
  const { lang } = useFmt()
  const { lista, nombre } = useCatalogo()
  const [parcelaId, setParcelaId] = useState<number>(editar?.parcelaId ?? parcelaInicial ?? parcelas[0]?.id ?? 0)
  const [cultivoId, setCultivoId] = useState(editar?.cultivoId ?? '')
  const [variedad, setVariedad] = useState(editar?.variedad ?? '')
  const [estado, setEstado] = useState<EstadoForm>(
    editar && ['planificado', 'sembrado', 'cosechado', 'perdido'].includes(editar.estado) ? (editar.estado as EstadoForm) : editar ? 'sembrado' : 'planificado',
  )
  const [fecha, setFecha] = useState(editar?.fechaSiembra ?? hoyISO())
  const [cierre, setCierre] = useState(editar?.fechaCierre ?? hoyISO())
  const [motivo, setMotivo] = useState(editar?.notaCierre ?? '')
  const [aprox, setAprox] = useState(!!editar?.fechaAproximada)
  const [area, setArea] = useState(editar?.areaSembradaM2 ? String(Math.round(editar.areaSembradaM2)) : '')
  const [notas, setNotas] = useState(editar?.notas ?? '')
  const [guardando, setGuardando] = useState(false)

  const parcela = parcelas.find((p) => p.id === parcelaId)
  const { datos } = useAnalisisParcela(parcela)
  const ocupada = ciclos.find((c) => c.parcelaId === parcelaId && esActivo(c) && c.id !== editar?.id)
  const bloqueada = !!ocupada && (estado === 'planificado' || estado === 'sembrado')
  const recomendados = (datos?.cultivosTop ?? []).filter((c) => c.suit >= 0.4)
  const idsRec = new Set(recomendados.map((c) => c.id))
  const otros = lista.filter((c) => !idsRec.has(c.id)).sort((a, b) => nombre(a.id).localeCompare(nombre(b.id), lang))
  const cerrado = estado === 'cosechado' || estado === 'perdido'

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!parcela?.id || !cultivoId || bloqueada) return
    setGuardando(true)
    const m2 = Number(area.replace(',', '.'))
    const datosCiclo = {
      parcelaId: parcela.id,
      cultivoId,
      variedad: variedad.trim() || undefined,
      estado,
      fechaSiembra: fecha,
      fechaAproximada: aprox || undefined,
      areaSembradaM2: m2 > 0 ? m2 : undefined,
      notas: notas.trim() || undefined,
      fechaCierre: cerrado ? cierre : undefined,
      notaCierre: estado === 'perdido' ? motivo.trim() || undefined : undefined,
    }
    if (editar?.id !== undefined) await editarCiclo(editar.id, datosCiclo)
    else await crearCiclo(datosCiclo)
    setGuardando(false)
    onClose()
  }

  const eliminar = async () => {
    if (!editar?.id || !window.confirm(f.confirmDelete)) return
    await borrarCiclo(editar.id)
    onClose()
    onDeleted?.()
  }

  return (
    <Modal title={editar ? f.editTitle : f.title} lead={editar ? undefined : f.lead} onClose={onClose}>
      <form onSubmit={guardar} className="space-y-6">
        <Campo label={f.plot}>
          <select className={INPUT} value={parcelaId} disabled={!!editar} onChange={(e) => setParcelaId(Number(e.target.value))}>
            {parcelas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} · {formatArea(p.areaM2, lang)}
              </option>
            ))}
          </select>
        </Campo>
        {bloqueada && ocupada && (
          <p className="rounded-[1.25rem] bg-papa-suave p-4 font-semibold text-papa-osc">{fill(f.busyPlot, { crop: nombre(ocupada.cultivoId) })}</p>
        )}

        <Campo label={f.crop}>
          <select className={INPUT} value={cultivoId} onChange={(e) => setCultivoId(e.target.value)} required>
            <option value="" disabled>
              {f.cropPlaceholder}
            </option>
            {recomendados.length > 0 && (
              <optgroup label={f.recommended}>
                {recomendados.map((c) => (
                  <option key={c.id} value={c.id}>
                    {nombre(c.id)} · {Math.round(c.suit * 100)} %
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={recomendados.length ? f.others : f.crop}>
              {otros.map((c) => (
                <option key={c.id} value={c.id}>
                  {nombre(c.id)}
                </option>
              ))}
            </optgroup>
          </select>
        </Campo>

        <Campo label={f.variety}>
          <input className={INPUT} value={variedad} onChange={(e) => setVariedad(e.target.value)} placeholder={f.varietyPh} />
        </Campo>

        <div>
          <span className="mb-2 block font-bold text-tinta">{f.status}</span>
          <Pildoras
            value={estado}
            onChange={setEstado}
            opts={[
              { v: 'planificado' as EstadoForm, label: f.planned },
              { v: 'sembrado' as EstadoForm, label: f.sown },
              ...(editar
                ? [
                    { v: 'cosechado' as EstadoForm, label: f.harvested },
                    { v: 'perdido' as EstadoForm, label: f.lost },
                  ]
                : []),
            ]}
          />
        </div>

        <div>
          <Campo label={estado === 'planificado' ? f.datePlanned : f.dateSown}>
            <input
              type="date"
              className={INPUT}
              value={fecha}
              max={estado === 'planificado' ? undefined : hoyISO()}
              onChange={(e) => setFecha(e.target.value)}
              required
            />
          </Campo>
          <label className="mt-3 flex items-center gap-3 font-semibold text-tinta">
            <input type="checkbox" className="size-5 accent-[#0E3B23]" checked={aprox} onChange={(e) => setAprox(e.target.checked)} />
            {f.approx}
          </label>
        </div>

        {cerrado && (
          <Campo label={f.dateClosed}>
            <input type="date" className={INPUT} value={cierre} max={hoyISO()} onChange={(e) => setCierre(e.target.value)} required />
          </Campo>
        )}
        {estado === 'perdido' && (
          <Campo label={t.detail.lostReason}>
            <input className={INPUT} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t.detail.lostReasonPh} />
          </Campo>
        )}

        {parcela && cultivoId && <AjusteBox parcela={parcela} cultivoId={cultivoId} fecha={fecha} />}

        <Campo label={f.area} help={parcela ? fill(f.areaHelp, { area: formatArea(parcela.areaM2, lang) }) : undefined}>
          <input className={INPUT} inputMode="decimal" value={area} onChange={(e) => setArea(e.target.value)} />
        </Campo>

        <Campo label={f.notes}>
          <textarea className={`${INPUT} h-auto min-h-24 py-4`} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </Campo>

        <div className="grid gap-3 pt-2">
          <button type="submit" className={BOTON} disabled={!cultivoId || bloqueada || guardando}>
            {guardando ? f.saving : editar ? f.saveChanges : f.save}
          </button>
          <button type="button" onClick={onClose} className={BOTON_2}>
            {f.cancel}
          </button>
          {editar && (
            <button type="button" onClick={eliminar} className="mt-2 min-h-12 rounded-full font-bold text-arcilla hover:bg-arcilla-suave">
              {f.delete}
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}

/* ════════════ Formulario de actividad (nueva o edición) ════════════ */
const UNIDADES: Partial<Record<TipoActividad, string[]>> = {
  riego: ['h'],
  abono: ['kg', 'bulto', 'L'],
  control: ['L', 'kg'],
  cosecha: ['kg', 'bulto', 'arroba', 't'],
}

export function ActividadForm({
  ciclo,
  tipoInicial = 'riego',
  editar,
  onClose,
}: {
  ciclo: Ciclo
  tipoInicial?: TipoActividad
  editar?: Evento
  onClose: () => void
}) {
  const t = useDict().cultivos
  const a = t.activity
  const dt = (editar?.datos ?? {}) as Record<string, string | number | undefined>
  const [tipo, setTipo] = useState<TipoActividad>((editar?.tipo as TipoActividad) ?? tipoInicial)
  const [fecha, setFecha] = useState(editar?.fecha ?? hoyISO())
  const [producto, setProducto] = useState(String(dt.producto ?? ''))
  const [objetivo, setObjetivo] = useState(String(dt.objetivo ?? ''))
  const [cantidad, setCantidad] = useState(dt.cantidad !== undefined ? String(dt.cantidad) : '')
  const [unidad, setUnidad] = useState(String(dt.unidad ?? ''))
  const [nota, setNota] = useState(String(dt.nota ?? ''))
  const [cierra, setCierra] = useState(!editar)
  const [guardando, setGuardando] = useState(false)
  const unidades = UNIDADES[tipo]
  const u = unidades?.includes(unidad) ? unidad : (unidades?.[0] ?? '')

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    const n = Number(cantidad.replace(',', '.'))
    const datos = {
      producto: (tipo === 'abono' || tipo === 'control') && producto.trim() ? producto.trim() : undefined,
      objetivo: tipo === 'control' && objetivo.trim() ? objetivo.trim() : undefined,
      cantidad: unidades && n > 0 ? n : undefined,
      unidad: unidades && n > 0 ? u : undefined,
      nota: nota.trim() || undefined,
    }
    if (editar?.id !== undefined) await editarEvento(editar.id, { tipo, fecha, datos })
    else {
      await anotar({ parcelaId: ciclo.parcelaId, cicloId: ciclo.id, tipo, fecha, datos })
      if (tipo === 'cosecha' && cierra && esActivo(ciclo)) await cerrarCiclo(ciclo, 'cosechado', fecha)
    }
    setGuardando(false)
    onClose()
  }

  const eliminar = async () => {
    if (!editar || !window.confirm(a.confirmDelete)) return
    await borrarEvento(editar)
    onClose()
  }

  return (
    <Modal title={editar ? a.editTitle : a.title} onClose={onClose}>
      <form onSubmit={guardar} className="space-y-6">
        <div>
          <span className="mb-3 block font-bold text-tinta">{a.type}</span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup">
            {ACTIVIDADES.map((v) => {
              const p = PERSONAJE[v]!
              const sel = tipo === v
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  onClick={() => setTipo(v)}
                  className={`flex flex-col items-center rounded-[1.5rem] border-2 p-3 text-center transition ${
                    sel ? 'border-bosque bg-papel shadow-suave' : 'border-transparent bg-papel/70 hover:border-borde'
                  }`}
                >
                  <Avatar k={p.k} fondo={p.fondo} className="size-16" />
                  <span className="mt-2 font-bold text-bosque">{a.types[v]}</span>
                  <span className="text-xs text-gris">{a.hints[v]}</span>
                </button>
              )
            })}
          </div>
        </div>

        <Campo label={a.date}>
          <input type="date" className={INPUT} value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} required />
        </Campo>

        {(tipo === 'abono' || tipo === 'control') && (
          <Campo label={a.product}>
            <input className={INPUT} value={producto} onChange={(e) => setProducto(e.target.value)} placeholder={a.productPh} />
          </Campo>
        )}
        {tipo === 'control' && (
          <Campo label={a.target}>
            <input className={INPUT} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder={a.targetPh} />
          </Campo>
        )}
        {unidades && (
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Campo label={a.amount}>
              <input className={INPUT} inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </Campo>
            <Campo label={a.unit}>
              <select className={INPUT} value={u} onChange={(e) => setUnidad(e.target.value)}>
                {unidades.map((x) => (
                  <option key={x} value={x}>
                    {a.units[x]}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        )}

        <Campo label={a.note}>
          <textarea className={`${INPUT} h-auto min-h-24 py-4`} value={nota} onChange={(e) => setNota(e.target.value)} placeholder={a.notePh} />
        </Campo>

        {tipo === 'cosecha' && !editar && esActivo(ciclo) && (
          <label className="flex items-center gap-3 font-semibold text-tinta">
            <input type="checkbox" className="size-5 accent-[#0E3B23]" checked={cierra} onChange={(e) => setCierra(e.target.checked)} />
            {a.closesSeason}
          </label>
        )}

        <div className="grid gap-3 pt-2">
          <button type="submit" className={BOTON} disabled={guardando}>
            {guardando ? t.form.saving : editar ? t.form.saveChanges : a.save}
          </button>
          <button type="button" onClick={onClose} className={BOTON_2}>
            {t.form.cancel}
          </button>
          {editar && (
            <button type="button" onClick={eliminar} className="mt-2 min-h-12 rounded-full font-bold text-arcilla hover:bg-arcilla-suave">
              {a.delete}
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}

/* ════════════ Línea de tiempo ════════════ */
export function Linea({
  entradas,
  parcelas,
  contexto = false,
  onSelect,
}: {
  entradas: Entrada[]
  parcelas?: Record<number, Parcela>
  contexto?: boolean
  onSelect?: (e: Entrada) => void
}) {
  const t = useDict().cultivos
  const a = t.activity
  const { nombre } = useCatalogo()
  const { fecha, num } = useFmt()
  return (
    <ol className="space-y-3">
      {entradas.map((e) => {
        const p = PERSONAJE[e.tipo]
        const dt = (e.evento?.datos ?? {}) as Record<string, string | number | undefined>
        const c = e.ciclo
        const detalle = [
          (e.tipo === 'siembra' || e.tipo === 'ciclo_planeado') && c ? `${nombre(c.cultivoId)}${c.variedad ? ` · ${c.variedad}` : ''}` : null,
          e.tipo === 'perdida' && c?.notaCierre ? c.notaCierre : null,
          dt.producto ? String(dt.producto) : null,
          dt.objetivo ? String(dt.objetivo) : null,
          dt.cantidad !== undefined ? `${num(Number(dt.cantidad), 2)} ${a.units[String(dt.unidad)] ?? dt.unidad ?? ''}` : null,
        ].filter(Boolean)
        const contenido = (
          <>
            {p ? (
              <Avatar k={p.k} fondo={p.fondo} className="size-14" />
            ) : (
              <span className={`size-14 shrink-0 rounded-full ${e.tipo === 'perdida' ? 'bg-arcilla-suave' : 'bg-niebla'}`} aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-bold text-bosque">{a.events[e.tipo] ?? e.tipo}</p>
                <p className="text-sm text-gris">{fecha(e.fecha)}</p>
              </div>
              {contexto && (
                <p className="text-sm font-semibold text-gris">
                  {[c && parcelas?.[c.parcelaId]?.nombre, c && e.tipo !== 'siembra' && e.tipo !== 'ciclo_planeado' && nombre(c.cultivoId)].filter(Boolean).join(' · ')}
                </p>
              )}
              {detalle.length > 0 && <p className="mt-0.5 text-tinta">{detalle.join(' · ')}</p>}
              {dt.nota && <p className="mt-0.5 text-gris">{dt.nota}</p>}
              {e.evento?.editadoEn && <p className="mt-1 text-xs text-gris">{a.edited}</p>}
            </div>
          </>
        )
        return (
          <li key={e.key}>
            {onSelect ? (
              <button
                onClick={() => onSelect(e)}
                className="flex w-full items-start gap-4 rounded-[1.5rem] bg-papel p-4 text-left shadow-suave transition hover:ring-2 hover:ring-pradera/50"
              >
                {contenido}
              </button>
            ) : (
              <div className="flex items-start gap-4 rounded-[1.5rem] bg-papel p-4 shadow-suave">{contenido}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
