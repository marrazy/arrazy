import { TOOLS } from '../config.js'
import { BrandIcon } from './BrandIcon.jsx'
import { Icon } from './Icon.jsx'

export function Experience() {
  return (
    <section className="card experience">
      <h2 className="card__title">Experience &amp; tools</h2>
      <p className="experience__text">
        Experienced with working on uncleaned data from real Hong Kong International Airport supply
        chain analysis, to being a finalist at Deloitte's IT Hackathon Competition working on data
        migration.
      </p>
      <div className="divider" />
      <ul className="tools" aria-label="Tools">
        {TOOLS.map((tool) => (
          <li className="tool" key={tool.name}>
            <span className="tool__icon">
              {tool.logos ? (
                tool.logos.map((logo) => <BrandIcon key={logo.title} icon={logo} size={18} />)
              ) : (
                <Icon name={tool.icon} size={18} strokeWidth={1.8} />
              )}
            </span>
            <span className="tool__name">{tool.name}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
