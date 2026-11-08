import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { useOptiCloud } from '../../context/OptiCloudContext'
import './page.css'

const estados = {
  optimal: 'Óptimo',
  infeasible: 'Inviable',
  unbounded: 'No acotado',
  'iteration-limit': 'Límite de iteraciones',
  invalid: 'Modelo inválido',
}

function numero(value) {
  if (value === null || value === undefined) return '—'
  return Number.isInteger(value) ? String(value) : Number(value.toPrecision(8)).toString()
}

export function SimplexPage() {
  const { configValida, simplex, runSimplex } = useOptiCloud()
  const [indiceIteracion, setIndiceIteracion] = useState(0)
  const historial = simplex?.iterations ?? []
  const indiceActual = Math.min(indiceIteracion, Math.max(0, historial.length - 1))
  const iteracion = historial[indiceActual]

  function ejecutarSimplex() {
    setIndiceIteracion(0)
    runSimplex()
  }

  return (
    <div className="page simplex-page">
      <PageHeader
        title="Método Simplex"
        description="Resuelve la relajación continua del modelo de dimensionamiento."
        actions={
          <button type="button" className="btn" onClick={ejecutarSimplex} disabled={!configValida}>
            Ejecutar Simplex
          </button>
        }
      />

      {!configValida ? (
        <Card>
          <p className="muted">
            Configura el caso antes de ejecutar el solver.{' '}
            <Link to="/configuracion">Ir a configuración</Link>
          </p>
        </Card>
      ) : (
        <>
          <Card title="Resultado">
            <p>
              Estado: <strong>{estados[simplex?.status] ?? 'Pendiente'}</strong>
            </p>
            <p className="muted">{simplex?.message ?? 'Ejecuta Simplex para generar el tableau y el historial.'}</p>
            {simplex?.status === 'optimal' ? (
              <dl className="simplex-result">
                {Object.entries(simplex.values).map(([variable, value]) => (
                  <div key={variable}>
                    <dt>{variable}</dt>
                    <dd>{numero(value)}</dd>
                  </div>
                ))}
                <div>
                  <dt>Z</dt>
                  <dd>{numero(simplex.z)}</dd>
                </div>
                <div>
                  <dt>W (Fase 1)</dt>
                  <dd>{numero(simplex.phaseOne.objectiveValue)}</dd>
                </div>
              </dl>
            ) : null}
          </Card>

          {iteracion ? (
            <Card title="Tableau e historial">
              <div className="simplex-history-toolbar">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIndiceIteracion((index) => Math.max(0, index - 1))}
                  disabled={indiceActual === 0}
                  aria-label="Iteración anterior"
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                  Anterior
                </button>
                <p aria-live="polite">
                  Iteración {iteracion.iteration} · Fase {iteracion.phase === 'phase1' ? '1' : '2'}
                  {' · '}{iteracion.event}
                </p>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIndiceIteracion((index) => Math.min(historial.length - 1, index + 1))}
                  disabled={indiceActual === historial.length - 1}
                  aria-label="Iteración siguiente"
                >
                  Siguiente
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </div>
              {iteracion.enteringVariable ? (
                <p className="simplex-pivot-note">
                  Entra {iteracion.enteringVariable}
                  {iteracion.leavingVariable ? ` y sale ${iteracion.leavingVariable}` : ''}
                  {iteracion.pivotElement !== null ? ` · pivote ${numero(iteracion.pivotElement)}` : ''}
                </p>
              ) : null}
              <div className="simplex-table-wrap">
                <table className="simplex-table">
                  <thead>
                    <tr>
                      <th scope="col">C<sub>b</sub></th>
                      <th scope="col">Base</th>
                      {iteracion.columns.map((column) => (
                        <th scope="col" key={column.id}>{column.name}</th>
                      ))}
                      <th scope="col">b</th>
                    </tr>
                    <tr className="simplex-cost-row">
                      <th scope="row">C<sub>j</sub></th>
                      <td className="simplex-nonapplicable">—</td>
                      {iteracion.columnCosts.map((cost, index) => (
                        <td key={iteracion.columns[index].id}>{numero(cost)}</td>
                      ))}
                      <td>—</td>
                    </tr>
                  </thead>
                  <tbody>
                    {iteracion.coefficients.map((coefficients, rowIndex) => (
                      <tr key={`${iteracion.rowNames[rowIndex]}-${rowIndex}`}>
                        <td>{numero(iteracion.cb[rowIndex])}</td>
                        <th scope="row">{iteracion.basicVariables[rowIndex]}</th>
                        {coefficients.map((coefficient, columnIndex) => {
                          const isPivot = iteracion.pivotPosition?.row === rowIndex &&
                            iteracion.pivotPosition?.column === columnIndex
                          return (
                            <td className={isPivot ? 'simplex-pivot' : undefined} key={iteracion.columns[columnIndex].id}>
                              {numero(coefficient)}
                            </td>
                          )
                        })}
                        <td>{numero(iteracion.rhs[rowIndex])}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">Z<sub>j</sub></th>
                      <td className="simplex-nonapplicable">—</td>
                      {iteracion.zj.map((value, index) => (
                        <td key={iteracion.columns[index].id}>{numero(value)}</td>
                      ))}
                      <td>{numero(iteracion.objectiveValue)}</td>
                    </tr>
                    <tr>
                      <th scope="row">C<sub>j</sub> − Z<sub>j</sub></th>
                      <td className="simplex-nonapplicable">—</td>
                      {iteracion.reducedCosts.map((value, index) => (
                        <td key={iteracion.columns[index].id}>{numero(value)}</td>
                      ))}
                      <td>—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <dl className="simplex-notation">
                <div>
                  <dt>C<sub>b</sub></dt>
                  <dd>Costo de la variable básica de esa fila.</dd>
                </div>
                <div>
                  <dt>C<sub>j</sub></dt>
                  <dd>Costo de cada variable en la función objetivo.</dd>
                </div>
                <div>
                  <dt>Z<sub>j</sub></dt>
                  <dd>Contribución de la base actual en cada columna.</dd>
                </div>
                <div>
                  <dt>C<sub>j</sub> − Z<sub>j</sub></dt>
                  <dd>Costo reducido; en minimización, valores negativos permiten mejorar.</dd>
                </div>
              </dl>
              <p className="simplex-table-note">El guion indica que el valor no aplica a esa columna, no que falte un cálculo.</p>
            </Card>
          ) : null}
        </>
      )}
    </div>
  )
}
