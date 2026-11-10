import { READING } from '../config.js'

export function Reading() {
  return (
    <section className="card widget">
      <h2 className="card__title">Currently reading</h2>
      <div className="reading">
        {/* Temporary cover until the MangaDex API is connected */}
        <img className="reading__cover" src={READING.cover} alt="" width="80" height="116" />
        <span className="reading__title">{READING.title}</span>
      </div>
    </section>
  )
}
