import { PROJECTS } from '../config.js'
import { Icon } from './Icon.jsx'

export function WorksHeading() {
  return (
    <div className="works-heading">
      <h2 className="card__title">Selected works</h2>
      <span className="works-heading__line" aria-hidden="true" />
      <span className="works-heading__count">2 projects</span>
      <Icon name="arrowDown" size={18} />
    </div>
  )
}

function ProjectLink({ url, label }) {
  if (!url) {
    return (
      <span className="project__link is-disabled" aria-disabled="true" title="Coming soon">
        {label}
        <Icon name="arrowUpRight" size={14} />
      </span>
    )
  }
  return (
    <a className="project__link" href={url} target="_blank" rel="noopener">
      {label}
      <Icon name="arrowUpRight" size={14} />
    </a>
  )
}

function StoryDiagram() {
  const ending = (label, highlight = false) => (
    <span className="tree__leaf">
      <span className="tree__line tree__line--short" />
      <span className={`tree__ending${highlight ? ' is-highlight' : ''}`}>{label}</span>
    </span>
  )
  const path = (label, endings) => (
    <div className="tree__branch">
      <span className="tree__line tree__line--in" />
      <span className="tree__path">{label}</span>
      <span className="tree__line tree__line--out" />
      <div className="tree__fork tree__fork--small">{endings}</div>
    </div>
  )
  return (
    <div
      className="project__visual tree"
      role="img"
      aria-label="Diagram of one story start branching into two paths and four endings"
    >
      <span className="tree__start">Start</span>
      <span className="tree__line tree__line--stem" />
      <div className="tree__fork">
        {path('Path A', [ending('Ending 1'), ending('Ending 2')])}
        {path('Path B', [ending('Ending 3'), ending('Ending 4', true)])}
      </div>
    </div>
  )
}

function ChatPreview() {
  return (
    <div className="project__visual chat" role="img" aria-label="Example chat: a slash command and the bot's reply">
      <div className="chat__row">
        <span className="chat__avatar" aria-hidden="true" />
        <div className="chat__body">
          <span className="chat__name">you</span>
          <span className="chat__command">/[command]</span>
        </div>
      </div>
      <div className="chat__row">
        <span className="chat__avatar chat__avatar--bot" aria-hidden="true">
          E2
        </span>
        <div className="chat__body">
          <span className="chat__name chat__name--bot">
            Eagle 2 <span className="chat__badge">BOT</span>
          </span>
          <span className="chat__reply">[Reply built from the Helldivers 2 API]</span>
        </div>
      </div>
    </div>
  )
}

export function Works() {
  return (
    <div className="row">
      <article className="card project project--wide">
        <StoryDiagram />
        <div className="project__text">
          <h3 className="project__name">Storygen</h3>
          <p className="project__desc">
            Web application that helps create interactive stories with multiple paths and endings,
            auto-created using OpenAI's ChatGPT 6.
          </p>
        </div>
        <div className="project__foot">
          <ul className="tags">
            <li>FastAPI</li>
            <li>Docker</li>
            <li>React</li>
          </ul>
          <ProjectLink url={PROJECTS.storygen.url} label="Visit" />
        </div>
      </article>

      <article className="card project">
        <ChatPreview />
        <div className="project__text">
          <h3 className="project__name">Eagle 2</h3>
          <p className="project__desc">
            Discord bot connected to SQLite that fetches the Helldivers 2 game API and responds in
            Discord chat.
          </p>
        </div>
        <div className="project__foot">
          <ul className="tags">
            <li>Python</li>
            <li>Docker</li>
          </ul>
          <ProjectLink url={PROJECTS.eagle2.url} label="GitHub" />
        </div>
      </article>
    </div>
  )
}
