import { SiteNav } from './SiteNav'
import { Hero } from './Hero'
import { GlobeSection, EdgeSection, Platform, ScaleLens, HowItWorks, MeetPotatonaut, TeamAndCta } from './Sections'
import { SiteFooter } from './SiteFooter'

export default function LandingPage() {
  return (
    <>
      <SiteNav overHero />
      <main>
        <Hero />
        <GlobeSection />
        <EdgeSection />
        <Platform />
        <ScaleLens />
        <HowItWorks />
        <MeetPotatonaut />
        <TeamAndCta />
      </main>
      <SiteFooter />
    </>
  )
}
