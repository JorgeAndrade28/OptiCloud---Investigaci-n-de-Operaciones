import assert from 'node:assert/strict'
import test from 'node:test'
import { configInicial } from '../../data/catalogoInstancias.js'
import { buildModel } from './buildModel.js'
import {
  buildInitialTableau,
  calculateReducedCosts,
  calculateZj,
  pivot,
  selectEnteringVariable,
  selectLeavingVariable,
  solveSimplex,
  standardizeConstraints,
} from './simplex.js'

function makeModel(variables, costs, constraints) {
  return { tipo: 'min', variables, c: costs, restricciones: constraints }
}

test('resuelve la relajación inicial de OptiCloud en dos fases', () => {
  const result = solveSimplex(buildModel(configInicial))

  assert.equal(result.status, 'optimal')
  assert.equal(result.phaseOne.status, 'optimal')
  assert.ok(Math.abs(result.phaseOne.objectiveValue) < 1e-9)
  assert.ok(Math.abs(result.values.x - 2.5) < 1e-9)
  assert.ok(Math.abs(result.values.y - 4) < 1e-9)
  assert.ok(Math.abs(result.z - 0.68) < 1e-9)
})

test('estandariza restricciones <=, >=, = y RHS negativo', () => {
  const model = makeModel(
    [{ id: 'x', nombre: 'x' }],
    [1],
    [
      { id: 'le', sentido: '<=', rhs: 4, coeficientes: [1] },
      { id: 'ge', sentido: '>=', rhs: 2, coeficientes: [1] },
      { id: 'eq', sentido: '=', rhs: 3, coeficientes: [1] },
      { id: 'negative', sentido: '>=', rhs: -5, coeficientes: [-1] },
    ],
  )
  const standard = standardizeConstraints(model)

  assert.deepEqual(standard.rows.map((row) => row.rhs), [4, 2, 3, 5])
  assert.deepEqual(standard.rows.map((row) => row.coefficients[0]), [1, 1, 1, 1])
  assert.equal(standard.columns.find((column) => column.id === 'slack-1').kind, 'slack')
  assert.equal(standard.columns.find((column) => column.id === 'surplus-2').kind, 'surplus')
  assert.equal(standard.columns.find((column) => column.id === 'artificial-2').kind, 'artificial')
  assert.equal(standard.columns.find((column) => column.id === 'artificial-3').kind, 'artificial')
  const negativeRhsSlack = standard.columns.findIndex((column) => column.id === 'slack-4')
  assert.equal(standard.rows[3].basicColumn, negativeRhsSlack)
  assert.equal(standard.rows[3].coefficients[negativeRhsSlack], 1)
})

test('calcula Zj, costos reducidos y pivote sin alterar el tableau original', () => {
  const standard = standardizeConstraints(
    makeModel(
      [{ id: 'x', nombre: 'x' }, { id: 'y', nombre: 'y' }],
      [3, 2],
      [{ id: 'r1', sentido: '<=', rhs: 8, coeficientes: [2, 1] }],
    ),
  )
  const tableau = buildInitialTableau(standard)
  const { zj } = calculateZj(tableau, [0, 0, 0])
  const reduced = calculateReducedCosts([-3, 2, 0], zj)
  const entering = selectEnteringVariable(tableau, reduced)
  const leaving = selectLeavingVariable(tableau, entering)
  const next = pivot(tableau, leaving.row, entering)

  assert.equal(entering, 0)
  assert.equal(leaving.row, 0)
  assert.equal(next.rows[0].coefficients[0], 1)
  assert.equal(next.rows[0].rhs, 4)
  assert.equal(tableau.rows[0].basicColumn, 2)
})

test('detecta inviabilidad cuando la Fase 1 deja artificial positiva', () => {
  const model = makeModel(
    [{ id: 'x', nombre: 'x' }],
    [1],
    [
      { id: 'upper', sentido: '<=', rhs: 1, coeficientes: [1] },
      { id: 'lower', sentido: '>=', rhs: 2, coeficientes: [1] },
    ],
  )
  const result = solveSimplex(model)

  assert.equal(result.status, 'infeasible')
  assert.ok(result.phaseOne.objectiveValue > 0)
})

test('elimina variables artificiales y filas de igualdad redundantes', () => {
  const model = makeModel(
    [{ id: 'x', nombre: 'x' }],
    [1],
    [
      { id: 'eq1', sentido: '=', rhs: 3, coeficientes: [1] },
      { id: 'eq2', sentido: '=', rhs: 6, coeficientes: [2] },
    ],
  )
  const result = solveSimplex(model)
  const phaseTwoStart = result.iterations.find(
    (iteration) => iteration.phase === 'phase2' && iteration.event === 'inicio de fase',
  )

  assert.equal(result.status, 'optimal')
  assert.equal(result.values.x, 3)
  assert.ok(phaseTwoStart)
  assert.equal(phaseTwoStart.columns.some((column) => column.kind === 'artificial'), false)
  assert.equal(phaseTwoStart.coefficients.length, 1)
})

test('detecta un problema no acotado', () => {
  const model = makeModel(
    [{ id: 'x', nombre: 'x' }, { id: 'y', nombre: 'y' }],
    [-1, 0],
    [{ id: 'r1', sentido: '<=', rhs: 1, coeficientes: [1, -1] }],
  )
  assert.equal(solveSimplex(model).status, 'unbounded')
})

test('guarda tableau, fila Zj, costos reducidos y metadatos de pivote', () => {
  const result = solveSimplex(buildModel(configInicial))
  const pivotSnapshot = result.iterations.find((iteration) => iteration.event === 'pivote')

  assert.ok(pivotSnapshot)
  assert.equal(pivotSnapshot.coefficients.length, pivotSnapshot.rhs.length)
  assert.equal(pivotSnapshot.zj.length, pivotSnapshot.columns.length)
  assert.equal(pivotSnapshot.reducedCosts.length, pivotSnapshot.columns.length)
  assert.equal(pivotSnapshot.basicVariables.length, pivotSnapshot.cb.length)
  assert.ok(pivotSnapshot.enteringVariable)
  assert.ok(pivotSnapshot.leavingVariable)
  assert.ok(Math.abs(
    pivotSnapshot.coefficients[pivotSnapshot.pivotPosition.row][pivotSnapshot.pivotPosition.column] - 1,
  ) < 1e-9)
})

test('rechaza pivotes nulos y no selecciona filas con coeficiente no positivo', () => {
  const tableau = buildInitialTableau(standardizeConstraints(
    makeModel(
      [{ id: 'x', nombre: 'x' }],
      [1],
      [{ id: 'r1', sentido: '<=', rhs: 2, coeficientes: [0] }],
    ),
  ))

  assert.equal(selectLeavingVariable(tableau, 0), null)
  assert.throws(() => pivot(tableau, 0, 0), /elemento pivote/)
})