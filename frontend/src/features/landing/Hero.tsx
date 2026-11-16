import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { ArrowRight, GlobeHemisphereWest } from '@phosphor-icons/react'
import { useDict } from '../../i18n/useDict'

/**
 * Hero. En el video la cámara termina acercándose y Potatonaut ocupa el centro, así que el texto no va encima:
 * en escritorio el video ocupa la izquierda y se funde con el turquesa del cielo (token `cielo`), y el texto
 * ocupa el lado derecho de la pantalla, ancho, para que el título respire en pocas líneas.
 * En móvil el texto va arriba y el video debajo. Una colina verde une ambos lados.
 * El uso de IA en las ilustraciones se declara en AI_USAGE.md.
 * Contraste: título y entrada son texto grande (≥ 19 px en negrita) blanco sobre cielo → 3,2:1 (AA texto grande).
 */
export function Hero() {
  const d = useDict()
  const video = useRef<HTMLVideoElement>(null)

  // Si la persona pidió reducir el movimiento, el video queda quieto en su primer cuadro.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) video.current?.pause()
  }, [])

  return (
    <section className="relative isolate flex flex-col overflow-hidden bg-[linear-gradient(to_bottom,#2f8aa3,#3c9cb4_45%)] md:block md:min-h-[100svh] md:bg-cielo">
      {/* Video */}
      <div className="relative order-2 h-[52svh] md:absolute md:inset-y-0 md:left-0 md:h-auto md:w-[66%]">
        <video
          ref={video}
          className="h-full w-full object-cover [mask-image:linear-gradient(to_bottom,transparent,black_22%)] md:[mask-image:linear-gradient(to_right,black_74%,transparent)]"
          autoPlay
          muted
          loop
          playsInline
          poster="/media/hero-poster.webp"
          aria-hidden
        >
          <source src="/media/hero-854.mp4" type="video/mp4" media="(max-width: 760px)" />
          <source src="/media/hero-1280.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Texto sobre el cielo, en el lado derecho */}
      <div className="relative order-1 w-full px-5 pt-24 md:absolute md:inset-y-0 md:right-0 md:flex md:w-[50%] md:items-center md:px-0 md:pt-16 md:pr-10 md:pb-28 lg:w-[46%] xl:pr-20">
        <div className="hero-entrada max-w-[40rem] text-white">
          <h1 className="text-[2.6rem] leading-[1.04] text-balance text-white sm:text-6xl lg:text-[4.25rem] xl:text-[4.75rem]">{d.hero.title}</h1>
          <p className="mt-6 max-w-[34rem] text-[1.2rem] leading-relaxed font-bold text-white md:text-xl">{d.hero.lead}</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              to="/finca"
              className="group inline-flex min-h-14 items-center gap-4 rounded-full bg-bosque py-2 pr-2 pl-7 font-bold text-crema shadow-[0_14px_30px_-12px_rgb(14_59_35/0.7)] transition hover:bg-bosque-700 focus-visible:ring-4 focus-visible:ring-white/60 focus-visible:outline-none"
            >
              {d.hero.cta1}
              <span className="grid size-10 place-items-center rounded-full bg-pradera text-bosque transition-transform duration-300 group-hover:translate-x-1 group-hover:rotate-[-8deg]">
                <ArrowRight size={18} weight="bold" aria-hidden />
              </span>
            </Link>
            <Link
              to="/explorar"
              className="inline-flex min-h-14 items-center gap-2.5 rounded-full border border-white/50 bg-white/15 px-6 font-bold text-white backdrop-blur-md transition hover:border-white hover:bg-white/25 focus-visible:ring-4 focus-visible:ring-white/60 focus-visible:outline-none"
            >
              <GlobeHemisphereWest size={20} weight="duotone" aria-hidden />
              {d.hero.cta2}
            </Link>
          </div>
        </div>
      </div>

      {/* Colinas: una verde que continúa el pasto del video y la curva crema que da paso a la página. */}
      <svg aria-hidden className="absolute inset-x-0 bottom-0 z-0 h-20 w-full md:h-32" viewBox="0 0 1440 160" preserveAspectRatio="none">
        <path fill="#7AB22A" d="M0 96 C 320 58 640 44 940 56 S 1300 78 1440 34 V160 H0 Z" />
        <path fill="#FFF9F5" d="M0 128 C 260 92 540 84 790 108 S 1220 158 1440 112 V160 H0 Z" />
      </svg>
    </section>
  )
}
