import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { useOptiCloud } from '../../context/OptiCloudContext'
import { formatCurrency, formatNumber } from '../../lib/format'
import { calculateCapacityMetrics, extractInstanceCounts } from '../resultados/metrics'
import './page.css'

function cantidad(value) {
  return value === null || value === undefined
    ? '—'
    : formatNumber(value, Number.isInteger(value) ? 0 : 2)
}

function estadoOptimizacion(simplex, bnb) {
  if (bnb?.status === 'optimal') return 'Óptimo entero encontrado'
  if (bnb?.status === 'infeasible') return 'Modelo entero inviable'
  if (bnb?.status === 'node-limit') return 'Límite de nodos alcanzado'
  if (bnb?.status === 'invalid' || bnb?.status === 'unbounded-relaxation') return 'Requiere revisión'
  if (simplex?.status === 'optimal') return 'Relajación continua lista; falta Branch and Bound'
  if (simplex && simplex.status !== 'optimal') return 'Simplex requiere revisión'
  return 'Pendiente de ejecución'
}

export function DashboardPage() {
  const { config, model, simplex, bnb, runSimplex, runBranchAndBound } = useOptiCloud()
  const continuousCounts = useMemo(
    () => extractInstanceCounts(simplex, model?.variables),
    [simplex, model],
  )
  const integerCounts = useMemo(
    () => extractInstanceCounts(bnb, model?.variables),
    [bnb, model],
  )
  const integerCapacity = useMemo(
    () => calculateCapacityMetrics(config, integerCounts)?.installed,
    [config, integerCounts],
  )
  const requiredCapacity = config.demanda + config.reservaFallos
  const comparisonAvailable = continuousCounts && integerCounts && simplex?.status === 'optimal' && bnb?.status === 'optimal'

  function runOptimization() {
    runSimplex()
    runBranchAndBound()
  }

  return (
    <div className="page dashboard-page">
      <PageHeader
        title="Dashboard"
        description="Resumen del caso actual de dimensionamiento de instancias en la nube."
        actions={
          <div className="dashboard-actions">
            <Link className="btn btn-ghost" to="/configuracion">Configuración</Link>
            <button type="button" className="btn" onClick={runOptimization} disabled={!model}>
              Ejecutar optimización
            </button>
          </div>
        }
      />

      <div className="dashboard-grid">
        <Card title="Demanda de la aplicación">
          <p className="dashboard-value">{formatNumber(config.demanda)} <span>solicitudes/s</span></p>
          <p className="muted">Reserva configurada: {formatNumber(config.reservaFallos)} solicitudes/s</p>
        </Card>
        <Card title="Capacidad requerida">
          <p className="dashboard-value">{formatNumber(requiredCapacity)} <span>solicitudes/s</span></p>
          <p className="muted">Demanda más reserva ante fallos</p>
        </Card>
        <Card title="Instancias pequeñas óptimas">
          <p className="dashboard-value">{cantidad(integerCounts?.S)}</p>
          <p className="muted">Resultado entero de Branch and Bound</p>
        </Card>
        <Card title="Instancias grandes óptimas">
          <p className="dashboard-value">{cantidad(integerCounts?.L)}</p>
          <p className="muted">Máximo configurado: {config.maxInstanciasGrandes}</p>
        </Card>
        <Card title="Costo mínimo por hora">
          <p className="dashboard-value">{formatCurrency(bnb?.status === 'optimal' ? bnb.z : null)}</p>
          <p className="muted">Solución entera implementable</p>
        </Card>
        <Card title="Estado de optimización">
          <p className="dashboard-status">{estadoOptimizacion(simplex, bnb)}</p>
          <div className="dashboard-status-links">
            {!simplex || simplex.status !== 'optimal' ? <Link to="/simplex">Simplex</Link> : null}
            {!bnb || bnb.status !== 'optimal' ? <Link to="/branch-and-bound">Branch and Bound</Link> : null}
          </div>
        </Card>
      </div>

      <Card title="Comparación continua e implementable">
        {comparisonAvailable ? (
          <div className="dashboard-comparison">
            <section>
              <h4>Relajación continua (Simplex)</h4>
              <p>{cantidad(continuousCounts.S)} S · {cantidad(continuousCounts.L)} L</p>
              <p>{formatCurrency(simplex.z)} por hora</p>
            </section>
            <section>
              <h4>Solución entera (Branch and Bound)</h4>
              <p>{cantidad(integerCounts.S)} S · {cantidad(integerCounts.L)} L</p>
              <p>{formatCurrency(bnb.z)} por hora · {formatNumber(integerCapacity)} solicitudes/s</p>
            </section>
          </div>
        ) : (
          <div className="dashboard-comparison-empty">
            <p className="muted">Ejecuta ambos métodos para comparar sus resultados reales.</p>
            <Link to="/resultados">Ver resultados</Link>
          </div>
        )}
      </Card>
    </div>
  )
}
