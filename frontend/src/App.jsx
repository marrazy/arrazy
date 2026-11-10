import { Aqi } from './components/Aqi.jsx'
import { Experience } from './components/Experience.jsx'
import { Hero } from './components/Hero.jsx'
import { Icon } from './components/Icon.jsx'
import { LocalTime } from './components/LocalTime.jsx'
import { NowPlaying } from './components/NowPlaying.jsx'
import { Reading } from './components/Reading.jsx'
import { Works, WorksHeading } from './components/Works.jsx'
import { LINKS } from './config.js'

export default function App() {
  return (
    <div className="page">
      <Hero />

      <main className="stack">
        <div className="row row--stretch">
          <div className="column column--narrow">
            <NowPlaying />
            <WorksHeading />
          </div>
          <div className="column column--wide">
            <Experience />
          </div>
        </div>

        <Works />

        <div className="row">
          <Aqi />
          <Reading />
          <LocalTime />
        </div>
      </main>

      <footer className="footer">
        <span>© {new Date().getFullYear()} · Built with FastAPI, Vite, AWS and Cloudflare.</span>
        <a className="project__link" href={LINKS.repo} target="_blank" rel="noopener">
          Repo
          <Icon name="arrowUpRight" size={14} />
        </a>
      </footer>
    </div>
  )
}
