import { Cloud } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { navItems } from './nav'

export function Sidebar() {
  return (
    <aside className="sidebar">
      <NavLink to="/" end className="sidebar-brand">
        <span className="sidebar-logo">
          <Cloud size={20} />
        </span>
        <span>
          <h1>OptiCloud</h1>
          <p>Dimensionamiento con IO</p>
        </span>
      </NavLink>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      <p className="sidebar-footnote">Proyecto académico · Investigación de Operaciones</p>
    </aside>
  )
}
