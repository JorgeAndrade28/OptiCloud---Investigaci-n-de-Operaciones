import { useLocation } from 'react-router-dom'
import { useOptiCloud } from '../context/OptiCloudContext'
import { navItems } from './nav'

export function Header() {
  const { pathname } = useLocation()
  const { configValida } = useOptiCloud()
  const current = navItems.find((item) => item.to === pathname) ?? navItems[0]

  return (
    <header className="app-header">
      <div>
        <h2>{current.label}</h2>
        <p>{current.description}</p>
      </div>
      <span className="status-pill">{configValida ? 'Caso listo' : 'Configuración incompleta'}</span>
    </header>
  )
}
