import React from 'react'
import HeroSection from './HeroSection'
import FeatureSection from './FeatureSection'
import DiscoverSec from './DiscoverSec'
import CallToActionSection from './CalltoAction'
import FooterSection from './FooterSection'

const Landing = () => {
  return (
    <div>
        <HeroSection />
        <FeatureSection/>
        <DiscoverSec />
        <CallToActionSection/>
        <FooterSection/>
    </div>
  )
}

export default Landing