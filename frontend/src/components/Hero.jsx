import { siGithub } from 'simple-icons'

import { LINKS, TEMP_STATUS } from '../config.js'
import { linkedin } from '../logos.js'
import { BrandIcon } from './BrandIcon.jsx'
import { Icon } from './Icon.jsx'

export function Hero() {
  return (
    <header className="hero">
      <div className="hero__text">
        <h1 className="hero__name">Muhammad Alfatih Arrazy</h1>
        <p className="hero__intro">
          Information Technology student @ University of Technology Sydney. I like engineering API
          infrastructure, distributed systems, and working with data-intensive systems.
        </p>

        {/* Temporary text until the Discord bot can set it through the API */}
        <div className="status">
          <span className="status__label">Status</span>
          <span className="status__text">{TEMP_STATUS.text}</span>
          <span className="status__time">{TEMP_STATUS.ago}</span>
        </div>

        <nav className="hero__links" aria-label="Profile links">
          <a className="button button--primary" href={LINKS.resume} target="_blank" rel="noopener">
            <Icon name="file" />
            Resume
          </a>
          <a className="button" href={LINKS.github} target="_blank" rel="noopener">
            <BrandIcon icon={siGithub} />
            GitHub
            <Icon name="arrowUpRight" size={14} />
          </a>
          <a className="button" href={LINKS.linkedin} target="_blank" rel="noopener">
            <BrandIcon icon={linkedin} />
            LinkedIn
            <Icon name="arrowUpRight" size={14} />
          </a>
        </nav>
      </div>

      <img
        className="hero__avatar"
        src="/avatar.png"
        alt="Arrazy's Minecraft avatar: a capybara head in a black suit and red tie"
        width="219"
        height="279"
      />
    </header>
  )
}
