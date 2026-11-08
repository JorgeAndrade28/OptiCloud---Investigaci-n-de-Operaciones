export const SIMPLEX_TOLERANCE = 1e-9

function displayNumber(value) {
  return String(Number(value.toPrecision(10)))
}

function normalizedSense(sense) {
  if (sense === '<=' || sense === '≤') return '<='
  if (sense === '>=' || sense === '≥') return '>='
  if (sense === '=') return '='
  throw new TypeError(`Sentido de restricción no soportado: ${sense}`)
}

function reverseSense(sense) {
  if (sense === '<=') return '>='
  if (sense === '>=') return '<='
  return '='
}

function getConstraints(model) {
  if (Array.isArray(model.restricciones)) {
    return model.restricciones.map((constraint, index) => ({
      id: constraint.id ?? `r${index + 1}`,
      name: constraint.nombre ?? constraint.name ?? `Restricción ${index + 1}`,
      coefficients: constraint.coeficientes ?? constraint.coefficients,
      sense: constraint.sentido ?? constraint.sense,
      rhs: constraint.rhs,
    }))
  }

  if (!Array.isArray(model.A) || !Array.isArray(model.b) || !Array.isArray(model.sentidos)) {
    throw new TypeError('El modelo debe incluir restricciones o las matrices A, b y sentidos.')
  }

  return model.A.map((coefficients, index) => ({
    id: `r${index + 1}`,
    name: `Restricción ${index + 1}`,
    coefficients,
    sense: model.sentidos[index],
    rhs: model.b[index],
  }))
}

function assertModel(model) {
  if (!model || (model.tipo ?? model.sense ?? 'min') !== 'min') {
    throw new TypeError('El solver de dos fases requiere un modelo de minimización.')
  }
  if (!Array.isArray(model.variables) || !Array.isArray(model.c)) {
    throw new TypeError('El modelo debe definir variables y coeficientes del objetivo.')
  }
  if (model.variables.length !== model.c.length) {
    throw new TypeError('La cantidad de costos debe coincidir con la cantidad de variables.')
  }
  if (!model.c.every(Number.isFinite)) {
    throw new TypeError('Los coeficientes del objetivo deben ser números finitos.')
  }
}

export function standardizeConstraints(model, tolerance = SIMPLEX_TOLERANCE) {
  assertModel(model)
  const constraints = getConstraints(model)
  const variableCount = model.variables.length
  const normalized = constraints.map((constraint, index) => {
    if (!Array.isArray(constraint.coefficients) || constraint.coefficients.length !== variableCount) {
      throw new TypeError(`Los coeficientes de la restricción ${index + 1} no coinciden con las variables.`)
    }
    if (!constraint.coefficients.every(Number.isFinite) || !Number.isFinite(constraint.rhs)) {
      throw new TypeError(`La restricción ${index + 1} contiene valores no finitos.`)
    }

    let coefficients = [...constraint.coefficients]
    let sense = normalizedSense(constraint.sense)
    let rhs = constraint.rhs

    if (rhs < -tolerance) {
      coefficients = coefficients.map((coefficient) => -coefficient)
      rhs = -rhs
      sense = reverseSense(sense)
    } else if (Math.abs(rhs) <= tolerance) {
      rhs = 0
    }

    return { ...constraint, coefficients, sense, rhs, index }
  })

  const auxiliaryColumns = []
  const rowSpecs = normalized.map((constraint) => {
    const rowIndex = constraint.index + 1
    const spec = { constraint, slackColumn: null, artificialColumn: null }

    if (constraint.sense === '<=') {
      spec.slackColumn = auxiliaryColumns.length
      auxiliaryColumns.push({
        id: `slack-${rowIndex}`,
        name: `S${rowIndex}`,
        kind: 'slack',
      })
    } else if (constraint.sense === '>=') {
      spec.slackColumn = auxiliaryColumns.length
      auxiliaryColumns.push({
        id: `surplus-${rowIndex}`,
        name: `S${rowIndex}`,
        kind: 'surplus',
      })
      spec.artificialColumn = auxiliaryColumns.length
      auxiliaryColumns.push({
        id: `artificial-${rowIndex}`,
        name: `A${rowIndex}`,
        kind: 'artificial',
      })
    } else {
      spec.artificialColumn = auxiliaryColumns.length
      auxiliaryColumns.push({
        id: `artificial-${rowIndex}`,
        name: `A${rowIndex}`,
        kind: 'artificial',
      })
    }

    return spec
  })

  const columns = [
    ...model.variables.map((variable, index) => ({
      id: variable.id ?? `x${index + 1}`,
      name: variable.nombre ?? variable.name ?? `x${index + 1}`,
      kind: 'decision',
      originalIndex: index,
    })),
    ...auxiliaryColumns,
  ]

  const rows = rowSpecs.map(({ constraint, slackColumn, artificialColumn }) => {
    const coefficients = Array(columns.length).fill(0)
    constraint.coefficients.forEach((coefficient, index) => {
      coefficients[index] = coefficient
    })

    let basicColumn
    if (constraint.sense === '<=') {
      coefficients[variableCount + slackColumn] = 1
      basicColumn = variableCount + slackColumn
    } else if (constraint.sense === '>=') {
      coefficients[variableCount + slackColumn] = -1
      coefficients[variableCount + artificialColumn] = 1
      basicColumn = variableCount + artificialColumn
    } else {
      coefficients[variableCount + artificialColumn] = 1
      basicColumn = variableCount + artificialColumn
    }

    return {
      constraintId: constraint.id,
      name: constraint.name,
      coefficients,
      rhs: constraint.rhs,
      basicColumn,
    }
  })

  const phaseOneCosts = columns.map((column) => Number(column.kind === 'artificial'))
  const phaseTwoCosts = columns.map((column, index) =>
    column.kind === 'decision' ? model.c[index] : 0,
  )

  return {
    columns,
    rows,
    phaseOneCosts,
    phaseTwoCosts,
    originalVariableCount: variableCount,
    tolerance,
  }
}

export function buildInitialTableau(standardForm) {
  return {
    columns: standardForm.columns.map((column) => ({ ...column })),
    rows: standardForm.rows.map((row) => ({
      ...row,
      coefficients: [...row.coefficients],
    })),
    phaseOneCosts: [...standardForm.phaseOneCosts],
    phaseTwoCosts: [...standardForm.phaseTwoCosts],
    costs: [...standardForm.phaseOneCosts],
    originalVariableCount: standardForm.originalVariableCount,
    tolerance: standardForm.tolerance,
    phase: 'phase1',
  }
}

export function calculateZj(tableau, costs = tableau.costs) {
  if (costs.length !== tableau.columns.length) {
    throw new TypeError('La cantidad de costos no coincide con las columnas del tableau.')
  }

  const zj = Array(tableau.columns.length).fill(0)
  let objectiveValue = 0
  tableau.rows.forEach((row) => {
    const basicCost = costs[row.basicColumn]
    objectiveValue += basicCost * row.rhs
    row.coefficients.forEach((coefficient, index) => {
      zj[index] += basicCost * coefficient
    })
  })

  return { zj, objectiveValue }
}

export function calculateReducedCosts(costs, zj) {
  if (costs.length !== zj.length) {
    throw new TypeError('Los costos y la fila Zj deben tener la misma longitud.')
  }
  return costs.map((cost, index) => cost - zj[index])
}

export function selectEnteringVariable(tableau, reducedCosts, tolerance = tableau.tolerance) {
  const basicColumns = new Set(tableau.rows.map((row) => row.basicColumn))
  for (let column = 0; column < reducedCosts.length; column += 1) {
    if (!basicColumns.has(column) && reducedCosts[column] < -tolerance) {
      return column
    }
  }
  return null
}

export function selectLeavingVariable(tableau, enteringColumn, tolerance = tableau.tolerance) {
  let selected = null
  tableau.rows.forEach((row, rowIndex) => {
    const coefficient = row.coefficients[enteringColumn]
    if (coefficient <= tolerance) {
      return
    }

    const rhs = Math.abs(row.rhs) <= tolerance ? 0 : row.rhs
    const ratio = rhs / coefficient
    if (
      selected === null ||
      ratio < selected.ratio - tolerance ||
      (Math.abs(ratio - selected.ratio) <= tolerance && row.basicColumn < selected.basicColumn)
    ) {
      selected = { row: rowIndex, ratio, basicColumn: row.basicColumn }
    }
  })

  return selected
}

export function pivot(tableau, pivotRow, pivotColumn, tolerance = tableau.tolerance) {
  const pivotElement = tableau.rows[pivotRow]?.coefficients[pivotColumn]
  if (!Number.isFinite(pivotElement) || Math.abs(pivotElement) <= tolerance) {
    throw new RangeError('El elemento pivote debe ser finito y distinto de cero.')
  }

  const rows = tableau.rows.map((row) => ({
    ...row,
    coefficients: [...row.coefficients],
  }))
  const selectedRow = rows[pivotRow]
  selectedRow.coefficients = selectedRow.coefficients.map((coefficient) => coefficient / pivotElement)
  selectedRow.rhs /= pivotElement

  rows.forEach((row, rowIndex) => {
    if (rowIndex === pivotRow) return
    const factor = row.coefficients[pivotColumn]
    row.coefficients = row.coefficients.map((coefficient, columnIndex) => {
      const value = coefficient - factor * selectedRow.coefficients[columnIndex]
      return Math.abs(value) <= tolerance ? 0 : value
    })
    row.rhs -= factor * selectedRow.rhs
    if (Math.abs(row.rhs) <= tolerance) row.rhs = 0
  })

  selectedRow.coefficients = selectedRow.coefficients.map((coefficient) =>
    Math.abs(coefficient) <= tolerance ? 0 : coefficient,
  )
  if (Math.abs(selectedRow.rhs) <= tolerance) selectedRow.rhs = 0
  selectedRow.basicColumn = pivotColumn

  return { ...tableau, rows }
}

function createSnapshot(tableau, iteration, pivotData = null, event = 'iteración') {
  const { zj, objectiveValue } = calculateZj(tableau)
  const reducedCosts = calculateReducedCosts(tableau.costs, zj)
  const pivotPosition = Number.isInteger(pivotData?.row) && Number.isInteger(pivotData?.column)
    ? { row: pivotData.row, column: pivotData.column }
    : null

  return {
    iteration,
    phase: tableau.phase,
    event,
    columns: tableau.columns.map((column) => ({ ...column })),
    columnCosts: [...tableau.costs],
    basicVariables: tableau.rows.map((row) => tableau.columns[row.basicColumn].name),
    cb: tableau.rows.map((row) => tableau.costs[row.basicColumn]),
    rowNames: tableau.rows.map((row) => row.name),
    coefficients: tableau.rows.map((row) => [...row.coefficients]),
    rhs: tableau.rows.map((row) => row.rhs),
    zj,
    reducedCosts,
    objectiveValue,
    enteringVariable: pivotData?.enteringVariable ?? null,
    leavingVariable: pivotData?.leavingVariable ?? null,
    pivotElement: pivotData?.pivotElement ?? null,
    pivotPosition,
  }
}

function runPhase(tableau, phase, costs, state, history, maxIterations) {
  let current = { ...tableau, phase, costs: [...costs] }
  history.push(createSnapshot(current, state.iterations, null, 'inicio de fase'))

  while (true) {
    const { zj, objectiveValue } = calculateZj(current)
    const reducedCosts = calculateReducedCosts(current.costs, zj)
    const enteringColumn = selectEnteringVariable(current, reducedCosts)

    if (enteringColumn === null) {
      history.push(createSnapshot(current, state.iterations, null, 'óptimo de fase'))
      return { status: 'optimal', tableau: current, objectiveValue }
    }

    const leaving = selectLeavingVariable(current, enteringColumn)
    if (leaving === null) {
      history.push(createSnapshot(current, state.iterations, {
        enteringVariable: current.columns[enteringColumn].name,
      }, 'no acotado'))
      return { status: 'unbounded', tableau: current, objectiveValue }
    }

    if (state.iterations >= maxIterations) {
      history.push(createSnapshot(current, state.iterations, {
        enteringVariable: current.columns[enteringColumn].name,
      }, 'límite de iteraciones'))
      return { status: 'iteration-limit', tableau: current, objectiveValue }
    }

    const leavingVariable = current.columns[current.rows[leaving.row].basicColumn].name
    const pivotElement = current.rows[leaving.row].coefficients[enteringColumn]
    current = pivot(current, leaving.row, enteringColumn)
    state.iterations += 1
    history.push(createSnapshot(current, state.iterations, {
      row: leaving.row,
      column: enteringColumn,
      enteringVariable: current.columns[enteringColumn].name,
      leavingVariable,
      pivotElement,
    }, 'pivote'))
  }
}

export function removeArtificialVariables(tableau) {
  let current = { ...tableau, rows: [...tableau.rows] }

  for (let rowIndex = 0; rowIndex < current.rows.length; rowIndex += 1) {
    const row = current.rows[rowIndex]
    if (current.columns[row.basicColumn].kind !== 'artificial') continue
    if (Math.abs(row.rhs) > current.tolerance) {
      return { status: 'infeasible', tableau: current }
    }

    const basicColumns = new Set(current.rows.map((item) => item.basicColumn))
    const replacementColumn = current.columns.findIndex((column, columnIndex) =>
      column.kind !== 'artificial' &&
      !basicColumns.has(columnIndex) &&
      Math.abs(row.coefficients[columnIndex]) > current.tolerance,
    )

    if (replacementColumn === -1) {
      current.rows = current.rows.filter((_, index) => index !== rowIndex)
      rowIndex -= 1
    } else {
      current = pivot(current, rowIndex, replacementColumn)
    }
  }

  const keptIndices = current.columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => column.kind !== 'artificial')
  const remap = new Map(keptIndices.map(({ index }, nextIndex) => [index, nextIndex]))
  const columns = keptIndices.map(({ column }) => column)
  const rows = current.rows.map((row) => ({
    ...row,
    coefficients: keptIndices.map(({ index }) => row.coefficients[index]),
    basicColumn: remap.get(row.basicColumn),
  }))

  return {
    status: 'ok',
    tableau: {
      ...current,
      columns,
      rows,
      phaseOneCosts: columns.map((column) => Number(column.kind === 'artificial')),
      phaseTwoCosts: columns.map((column) =>
        column.kind === 'decision' ? tableau.phaseTwoCosts[column.originalIndex] : 0,
      ),
    },
  }
}

function collectSolution(tableau, model) {
  const solution = Array(tableau.originalVariableCount).fill(0)
  tableau.rows.forEach((row) => {
    const column = tableau.columns[row.basicColumn]
    if (column.kind === 'decision') {
      solution[column.originalIndex] = Math.abs(row.rhs) <= tableau.tolerance ? 0 : row.rhs
    }
  })
  const values = Object.fromEntries(
    model.variables.map((variable, index) => [variable.nombre ?? variable.name ?? `x${index + 1}`, solution[index]]),
  )
  return { solution, values }
}

function failureResult(status, message, history, phaseOne = null) {
  return {
    status,
    x: null,
    solution: null,
    values: null,
    z: null,
    objectiveValue: null,
    phaseOne,
    iterations: history,
    history,
    message,
  }
}

export function solveSimplex(model, options = {}) {
  const tolerance = options.tolerance ?? SIMPLEX_TOLERANCE
  const maxIterations = options.maxIterations ?? 10000
  const history = []
  const state = { iterations: 0 }

  try {
    const standardForm = standardizeConstraints(model, tolerance)
    let tableau = buildInitialTableau(standardForm)
    const phaseOne = runPhase(
      tableau,
      'phase1',
      tableau.phaseOneCosts,
      state,
      history,
      maxIterations,
    )

    if (phaseOne.status !== 'optimal') {
      return failureResult(
        phaseOne.status,
        phaseOne.status === 'unbounded'
          ? 'La Fase 1 resultó no acotada; revisa la formulación y la tolerancia numérica.'
          : 'Se alcanzó el límite de iteraciones durante la Fase 1.',
        history,
      )
    }

    const phaseOneValue = Math.abs(phaseOne.objectiveValue) <= tolerance
      ? 0
      : Math.max(0, phaseOne.objectiveValue)
    if (phaseOneValue > tolerance) {
      return failureResult(
        'infeasible',
        `El modelo es inviable: el mínimo de la Fase 1 es W = ${displayNumber(phaseOneValue)}.`,
        history,
        { status: 'infeasible', objectiveValue: phaseOneValue },
      )
    }

    const cleanup = removeArtificialVariables(phaseOne.tableau)
    if (cleanup.status !== 'ok') {
      return failureResult(
        'infeasible',
        'El modelo es inviable: quedó una variable artificial positiva en la base.',
        history,
        { status: 'infeasible', objectiveValue: phaseOneValue },
      )
    }

    tableau = cleanup.tableau
    const phaseTwo = runPhase(
      tableau,
      'phase2',
      tableau.phaseTwoCosts,
      state,
      history,
      maxIterations,
    )
    if (phaseTwo.status !== 'optimal') {
      return failureResult(
        phaseTwo.status,
        phaseTwo.status === 'unbounded'
          ? 'El modelo es no acotado: existe una variable entrante sin variable saliente.'
          : 'Se alcanzó el límite de iteraciones durante la Fase 2.',
        history,
        { status: 'optimal', objectiveValue: phaseOneValue },
      )
    }

    const { solution, values } = collectSolution(phaseTwo.tableau, model)
    const objectiveValue = phaseTwo.objectiveValue
    return {
      status: 'optimal',
      x: solution,
      solution,
      values,
      z: objectiveValue,
      objectiveValue,
      phaseOne: { status: 'optimal', objectiveValue: phaseOneValue },
      iterations: history,
      history,
      message: `Óptimo encontrado. Valor de la función objetivo: ${displayNumber(objectiveValue)}.`,
    }
  } catch (error) {
    return failureResult('invalid', error.message, history)
  }
}
