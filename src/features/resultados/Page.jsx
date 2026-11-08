import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { ChartPanel } from '../../components/ChartPanel'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { useOptiCloud } from '../../context/OptiCloudContext'
import { formatCurrency, formatNumber } from '../../lib/format'
import {
  buildInstanceAlternatives,
  calculateCapacityMetrics,
  calculateSavingsPercent,
  calculateSmallOnlyAlternative,
  extractInstanceCounts,
} from './metrics'
import './page.css'

const chartColors = {
  teal: '#0f766e',
  blue: '#1d4ed8',
  orange: '#d97706',
  green: '#65a30d',
  red: '#b91c1c',
}

const alternativeColumns = [
  { key: 'smallCount', label: 'Instancias S' },
  { key: 'largeCount', label: 'Instancias L' },
  { key: 'capacity', label: 'Capacidad (solicitudes/s)', render: (row) => formatNumber(row.capacity) },
  { key: 'cost', label: 'Costo por hora', render: (row) => formatCurrency(row.cost) },
]

function cantidad(value) {
  return formatNumber(value, Number.isInteger(value) ? 0 : 2)
}

function estadoResultado(result) {
  const labels = {
    optimal: 'Óptimo',
    infeasible: 'Inviable',
    unbounded: 'No acotado',
    'unbounded-relaxation': 'Relajación no acotada',
    'iteration-limit': 'Límite de iteraciones',
    'node-limit': 'Límite de nodos',
    invalid: 'Modelo inválido',
  }
  return result ? labels[result.status] ?? result.status : 'Pendiente'
}

function SolutionCard({ title, type, result, solution, href, actionLabel }) {
  return (
    <Card title={title}>
      <p className="resultados-status">Estado: <strong>{estadoResultado(result)}</strong></p>
      {solution ? (
        <>
          <dl className="solution-metrics">
            <div>
              <dt>Instancias pequeñas S</dt>
              <dd>{cantidad(solution.counts.S)}</dd>
            </div>
            <div>
              <dt>Instancias grandes L</dt>
              <dd>{cantidad(solution.counts.L)}</dd>
            </div>
            <div>
              <dt>Capacidad total</dt>
              <dd>{formatNumber(solution.capacity)} solicitudes/s</dd>
            </div>
            <div>
              <dt>Costo por hora</dt>
              <dd>{formatCurrency(result.z)}</dd>
            </div>
          </dl>
          {type === 'continuous' ? (
            <p className="resultados-warning">La relajación permite cantidades fraccionarias; no siempre es implementable.</p>
          ) : (
            <p className="resultados-success">Solución entera: implementable con instancias completas.</p>
          )}
        </>
      ) : (
        <div className="resultados-empty">
          <p className="muted">Aún no hay una solución disponible de este algoritmo.</p>
          <Link className="btn btn-ghost" to={href}>{actionLabel}</Link>
        </div>
      )}
    </Card>
  )
}

function mensajeFallo(capacity, metrics, instanceLabel) {
  if (capacity === null) return `La solución no contiene instancias ${instanceLabel} para simular ese fallo.`
  if (capacity >= metrics.required) return `${formatNumber(capacity)} solicitudes/s; mantiene demanda y reserva.`
  if (capacity >= metrics.demand) return `${formatNumber(capacity)} solicitudes/s; cubre la demanda base, no toda la reserva.`
  return `${formatNumber(capacity)} solicitudes/s; no cubre la demanda base.`
}

export function ResultadosPage() {
  const { config, model, configValida, simplex, bnb } = useOptiCloud()

  const continuousCounts = useMemo(
    () => extractInstanceCounts(simplex, model?.variables),
    [simplex, model],
  )
  const integerCounts = useMemo(
    () => extractInstanceCounts(bnb, model?.variables),
    [bnb, model],
  )
  const continuousSolution = useMemo(() => continuousCounts && ({
    counts: continuousCounts,
    capacity: calculateCapacityMetrics(config, continuousCounts).installed,
  }), [config, continuousCounts])
  const integerSolution = useMemo(() => integerCounts && ({
    counts: integerCounts,
    capacity: calculateCapacityMetrics(config, integerCounts).installed,
  }), [config, integerCounts])
  const capacityMetrics = useMemo(
    () => calculateCapacityMetrics(config, integerCounts),
    [config, integerCounts],
  )
  const smallOnly = useMemo(() => calculateSmallOnlyAlternative(config), [config])
  const alternatives = useMemo(
    () => buildInstanceAlternatives(config, integerCounts?.L ?? null),
    [config, integerCounts],
  )
  const savings = integerSolution
    ? calculateSavingsPercent(smallOnly.cost, bnb.z)
    : null

  const costChartData = useMemo(() => {
    if (!continuousSolution || !integerSolution) return null
    return {
      labels: ['Solución continua', 'Solución entera', 'Solo pequeñas'],
      datasets: [{
        label: 'Costo por hora',
        data: [simplex.z, bnb.z, smallOnly.cost],
        backgroundColor: [chartColors.blue, chartColors.teal, chartColors.orange],
        borderRadius: 4,
      }],
    }
  }, [continuousSolution, integerSolution, simplex, bnb, smallOnly])

  const distributionChartData = useMemo(() => {
    if (!integerSolution) return null
    return {
      labels: ['Instancias pequeñas S', 'Instancias grandes L'],
      datasets: [{
        data: [integerCounts.S, integerCounts.L],
        backgroundColor: [chartColors.orange, chartColors.teal],
        borderWidth: 0,
      }],
    }
  }, [integerSolution, integerCounts])

  const capacityChartData = useMemo(() => {
    if (!continuousSolution || !integerSolution) return null
    return {
      labels: ['Demanda base', 'Demanda + reserva', 'Capacidad continua', 'Capacidad entera'],
      datasets: [{
        label: 'Solicitudes/s',
        data: [config.demanda, config.demanda + config.reservaFallos, continuousSolution.capacity, integerSolution.capacity],
        backgroundColor: [chartColors.blue, chartColors.orange, '#60a5fa', chartColors.teal],
        borderRadius: 4,
      }],
    }
  }, [config, continuousSolution, integerSolution])

  const comparisonChartData = useMemo(() => {
    if (!continuousSolution || !integerSolution) return null
    return {
      labels: ['Solución continua', 'Solución entera'],
      datasets: [
        {
          label: 'Instancias S',
          data: [continuousCounts.S, integerCounts.S],
          backgroundColor: chartColors.orange,
          yAxisID: 'instances',
          borderRadius: 4,
        },
        {
          label: 'Instancias L',
          data: [continuousCounts.L, integerCounts.L],
          backgroundColor: chartColors.teal,
          yAxisID: 'instances',
          borderRadius: 4,
        },
        {
          type: 'line',
          label: 'Costo por hora',
          data: [simplex.z, bnb.z],
          borderColor: chartColors.blue,
          backgroundColor: chartColors.blue,
          pointRadius: 5,
          pointHoverRadius: 7,
          yAxisID: 'cost',
        },
      ],
    }
  }, [continuousSolution, integerSolution, continuousCounts, integerCounts, simplex, bnb])

  const commonOptions = useMemo(() => ({
    plugins: { legend: { position: 'bottom' } },
    scales: { y: { beginAtZero: true } },
  }), [])
  const doughnutOptions = useMemo(() => ({
    plugins: { legend: { position: 'bottom' } },
  }), [])
  const comparisonOptions = useMemo(() => ({
    plugins: { legend: { position: 'bottom' } },
    scales: {
      instances: {
        type: 'linear',
        position: 'left',
        beginAtZero: true,
        title: { display: true, text: 'Instancias' },
      },
      cost: {
        type: 'linear',
        position: 'right',
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Unidades monetarias/hora' },
      },
    },
  }), [])

  if (!configValida) {
    return (
      <div className="page resultados-page">
        <PageHeader title="Resultados" description="Comparación de soluciones y análisis de capacidad." />
        <Card>
          <p className="muted">No hay una configuración válida para analizar. <Link to="/configuracion">Ir a configuración</Link></p>
        </Card>
      </div>
    )
  }

  return (
    <div className="page resultados-page">
      <PageHeader
        title="Resultados"
        description="Compara la relajación continua con la solución entera e inspecciona su capacidad y costo."
      />

      <div className="resultados-grid">
        <SolutionCard
          title="Solución continua · Simplex"
          type="continuous"
          result={simplex}
          solution={continuousSolution}
          href="/simplex"
          actionLabel="Ir a Simplex"
        />
        <SolutionCard
          title="Solución entera · Branch and Bound"
          type="integer"
          result={bnb}
          solution={integerSolution}
          href="/branch-and-bound"
          actionLabel="Ir a Branch and Bound"
        />
      </div>

      <Card title="Análisis de capacidad · solución entera">
        {capacityMetrics ? (
          <>
            <dl className="capacity-metrics">
              <div><dt>Demanda base</dt><dd>{formatNumber(capacityMetrics.demand)} solicitudes/s</dd></div>
              <div><dt>Reserva configurada</dt><dd>{formatNumber(capacityMetrics.configuredReserve)} solicitudes/s</dd></div>
              <div><dt>Demanda requerida con reserva</dt><dd>{formatNumber(capacityMetrics.required)} solicitudes/s</dd></div>
              <div><dt>Capacidad instalada</dt><dd>{formatNumber(capacityMetrics.installed)} solicitudes/s</dd></div>
              <div><dt>Reserva disponible sobre demanda base</dt><dd>{formatNumber(capacityMetrics.availableReserve)} solicitudes/s</dd></div>
              <div><dt>Margen sobre demanda + reserva</dt><dd>{formatNumber(capacityMetrics.marginOverRequired)} solicitudes/s</dd></div>
              <div><dt>Utilización de demanda base</dt><dd>{capacityMetrics.utilizationPercent === null ? '—' : `${formatNumber(capacityMetrics.utilizationPercent, 1)}%`}</dd></div>
              <div><dt>Utilización incluyendo reserva</dt><dd>{capacityMetrics.targetUtilizationPercent === null ? '—' : `${formatNumber(capacityMetrics.targetUtilizationPercent, 1)}%`}</dd></div>
            </dl>
            <div className="failure-analysis">
              <div>
                <h4>Falla una instancia grande L</h4>
                <p>{mensajeFallo(capacityMetrics.afterLargeFailure, capacityMetrics, 'grandes')}</p>
              </div>
              <div>
                <h4>Falla una instancia pequeña S</h4>
                <p>{mensajeFallo(capacityMetrics.afterSmallFailure, capacityMetrics, 'pequeñas')}</p>
              </div>
            </div>
          </>
        ) : (
          <p className="muted">Ejecuta Branch and Bound para calcular capacidad instalada y tolerancia a fallos.{' '}
            <Link to="/branch-and-bound">Ir a Branch and Bound</Link>
          </p>
        )}
      </Card>

      <Card title="Alternativa de solo instancias pequeñas">
        <div className="small-only-summary">
          <p>{smallOnly.smallCount} instancias S · {formatNumber(smallOnly.capacity)} solicitudes/s</p>
          <p className="small-only-cost">{formatCurrency(smallOnly.cost)} por hora</p>
          {savings !== null ? (
            <p className={savings >= 0 ? 'resultados-success' : 'resultados-warning'}>
              {savings >= 0 ? 'Ahorro' : 'Sobrecosto'} de la solución entera frente a solo pequeñas:{' '}
              {formatNumber(Math.abs(savings), 1)}%
            </p>
          ) : integerSolution ? (
            <p className="resultados-warning">No se puede calcular el porcentaje de ahorro porque la alternativa tiene costo cero.</p>
          ) : (
            <p className="muted">Ejecuta Branch and Bound para comparar el costo de la solución entera.</p>
          )}
        </div>
      </Card>

      <div className="resultados-charts-grid">
        {costChartData ? (
          <Card title="Comparación de costos">
            <ChartPanel type="bar" data={costChartData} options={commonOptions} />
          </Card>
        ) : null}
        {distributionChartData ? (
          <Card title="Distribución de instancias · solución entera">
            <ChartPanel type="doughnut" data={distributionChartData} options={doughnutOptions} />
          </Card>
        ) : null}
        {capacityChartData ? (
          <Card title="Capacidad frente a demanda">
            <ChartPanel type="bar" data={capacityChartData} options={commonOptions} />
          </Card>
        ) : null}
        {comparisonChartData ? (
          <Card title="Comparación continua vs. entera">
            <ChartPanel type="bar" data={comparisonChartData} options={comparisonOptions} />
          </Card>
        ) : null}
      </div>

      {!continuousSolution || !integerSolution ? (
        <Card title="Gráficos">
          <p className="muted">Los gráficos comparativos aparecerán cuando existan resultados válidos de ambos algoritmos.</p>
          <div className="resultados-links">
            {!continuousSolution ? <Link to="/simplex">Ejecutar Simplex</Link> : null}
            {!integerSolution ? <Link to="/branch-and-bound">Ejecutar Branch and Bound</Link> : null}
          </div>
        </Card>
      ) : null}

      <Card title="Combinaciones factibles de referencia">
        <p className="muted">
          Se muestra el mínimo de instancias S necesario para cada cantidad muestreada de L. Esta tabla compara alternativas y no reemplaza los resultados de Simplex ni Branch and Bound.
        </p>
        <DataTable columns={alternativeColumns} rows={alternatives} />
      </Card>
    </div>
  )
}