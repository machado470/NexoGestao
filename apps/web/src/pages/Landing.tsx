import LayoutBase from '../components/layout/LayoutBase'
import Hero from '../modules/landing/Hero'
import Governance from '../modules/landing/Governance'
import HowItWorks from '../modules/landing/HowItWorks'
import Modules from '../modules/landing/Modules'
import ExecutivePreview from '../modules/landing/ExecutivePreview'
import Security from '../modules/landing/Security'
import CTA from '../modules/landing/CTA'
import Footer from '../modules/landing/Footer'

export default function Landing() {
  return (
    <LayoutBase>
      <Hero />
      <Governance />
      <HowItWorks />
      <Modules />
      <ExecutivePreview />
      <Security />
      <CTA />
      <Footer />
    </LayoutBase>
  )
}
