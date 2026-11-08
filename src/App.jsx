import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { OptiCloudProvider } from './context/OptiCloudContext'
import { AcercaPage } from './features/acerca/Page'
import { BranchAndBoundPage } from './features/branchAndBound/Page'
import { ConfiguracionPage } from './features/configuracion/Page'
import { DashboardPage } from './features/dashboard/Page'
import { ModeloPage } from './features/modelo/Page'
import { ResultadosPage } from './features/resultados/Page'
import { SimplexPage } from './features/simplex/Page'
import { AppLayout } from './layout/AppLayout'

export default function App() {
  return (
    <OptiCloudProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/configuracion" element={<ConfiguracionPage />} />
            <Route path="/modelo" element={<ModeloPage />} />
            <Route path="/simplex" element={<SimplexPage />} />
            <Route path="/branch-and-bound" element={<BranchAndBoundPage />} />
            <Route path="/resultados" element={<ResultadosPage />} />
            <Route path="/acerca" element={<AcercaPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </OptiCloudProvider>
  )
}
