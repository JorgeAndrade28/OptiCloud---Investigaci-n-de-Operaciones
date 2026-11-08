export function Card({ title, children }) {
  return (
    <section className="card">
      {title ? <h4>{title}</h4> : null}
      {children}
    </section>
  )
}
