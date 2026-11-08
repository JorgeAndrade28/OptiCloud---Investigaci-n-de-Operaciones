import { BarChart3, GitBranch, Info, LayoutDashboard, Settings, SquareFunction, Table2 } from 'lucide-react'

export const navItems = [
  {
    to: '/',
    label: 'Dashboard',
    description: 'Resumen del caso de dimensionamiento',
    icon: LayoutDashboard,
  },
  {
    to: '/configuracion',
    label: 'Configuración',
    description: 'Instancias, demanda y parámetros del modelo',
    icon: Settings,
  },
  {
    to: '/modelo',
    label: 'Modelo matemático',
    description: 'Formulación PL / MILP del problema',
    icon: SquareFunction,
  },
  {
    to: '/simplex',
    label: 'Método Simplex',
    description: 'Relajación continua e iteraciones',
    icon: Table2,
  },
  {
    to: '/branch-and-bound',
    label: 'Branch and Bound',
    description: 'Solución entera a partir del Simplex',
    icon: GitBranch,
  },
  {
    to: '/resultados',
    label: 'Resultados',
    description: 'Comparación LP vs IP y asignación',
    icon: BarChart3,
  },
  {
    to: '/acerca',
    label: 'Acerca del proyecto',
    description: 'Objetivo académico y stack de OptiCloud',
    icon: Info,
  },
]
