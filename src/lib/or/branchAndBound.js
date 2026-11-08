import { SIMPLEX_TOLERANCE, solveSimplex } from './simplex.js'

const DEFAULT_INTEGER_TOLERANCE = 1e-7
const DEFAULT_MAX_NODES = 10000

export function shouldPruneByBound(lowerBound, incumbent, tolerance = SIMPLEX_TOLERANCE) {
  return Number.isFinite(lowerBound) &&
    Number.isFinite(incumbent) &&
    lowerBound >= incumbent - tolerance
}

function getBaseConstraints(model) {
  if (Array.isArray(model.restricciones)) {
    return model.restricciones.map((constraint) => ({ ...constraint }))
  }

  if (!Array.isArray(model.A) || !Array.isArray(model.b) || !Array.isArray(model.sentidos)) {
    throw new TypeError('El modelo debe incluir restricciones o las matrices A, b y sentidos.')
  }

  return model.A.map((coefficients, index) => ({
    id: `r${index + 1}`,
    nombre: `Restricción ${index + 1}`,
    coeficientes: [...coefficients],
    sentido: model.sentidos[index],
    rhs: model.b[index],
  }))
}

function modelForNode(model, additionalConstraints) {
  const restricciones = [...getBaseConstraints(model), ...additionalConstraints]
  return {
    ...model,
    restricciones,
    A: restricciones.map((constraint) => constraint.coeficientes),
    b: restricciones.map((constraint) => constraint.rhs),
    sentidos: restricciones.map((constraint) => constraint.sentido),
  }
}

function getVariableName(variable, index) {
  return variable.nombre ?? variable.name ?? `x${index + 1}`
}

function readRelaxationValues(result, variables) {
  const vector = result.solution ?? result.x
  if (!Array.isArray(vector) || vector.length !== variables.length) {
    throw new TypeError('Simplex no devolvió un vector de solución compatible con el modelo.')
  }

  return Object.fromEntries(variables.map((variable, index) => {
    const name = getVariableName(variable, index)
    const value = result.values?.[name] ?? vector[index]
    if (!Number.isFinite(value)) {
      throw new TypeError(`Simplex devolvió un valor no finito para ${name}.`)
    }
    return [name, value]
  }))
}

function selectFractionalVariable(model, values, tolerance) {
  let selected = null
  model.variables.forEach((variable, index) => {
    if (variable.integer === false) return
    const name = getVariableName(variable, index)
    const value = values[name]
    const fractionality = Math.abs(value - Math.round(value))
    if (fractionality <= tolerance) return

    if (!selected || fractionality > selected.fractionality + tolerance) {
      selected = { variable, index, name, value, fractionality }
    }
  })
  return selected
}

function formatNumber(value) {
  return String(Number(value.toPrecision(10)))
}

export function solveBranchAndBound(model, simplexFn = solveSimplex, options = {}) {
  const integerTolerance = options.integerTolerance ?? DEFAULT_INTEGER_TOLERANCE
  const boundTolerance = options.boundTolerance ?? SIMPLEX_TOLERANCE
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES
  const nodes = []
  const history = []
  const candidates = []
  const pending = []
  let incumbent = null
  let terminalStatus = null

  function record(event, node, details = {}) {
    history.push({
      step: history.length + 1,
      event,
      nodeId: node?.id ?? null,
      ...details,
    })
  }

  function createNode(parent, branchConstraint = null) {
    const node = {
      id: `N${nodes.length}`,
      parentId: parent?.id ?? null,
      childrenIds: [],
      depth: parent ? parent.depth + 1 : 0,
      branchConstraint,
      additionalConstraints: branchConstraint
        ? [...parent.additionalConstraints, branchConstraint]
        : [],
      status: 'pending',
      relaxation: null,
      lowerBound: null,
      branch: null,
      pruneReason: null,
      sequence: nodes.length,
    }
    nodes.push(node)
    if (parent) parent.childrenIds.push(node.id)
    record('node-created', node, { parentId: node.parentId })
    return node
  }

  function solveNode(node) {
    let result
    try {
      result = simplexFn(modelForNode(model, node.additionalConstraints), options.simplexOptions)
    } catch (error) {
      node.status = 'error'
      node.pruneReason = error.message
      record('node-error', node, { message: error.message })
      terminalStatus = 'invalid'
      return
    }

    node.relaxation = {
      status: result.status,
      pivots: result.iterations?.filter((iteration) => iteration.event === 'pivote').length ?? 0,
    }
    record('node-solved', node, { simplexStatus: result.status, objectiveValue: result.z ?? null })

    if (result.status === 'infeasible') {
      node.status = 'infeasible'
      node.pruneReason = 'La relajación continua del nodo es inviable.'
      record('pruned-infeasible', node)
      return
    }

    if (result.status === 'unbounded') {
      node.status = 'unbounded'
      node.pruneReason = 'La relajación Simplex no está acotada; no se puede certificar este nodo.'
      record('unbounded-relaxation', node)
      terminalStatus = 'unbounded-relaxation'
      return
    }

    if (result.status !== 'optimal' || !Number.isFinite(result.z)) {
      node.status = 'error'
      node.pruneReason = result.message ?? 'Simplex no produjo una solución óptima válida.'
      record('node-error', node, { message: node.pruneReason })
      terminalStatus = 'invalid'
      return
    }

    let values
    try {
      values = readRelaxationValues(result, model.variables)
    } catch (error) {
      node.status = 'error'
      node.pruneReason = error.message
      record('node-error', node, { message: error.message })
      terminalStatus = 'invalid'
      return
    }

    node.relaxation = {
      ...node.relaxation,
      values,
      solution: [...(result.solution ?? result.x)],
      objectiveValue: result.z,
    }
    node.lowerBound = result.z

    const fractional = selectFractionalVariable(model, values, integerTolerance)
    if (!fractional) {
      node.status = 'integral'
      node.pruneReason = 'La solución de la relajación ya es entera.'
      const candidate = {
        nodeId: node.id,
        values,
        solution: [...node.relaxation.solution],
        objectiveValue: result.z,
      }
      candidates.push(candidate)
      record('integer-candidate', node, { objectiveValue: result.z, values })
      if (!incumbent || result.z < incumbent.objectiveValue - boundTolerance) {
        incumbent = candidate
        record('incumbent-updated', node, { objectiveValue: result.z, values })
      }
      return
    }

    node.branch = {
      variableId: fractional.variable.id ?? `x${fractional.index + 1}`,
      variableName: fractional.name,
      value: fractional.value,
      floor: Math.floor(fractional.value),
      ceil: Math.ceil(fractional.value),
    }

    if (incumbent && shouldPruneByBound(node.lowerBound, incumbent.objectiveValue, boundTolerance)) {
      node.status = 'pruned-bound'
      node.pruneReason = `La cota inferior ${formatNumber(node.lowerBound)} no mejora la incumbente ${formatNumber(incumbent.objectiveValue)}.`
      record('pruned-bound', node, {
        lowerBound: node.lowerBound,
        incumbent: incumbent.objectiveValue,
      })
      return
    }

    node.status = 'pending'
    pending.push(node)
    record('node-pending', node, { lowerBound: node.lowerBound })
  }

  function createBranchConstraint(node, direction) {
    const variableIndex = model.variables.findIndex(
      (variable, index) => (variable.id ?? `x${index + 1}`) === node.branch.variableId,
    )
    const coefficients = Array(model.variables.length).fill(0)
    coefficients[variableIndex] = 1
    const sense = direction === 'floor' ? '<=' : '>='
    const rhs = direction === 'floor' ? node.branch.floor : node.branch.ceil
    const relation = sense === '<=' ? '≤' : '≥'
    return {
      id: `branch-${node.id}-${direction}`,
      nombre: `${node.branch.variableName} ${relation} ${rhs}`,
      coeficientes: coefficients,
      sentido: sense,
      rhs,
    }
  }

  function result(status, message) {
    return {
      status,
      x: incumbent ? [...incumbent.solution] : null,
      solution: incumbent ? [...incumbent.solution] : null,
      values: incumbent?.values ?? null,
      z: incumbent?.objectiveValue ?? null,
      incumbent,
      candidates,
      nodes,
      history,
      exploredNodes: nodes.filter((node) => node.relaxation !== null).length,
      message,
    }
  }

  if (!Array.isArray(model?.variables) || !Array.isArray(model?.c) || model.variables.length !== model.c.length) {
    return result('invalid', 'El modelo debe incluir variables y costos compatibles.')
  }
  if (typeof simplexFn !== 'function') {
    return result('invalid', 'Se requiere una función Simplex para resolver los nodos.')
  }

  try {
    const root = createNode(null)
    solveNode(root)

    while (!terminalStatus && pending.length > 0) {
      pending.sort((left, right) => left.lowerBound - right.lowerBound || left.sequence - right.sequence)
      const node = pending.shift()

      if (incumbent && shouldPruneByBound(node.lowerBound, incumbent.objectiveValue, boundTolerance)) {
        node.status = 'pruned-bound'
        node.pruneReason = `La cota inferior ${formatNumber(node.lowerBound)} no mejora la incumbente ${formatNumber(incumbent.objectiveValue)}.`
        record('pruned-bound', node, {
          lowerBound: node.lowerBound,
          incumbent: incumbent.objectiveValue,
        })
        continue
      }

      if (nodes.length + 2 > maxNodes) {
        pending.unshift(node)
        terminalStatus = 'node-limit'
        record('node-limit', node, { maxNodes })
        break
      }

      node.status = 'branched'
      record('branched', node, { ...node.branch })
      for (const direction of ['floor', 'ceil']) {
        const constraint = createBranchConstraint(node, direction)
        const child = createNode(node, constraint)
        solveNode(child)
        if (terminalStatus) break
      }
    }

    if (terminalStatus) {
      const messages = {
        invalid: 'Branch and Bound se detuvo por un error al resolver un nodo.',
        'unbounded-relaxation': 'Una relajación de nodo no está acotada; no se certificó una solución entera óptima.',
        'node-limit': `Se alcanzó el límite de ${maxNodes} nodos antes de completar la búsqueda.`,
      }
      return result(terminalStatus, messages[terminalStatus])
    }

    if (incumbent) {
      record('search-completed', null, { objectiveValue: incumbent.objectiveValue })
      return result('optimal', `Óptimo entero encontrado: Z = ${formatNumber(incumbent.objectiveValue)}.`)
    }

    record('search-completed', null, { status: 'infeasible' })
    return result('infeasible', 'No se encontró una solución entera factible.')
  } catch (error) {
    return result('invalid', error.message)
  }
}
