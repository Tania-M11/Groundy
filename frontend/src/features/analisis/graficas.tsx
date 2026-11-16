import { useEffect, useRef, useState, type ReactNode } from 'react'

/*
 * Gráficas propias en SVG (sin librerías): medidas al ancho real del panel, trazos finos,
 * rejilla discreta, una sola serie por gráfica (el título la nombra) y valor al pasar el cursor o tocar.
 * Reglas: barras ≤ 24 px con punta redondeada de 4 px y base recta; líneas de 2 px; área al 10 %;
 * marcadores ≥ 8 px con anillo del color de fondo; el texto nunca lleva el color de la serie.
 */

const TINTA = '#1F2A24'
const GRIS = '#5E6B64'
const REJILLA = '#ECE6DF'
const FONDO = '#FFFFFF'

function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return { ref, w }
}

function redondo(x: number) {
  if (x <= 0) return 1
  const e = Math.pow(10, Math.floor(Math.log10(x)))
  const f = x / e
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e
}

type Serie = {
  valores: (number | null)[]
  /** Iniciales de los meses (eje) y nombres completos (tooltip). */
  meses: string[]
  mesesLargos: string[]
  /** Mes resaltado (el actual). */
  resaltar?: number
  color: string
  formato: (v: number) => string
  /** Formato corto del eje (solo número; la unidad va en el título). */
  eje?: (v: number) => string
  etiquetaResaltado?: string
  alto?: number
}

function Tooltip({ x, ancho, children }: { x: number; ancho: number; children: ReactNode }) {
  const izq = Math.max(0, Math.min(ancho - 132, x - 66))
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 w-[132px] rounded-xl bg-bosque px-3 py-2 text-center text-crema shadow-flota"
      style={{ left: izq }}
      role="status"
    >
      {children}
    </div>
  )
}

/** Columnas mes a mes (magnitud: lluvia). El mes actual va en el tono pleno; los demás, más claros. */
export function Columnas({ valores, meses, mesesLargos, resaltar, color, formato, eje = formato, etiquetaResaltado, alto = 180 }: Serie) {
  const { ref, w } = useAncho<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const pl = 36
  const pr = 4
  const pt = 46
  const pb = 24
  const validos = valores.filter((v): v is number => v !== null)
  const max = redondo(Math.max(...validos, 1))
  const banda = w > 0 ? (w - pl - pr) / 12 : 0
  const bw = Math.min(24, banda * 0.6)
  const y = (v: number) => pt + (alto - pt - pb) * (1 - v / max)
  const ticks = [0, max / 2, max]

  const mover = (e: React.PointerEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect()
    const i = Math.floor((e.clientX - r.left - pl) / banda)
    setHover(i >= 0 && i < 12 && valores[i] !== null ? i : null)
  }
  const activo = hover ?? null

  return (
    <div ref={ref} className="relative">
      {w > 0 && (
        <svg width={w} height={alto} onPointerMove={mover} onPointerDown={mover} onPointerLeave={() => setHover(null)} className="touch-pan-y">
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={pl} x2={w - pr} y1={y(tk)} y2={y(tk)} stroke={REJILLA} strokeWidth={1} />
              <text x={pl - 6} y={y(tk) + 4} textAnchor="end" fontSize={11} fill={GRIS}>
                {eje(tk)}
              </text>
            </g>
          ))}
          {valores.map((v, i) => {
            if (v === null) return null
            const x = pl + banda * i + (banda - bw) / 2
            const top = y(v)
            const base = y(0)
            const r = Math.min(4, (base - top) / 2)
            const d = `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z`
            const pleno = i === resaltar || i === activo
            return <path key={i} d={d} fill={color} opacity={pleno ? 1 : activo !== null ? 0.35 : 0.5} />
          })}
          {meses.map((m, i) => (
            <text
              key={i}
              x={pl + banda * i + banda / 2}
              y={alto - 6}
              textAnchor="middle"
              fontSize={11}
              fontWeight={i === resaltar ? 700 : 500}
              fill={i === resaltar ? TINTA : GRIS}
            >
              {m}
            </text>
          ))}
          {/* Etiqueta directa solo en el mes actual */}
          {resaltar !== undefined && valores[resaltar] !== null && activo === null && (
            <text x={pl + banda * resaltar + banda / 2} y={y(valores[resaltar]!) - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill={TINTA}>
              {formato(valores[resaltar]!)}
            </text>
          )}
        </svg>
      )}
      {activo !== null && valores[activo] !== null && (
        <Tooltip x={pl + banda * activo + banda / 2} ancho={w}>
          <span className="block text-xs text-casco capitalize">
            {mesesLargos[activo]}
            {activo === resaltar && etiquetaResaltado ? ` · ${etiquetaResaltado}` : ''}
          </span>
          <span className="block font-bold">{formato(valores[activo]!)}</span>
        </Tooltip>
      )}
    </div>
  )
}

/** Curva mes a mes (línea de 2 px + lavado al 10 %), con cruz y punto al pasar el cursor. */
export function Curva({ valores, meses, mesesLargos, resaltar, color, formato, eje = formato, etiquetaResaltado, alto = 160 }: Serie) {
  const { ref, w } = useAncho<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const pl = 40
  const pr = 10
  const pt = 46
  const pb = 24
  const validos = valores.filter((v): v is number => v !== null)
  if (validos.length < 2) return null
  const lo0 = Math.min(...validos)
  const hi0 = Math.max(...validos)
  const paso = redondo((hi0 - lo0 || Math.abs(hi0) * 0.1 || 1) / 2)
  const lo = Math.floor(lo0 / paso) * paso
  const hi = Math.max(Math.ceil(hi0 / paso) * paso, lo + paso)
  const ticks: number[] = []
  for (let v = lo; v <= hi + paso / 2; v += paso) ticks.push(+v.toFixed(6))
  const paso12 = w > 0 ? (w - pl - pr) / 11 : 0
  const x = (i: number) => pl + paso12 * i
  const y = (v: number) => pt + (alto - pt - pb) * (1 - (v - lo) / (hi - lo))

  // Tramos continuos (un mes sin dato corta la línea en vez de inventarlo).
  const tramos: [number, number][][] = []
  let actual: [number, number][] = []
  valores.forEach((v, i) => {
    if (v === null) {
      if (actual.length) tramos.push(actual)
      actual = []
    } else actual.push([x(i), y(v)])
  })
  if (actual.length) tramos.push(actual)
  const linea = (pts: [number, number][]) => pts.map(([a, b], j) => `${j ? 'L' : 'M'}${a.toFixed(1)},${b.toFixed(1)}`).join('')

  const mover = (e: React.PointerEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect()
    const i = Math.round((e.clientX - r.left - pl) / paso12)
    setHover(i >= 0 && i < 12 && valores[i] !== null ? i : null)
  }
  const punto = hover ?? (resaltar !== undefined && valores[resaltar] !== null ? resaltar : null)

  return (
    <div ref={ref} className="relative">
      {w > 0 && (
        <svg width={w} height={alto} onPointerMove={mover} onPointerDown={mover} onPointerLeave={() => setHover(null)} className="touch-pan-y">
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={pl} x2={w - pr} y1={y(tk)} y2={y(tk)} stroke={REJILLA} strokeWidth={1} />
              <text x={pl - 6} y={y(tk) + 4} textAnchor="end" fontSize={11} fill={GRIS}>
                {eje(tk)}
              </text>
            </g>
          ))}
          {tramos.map((pts, k) =>
            pts.length > 1 ? (
              <g key={k}>
                <path d={`${linea(pts)}L${pts[pts.length - 1][0]},${y(lo)}L${pts[0][0]},${y(lo)}Z`} fill={color} opacity={0.1} />
                <path d={linea(pts)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              </g>
            ) : null,
          )}
          {meses.map((m, i) => (
            <text key={i} x={x(i)} y={alto - 6} textAnchor="middle" fontSize={11} fontWeight={i === resaltar ? 700 : 500} fill={i === resaltar ? TINTA : GRIS}>
              {m}
            </text>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pt - 6} y2={alto - pb} stroke={GRIS} strokeWidth={1} opacity={0.5} />}
          {punto !== null && (
            <>
              <circle cx={x(punto)} cy={y(valores[punto]!)} r={5.5} fill={color} stroke={FONDO} strokeWidth={2} />
              {hover === null && (
                <text x={Math.min(Math.max(x(punto), pl + 16), w - pr - 16)} y={y(valores[punto]!) - 12} textAnchor="middle" fontSize={12} fontWeight={700} fill={TINTA}>
                  {formato(valores[punto]!)}
                </text>
              )}
            </>
          )}
        </svg>
      )}
      {hover !== null && (
        <Tooltip x={x(hover)} ancho={w}>
          <span className="block text-xs text-casco capitalize">
            {mesesLargos[hover]}
            {hover === resaltar && etiquetaResaltado ? ` · ${etiquetaResaltado}` : ''}
          </span>
          <span className="block font-bold">{formato(valores[hover]!)}</span>
        </Tooltip>
      )}
    </div>
  )
}

/** Barra horizontal sobre una escala con zonas (p. ej. lluvia anual 0–3.000 mm), con el rango medido encima. */
export function BarraZonas({
  desde,
  hasta,
  escala,
  zonas,
  formato,
}: {
  desde: number
  hasta: number
  escala: number
  zonas: { hasta: number; nombre: string }[]
  formato: (v: number) => string
}) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / escala) * 100))}%`
  const ancho = Math.max(1.5, ((Math.min(hasta, escala) - Math.min(desde, escala)) / escala) * 100)
  return (
    <div>
      <div className="relative h-3 overflow-hidden rounded-full bg-agua">
        {zonas.slice(0, -1).map((z) => (
          <span key={z.hasta} className="absolute inset-y-0 w-0.5 bg-papel" style={{ left: pct(z.hasta) }} aria-hidden />
        ))}
        <span className="absolute inset-y-0 rounded-full bg-cielo" style={{ left: pct(desde), width: `${ancho}%` }} />
      </div>
      <div className="relative mt-1.5 h-4 text-xs text-gris">
        {zonas.map((z, i) => {
          const ini = i === 0 ? 0 : zonas[i - 1].hasta
          return (
            <span key={z.nombre} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pct((ini + Math.min(z.hasta, escala)) / 2) }}>
              {z.nombre}
            </span>
          )
        })}
      </div>
      <span className="sr-only">
        {formato(desde)} – {formato(hasta)}
      </span>
    </div>
  )
}

/** Dos barras en la misma escala para comparar (lluvia frente a lo que pierde el campo). */
export function Comparacion({ filas, formato }: { filas: { nombre: string; valor: number; clase: string }[]; formato: (v: number) => string }) {
  const max = Math.max(...filas.map((f) => f.valor), 1)
  return (
    <div className="space-y-2.5">
      {filas.map((f) => (
        <div key={f.nombre}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-gris">{f.nombre}</span>
            <span className="font-bold text-tinta">{formato(f.valor)}</span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-niebla">
            <div className={`h-full rounded-full ${f.clase}`} style={{ width: `${(f.valor / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Escala de categorías en pasos (p. ej. inclinación), con el paso actual marcado. */
export function Escalones({ pasos, activo }: { pasos: string[]; activo: number }) {
  return (
    <div>
      <div className="flex gap-1" aria-hidden>
        {pasos.map((p, i) => (
          <span key={p} className={`h-2.5 flex-1 rounded-full ${i < activo ? 'bg-pradera/50' : i === activo ? 'bg-pradera-osc' : 'bg-niebla'}`} />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-gris">
        <span>{pasos[0]}</span>
        <span>{pasos[pasos.length - 1]}</span>
      </div>
    </div>
  )
}

/** Barra de verdes (0 → 1) con un marcador en el valor medido. */
export function Gradiente({ valor, bajo, alto }: { valor: number; bajo: string; alto: string }) {
  const p = Math.max(2, Math.min(98, valor * 100))
  return (
    <div>
      <div className="relative h-3 rounded-full bg-linear-to-r from-brote via-pradera to-pradera-osc">
        <span className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-papel bg-bosque shadow-suave" style={{ left: `${p}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-gris">
        <span>{bajo}</span>
        <span>{alto}</span>
      </div>
    </div>
  )
}

/** Rango mínimo–máximo con el promedio marcado (altura dentro de la parcela). */
export function Rango({ min, max, media, formato, etiquetaMedia }: { min: number; max: number; media: number; formato: (v: number) => string; etiquetaMedia: string }) {
  const p = max > min ? ((media - min) / (max - min)) * 100 : 50
  return (
    <div className="pt-6">
      <div className="relative h-2.5 rounded-full bg-linear-to-r from-hoja to-pradera-osc">
        <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-papel bg-bosque" style={{ left: `${p}%` }} />
        <span className="absolute -top-6 -translate-x-1/2 text-xs font-bold whitespace-nowrap text-tinta" style={{ left: `${Math.max(12, Math.min(88, p))}%` }}>
          {etiquetaMedia} {formato(media)}
        </span>
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-gris">
        <span>{formato(min)}</span>
        <span>{formato(max)}</span>
      </div>
    </div>
  )
}

/** Escala logarítmica de resolución: qué tan de cerca mira cada fuente (10 m → 55 km). */
export function EscalaResolucion({
  filas,
  izquierda,
  derecha,
}: {
  filas: { nombre: string; mide: string; metros: number; etiqueta: string }[]
  izquierda: string
  derecha: string
}) {
  const lmin = Math.log10(5)
  const lmax = Math.log10(60_000)
  const pct = (m: number) => ((Math.log10(m) - lmin) / (lmax - lmin)) * 100
  return (
    <div>
      <ul className="space-y-3">
        {filas.map((f) => (
          <li key={f.nombre + f.mide}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>
                <span className="font-bold text-tinta">{f.mide}</span>
                <span className="text-gris"> · {f.nombre}</span>
              </span>
              <span className="font-semibold whitespace-nowrap text-tinta">{f.etiqueta}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-niebla">
              <div className="h-full rounded-full bg-cielo" style={{ width: `${Math.max(4, pct(f.metros))}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex justify-between text-xs font-semibold text-gris">
        <span>← {izquierda}</span>
        <span>{derecha} →</span>
      </div>
    </div>
  )
}

/** Cuándo sembrar: una fila por cultivo y una columna por mes; el mejor mes marcado y el mes actual sombreado. */
export function CalendarioSiembra({ filas, meses, hoy }: { filas: { nombre: string; mejor: number }[]; meses: string[]; hoy: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-separate border-spacing-y-1.5 text-sm">
        <thead>
          <tr>
            <th className="w-[38%]" />
            {meses.map((m, i) => (
              <th key={i} className={`pb-1 text-center text-[0.68rem] font-bold ${i === hoy ? 'text-tinta' : 'text-gris'}`} scope="col">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.nombre}>
              <th scope="row" className="truncate pr-2 text-left font-semibold text-tinta">
                {f.nombre}
              </th>
              {meses.map((_, i) => (
                <td key={i} className={`h-7 p-0 text-center ${i === hoy ? 'bg-agua' : ''} ${i === 0 ? 'rounded-l-full' : ''} ${i === 11 ? 'rounded-r-full' : ''}`}>
                  {i === f.mejor ? (
                    <span className="mx-auto block size-4 rounded-full bg-pradera-osc ring-2 ring-papel" title={meses[i]} />
                  ) : (
                    <span className="mx-auto block size-1.5 rounded-full bg-borde" aria-hidden />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
