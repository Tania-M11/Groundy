import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft } from '@phosphor-icons/react'
import { useDict } from '../../i18n/useDict'
import { db, type Evento } from '../../data/db'
import { cerrarCiclo, esActivo, hoyISO, lineaDeTiempo, marcarSembrado, useCatalogo, type Entrada } from '../../data/registros'
import { formatArea } from '../../lib/geo'
import { useContextoChat } from '../../app/uiStore'
import {
  ActividadForm,
  AjusteBox,
  BOTON,
  BOTON_2,
  BOTON_CLARO,
  BOTON_CLARO_2,
  Campo,
  CicloForm,
  EstadoChip,
  INPUT,
  Linea,
  Modal,
  TarjetaClara,
  TarjetaVerde,
  useFmt,
  useTiempoCiclo,
} from './ui'

type Ventana = null | 'actividad' | 'cosecha' | 'sembrar' | 'perdido' | 'editar' | { evento: Evento }

/** Una temporada: sus datos, lo que se puede hacer según el estado y todo lo anotado (editable). */
export default function CycleDetailPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const d = useDict()
  const t = d.cultivos
  const dt = t.detail
  const { nombre } = useCatalogo()
  const { lang, fecha } = useFmt()
  const tiempo = useTiempoCiclo()
  // undefined = cargando · null = no existe
  const ciclo = useLiveQuery(() => db.ciclos.get(id).then((c) => c ?? null), [id])
  const parcelas = useLiveQuery(() => db.parcelas.toArray(), [])
  const ciclos = useLiveQuery(() => db.ciclos.toArray(), [])
  const eventos = useLiveQuery(() => db.eventos.where('cicloId').equals(id).toArray(), [id])
  const [ventana, setVentana] = useState<Ventana>(null)
  const [fechaM, setFechaM] = useState(hoyISO())
  const [motivo, setMotivo] = useState('')
  const cerrar = () => setVentana(null)
  const pCtx = ciclo ? parcelas?.find((p) => p.id === ciclo.parcelaId) : undefined
  useContextoChat(ciclo && pCtx ? { lat: pCtx.centroide[1], lon: pCtx.centroide[0], lugar: pCtx.nombre, cultivoId: ciclo.cultivoId } : null)

  if (ciclo === undefined) return null
  if (!ciclo)
    return (
      <div className="pt-10">
        <p className="text-lg text-gris">{dt.notFound}</p>
        <Link to="/finca/cultivos" className={`${BOTON_2} mt-5`}>
          {dt.back}
        </Link>
      </div>
    )

  const parcela = parcelas?.find((p) => p.id === ciclo.parcelaId)
  const activo = esActivo(ciclo)
  const entradas = lineaDeTiempo([ciclo], eventos ?? [])
  const seleccionar = (e: Entrada) => setVentana(e.evento ? { evento: e.evento } : 'editar')

  return (
    <>
      <Link to="/finca/cultivos" className="inline-flex items-center gap-3 pt-2 font-bold text-tinta">
        <span className="grid size-12 place-items-center rounded-full bg-papel shadow-suave">
          <ArrowLeft size={20} weight="bold" aria-hidden />
        </span>
        {dt.back}
      </Link>

      <TarjetaVerde personaje={activo ? (ciclo.estado === 'planificado' ? 'abuelita' : 'regadera') : 'granjera'} className="mt-6">
        {parcela && (
          <p className="text-xs font-bold tracking-wide text-casco uppercase">
            {parcela.nombre} · {formatArea(ciclo.areaSembradaM2 ?? parcela.areaM2, lang)}
          </p>
        )}
        <h1 className="mt-2 text-5xl leading-none text-crema lg:text-6xl">{nombre(ciclo.cultivoId)}</h1>
        {ciclo.variedad && <p className="mt-2 text-lg text-crema/80">{ciclo.variedad}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <EstadoChip estado={ciclo.estado} sobreOscuro />
          {activo && <span className="font-semibold">{tiempo(ciclo)}</span>}
        </div>
        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-crema/85">
          {ciclo.fechaSiembra && (
            <div>
              <dt className="text-xs font-bold tracking-wide text-casco uppercase">{ciclo.estado === 'planificado' ? dt.planned : dt.sown}</dt>
              <dd className="font-semibold">{`${ciclo.fechaAproximada ? '≈ ' : ''}${fecha(ciclo.fechaSiembra)}`}</dd>
            </div>
          )}
          {ciclo.fechaCierre && !activo && (
            <div>
              <dt className="text-xs font-bold tracking-wide text-casco uppercase">{dt.closedOn}</dt>
              <dd className="font-semibold">{fecha(ciclo.fechaCierre)}</dd>
            </div>
          )}
        </dl>
        {ciclo.notas && <p className="mt-4 max-w-lg text-crema/80">{ciclo.notas}</p>}

        <div className="mt-7 flex flex-wrap gap-2.5">
          {ciclo.estado === 'planificado' && (
            <button onClick={() => setVentana('sembrar')} className={BOTON_CLARO}>
              {dt.markSown}
            </button>
          )}
          {activo && ciclo.estado !== 'planificado' && (
            <>
              <button onClick={() => setVentana('actividad')} className={BOTON_CLARO}>
                {t.addActivity}
              </button>
              <button onClick={() => setVentana('cosecha')} className={BOTON_CLARO_2}>
                {dt.harvest}
              </button>
            </>
          )}
          <button onClick={() => setVentana('editar')} className={BOTON_CLARO_2}>
            {dt.edit}
          </button>
          {activo && ciclo.estado !== 'planificado' && (
            <button onClick={() => setVentana('perdido')} className="min-h-12 rounded-full px-5 font-bold text-papa hover:bg-crema/10">
              {dt.lost}
            </button>
          )}
        </div>
      </TarjetaVerde>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <section>
          <h2 className="text-3xl">{dt.timeline}</h2>
          <p className="mt-1 text-gris">{dt.timelineHint}</p>
          <div className="mt-5">
            <Linea entradas={entradas} onSelect={seleccionar} />
            {(eventos?.length ?? 0) === 0 && <p className="mt-4 rounded-[1.5rem] bg-papel/70 p-5 text-gris">{dt.emptyTimeline}</p>}
          </div>
        </section>
        {parcela && (
          <aside className="space-y-4">
            <AjusteBox parcela={parcela} cultivoId={ciclo.cultivoId} fecha={ciclo.fechaSiembra} />
            <TarjetaClara mancha="casco">
              <p className="font-bold text-tinta">{parcela.nombre}</p>
              <p className="text-sm text-gris">{formatArea(parcela.areaM2, lang)}</p>
              <Link to="/finca/mapa" className={`${BOTON_2} mt-4`}>
                {dt.seeOnMap}
              </Link>
            </TarjetaClara>
          </aside>
        )}
      </div>

      {(ventana === 'actividad' || ventana === 'cosecha') && (
        <ActividadForm ciclo={ciclo} tipoInicial={ventana === 'cosecha' ? 'cosecha' : 'riego'} onClose={cerrar} />
      )}
      {ventana && typeof ventana === 'object' && <ActividadForm ciclo={ciclo} editar={ventana.evento} onClose={cerrar} />}
      {ventana === 'editar' && parcelas && ciclos && (
        <CicloForm parcelas={parcelas} ciclos={ciclos} editar={ciclo} onClose={cerrar} onDeleted={() => navigate('/finca/cultivos')} />
      )}

      {ventana === 'sembrar' && (
        <Modal title={dt.markSown} onClose={cerrar}>
          <form
            className="space-y-6"
            onSubmit={async (e) => {
              e.preventDefault()
              await marcarSembrado(ciclo, fechaM)
              cerrar()
            }}
          >
            <Campo label={t.form.dateSown}>
              <input type="date" className={INPUT} value={fechaM} max={hoyISO()} onChange={(e) => setFechaM(e.target.value)} required />
            </Campo>
            {parcela && <AjusteBox parcela={parcela} cultivoId={ciclo.cultivoId} fecha={fechaM} />}
            <div className="grid gap-3">
              <button type="submit" className={BOTON}>
                {dt.save}
              </button>
              <button type="button" onClick={cerrar} className={BOTON_2}>
                {t.form.cancel}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {ventana === 'perdido' && (
        <Modal title={dt.lostTitle} onClose={cerrar}>
          <form
            className="space-y-6"
            onSubmit={async (e) => {
              e.preventDefault()
              await cerrarCiclo(ciclo, 'perdido', fechaM, motivo.trim() || undefined)
              cerrar()
            }}
          >
            <Campo label={t.activity.date}>
              <input type="date" className={INPUT} value={fechaM} max={hoyISO()} onChange={(e) => setFechaM(e.target.value)} required />
            </Campo>
            <Campo label={dt.lostReason}>
              <input className={INPUT} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={dt.lostReasonPh} />
            </Campo>
            <div className="grid gap-3">
              <button type="submit" className={BOTON}>
                {dt.save}
              </button>
              <button type="button" onClick={cerrar} className={BOTON_2}>
                {t.form.cancel}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
