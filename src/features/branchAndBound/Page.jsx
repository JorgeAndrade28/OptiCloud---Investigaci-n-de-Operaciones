import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { useOptiCloud } from '../../context/OptiCloudContext'
import './page.css'

const estadosNodo = {
  pending: 'Pendiente',
  branched: 'Ramificado',
  integral: 'Solución entera',
  infeasible: 'Inviable',
  'pruned-bound': 'Podado por cota',
  unbounded: 'No acotado',
  error: 'Error',
}

const estadosSimplex = {
  optimal: 'Óptimo',
  infeasible: 'Inviable',
  unbounded: 'No acotado',
  'iteration-limit': 'Límite de iteraciones',
  invalid: 'Modelo inválido',
}

const estadosResultado = {
  optimal: 'Óptimo entero',
  infeasible: 'Inviable',
  'unbounded-relaxation': 'Relajación no acotada',
  invalid: 'Error',
  'node-limit': 'Límite de nodos',
}

const eventos = {
  'node-created': 'Nodo creado',
  'node-solved': 'Relajación resuelta con Simplex',
  'node-pending': 'Nodo agregado a pendientes',
  branched: 'Nodo ramificado',
  'pruned-infeasible': 'Podado por inviabilidad',
  'pruned-bound': 'Podado por cota',
  'integer-candidate': 'Solución entera candidata',
  'incumbent-updated': 'Mejor solución actualizada',
  'unbounded-relaxation': 'Relajación no acotada',
  'node-error': 'Error al resolver nodo',
  'node-limit': 'Límite de nodos alcanzado',
  'search-completed': 'Búsqueda finalizada',
}

function numero(value) {
  if (value === null || value === undefined) return '—'
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(8)))
}

function expresarRestriccion(restriccion, variables) {
  const terminos = restriccion.coeficientes
    .map((coeficiente, index) => {
      if (coeficiente === 0) return null
      const nombre = variables[index]?.nombre ?? variables[index]?.name ?? `x${index + 1}`
      return `${coeficiente === 1 ? '' : `${numero(coeficiente)} `}${nombre}`
    })
    .filter(Boolean)
  const sentido = restriccion.sentido === '<=' ? '≤' : restriccion.sentido === '>=' ? '≥' : '='
  return `${terminos.join(' + ') || '0'} ${sentido} ${numero(restriccion.rhs)}`
}

function solucionTexto(values) {
  if (!values) return '—'
  return Object.entries(values).map(([name, value]) => `${name} = ${numero(value)}`).join(', ')
}

function BranchNode({ node, nodeMap, variables }) {
  const children = node.childrenIds.map((id) => nodeMap.get(id)).filter(Boolean)

  return (
    <li className="bnb-tree-item">
      <article className="bnb-tree-node">
        <header className="bnb-node-header">
          <div>
            <h4>{node.id}</h4>
            <span className={`bnb-status bnb-status-${node.status}`}>
              {estadosNodo[node.status] ?? node.status}
            </span>
          </div>
          <span className="muted">{node.parentId ? `Padre: ${node.parentId}` : 'Nodo raíz'}</span>
        </header>
        <dl className="bnb-node-details">
          <div>
            <dt>Solución de relajación</dt>
            <dd>{solucionTexto(node.relaxation?.values)}</dd>
          </div>
          <div>
            <dt>Cota inferior (Z de la relajación)</dt>
            <dd>{numero(node.relaxation?.objectiveValue)}</dd>
          </div>
          <div>
            <dt>Estado Simplex</dt>
            <dd>{node.relaxation ? estadosSimplex[node.relaxation.status] ?? node.relaxation.status : 'Sin resolver'}</dd>
          </div>
          {node.relaxation ? (
            <div>
              <dt>Pivotes Simplex</dt>
              <dd>{node.relaxation.pivots}</dd>
            </div>
          ) : null}
          <div className="bnb-node-constraints">
            <dt>Restricciones adicionales</dt>
            <dd>
              {node.additionalConstraints.length > 0
                ? node.additionalConstraints.map((constraint) => (
                  <span key={constraint.id}>{expresarRestriccion(constraint, variables)}</span>
                ))
                : 'Modelo original'}
            </dd>
          </div>
        </dl>
        {node.branch ? (
          <p className="bnb-branch-note">
            Ramificación en {node.branch.variableName} = {numero(node.branch.value)}
            {' '}→ {node.branch.variableName} ≤ {node.branch.floor} o {node.branch.variableName} ≥ {node.branch.ceil}
          </p>
        ) : null}
        {node.pruneReason ? <p className="bnb-node-reason">{node.pruneReason}</p> : null}
      </article>
      {children.length > 0 ? (
        <ul className="bnb-children">
          {children.map((child) => (
            <BranchNode key={child.id} node={child} nodeMap={nodeMap} variables={variables} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function BranchAndBoundPage() {
  const { configValida, model, bnb, runBranchAndBound } = useOptiCloud()
  const nodeMap = new Map((bnb?.nodes ?? []).map((node) => [node.id, node]))
  const roots = (bnb?.nodes ?? []).filter((node) => node.parentId === null)

  return (
    <div className="page bnb-page">
      <PageHeader
        title="Branch and Bound"
        description="Fuerza solución entera usando Simplex en cada nodo del árbol."
        actions={
          <button type="button" className="btn" onClick={runBranchAndBound} disabled={!configValida}>
            Ejecutar BnB
          </button>
        }
      />

      {!configValida ? (
        <Card>
          <p className="muted">
            Configura el caso antes de ejecutar Branch and Bound.{' '}
            <Link to="/configuracion">Ir a configuración</Link>
          </p>
        </Card>
      ) : (
        <>
          <Card title="Resultado entero">
            <p>
              Estado: <strong>{estadosResultado[bnb?.status] ?? 'Pendiente'}</strong>
            </p>
            <p className="muted">{bnb?.message ?? 'Ejecuta Branch and Bound para resolver la relajación y construir el árbol.'}</p>
            {bnb?.status === 'optimal' ? (
              <dl className="bnb-result">
                {Object.entries(bnb.values).map(([variable, value]) => (
                  <div key={variable}>
                    <dt>{variable}</dt>
                    <dd>{numero(value)}</dd>
                  </div>
                ))}
                <div>
                  <dt>Z</dt>
                  <dd>{numero(bnb.z)}</dd>
                </div>
                <div>
                  <dt>Nodos resueltos con Simplex</dt>
                  <dd>{bnb.exploredNodes}</dd>
                </div>
              </dl>
            ) : null}
          </Card>

          {roots.length > 0 ? (
            <Card title="Árbol de búsqueda">
              <ul className="bnb-tree">
                {roots.map((root) => (
                  <BranchNode key={root.id} node={root} nodeMap={nodeMap} variables={model.variables} />
                ))}
              </ul>
            </Card>
          ) : null}

          {bnb?.history?.length > 0 ? (
            <Card title="Historial de exploración">
              <ol className="bnb-history">
                {bnb.history.map((entry) => (
                  <li key={entry.step}>
                    <span className="bnb-history-step">{entry.step}</span>
                    <span>{eventos[entry.event] ?? entry.event}</span>
                    {entry.nodeId ? <span className="muted">{entry.nodeId}</span> : null}
                    {Number.isFinite(entry.objectiveValue) ? (
                      <span className="muted">Z = {numero(entry.objectiveValue)}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
        </>
      )}
    </div>
  )
}
