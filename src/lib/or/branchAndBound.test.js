import assert from 'node:assert/strict'
import test from 'node:test'
import { configInicial } from '../../data/catalogoInstancias.js'
import { buildModel } from './buildModel.js'
import { solveBranchAndBound, shouldPruneByBound } from './branchAndBound.js'
import { solveSimplex } from './simplex.js'

test('resuelve OptiCloud con Simplex en todos los nodos y obtiene el óptimo entero', () => {
  const model = buildModel(configInicial)
  let simplexCalls = 0
  const result = solveBranchAndBound(model, (nodeModel) => {
    simplexCalls += 1
    return solveSimplex(nodeModel)
  })

  assert.equal(result.status, 'optimal')
  assert.equal(simplexCalls, 5)
  assert.equal(result.exploredNodes, 5)
  assert.equal(result.values.x, 3)
  assert.equal(result.values.y, 4)
  assert.ok(Math.abs(result.z - 0.72) < 1e-9)
  assert.equal(100 * result.values.x + 250 * result.values.y, 1300)
})

test('genera dinámicamente las dos ramas a partir de la variable fraccionaria', () => {
  const result = solveBranchAndBound(buildModel(configInicial), solveSimplex)
  const root = result.nodes.find((node) => node.id === 'N0')
  const floorChild = result.nodes.find((node) => node.id === 'N1')
  const ceilChild = result.nodes.find((node) => node.id === 'N2')

  assert.deepEqual(root.childrenIds, ['N1', 'N2'])
  assert.equal(root.branch.variableName, 'x')
  assert.equal(floorChild.branchConstraint.nombre, 'x ≤ 2')
  assert.equal(floorChild.branchConstraint.sentido, '<=')
  assert.equal(floorChild.branchConstraint.rhs, 2)
  assert.equal(ceilChild.branchConstraint.nombre, 'x ≥ 3')
  assert.equal(ceilChild.branchConstraint.sentido, '>=')
  assert.equal(ceilChild.branchConstraint.rhs, 3)
})

test('resuelve las ramas de segundo nivel y mejora la incumbente', () => {
  const result = solveBranchAndBound(buildModel(configInicial), solveSimplex)
  const floorChild = result.nodes.find((node) => node.id === 'N1')
  const ceilChild = result.nodes.find((node) => node.id === 'N2')

  assert.equal(floorChild.status, 'infeasible')
  assert.equal(ceilChild.status, 'branched')
  assert.ok(Math.abs(ceilChild.lowerBound - 0.696) < 1e-9)
  assert.equal(ceilChild.branch.variableName, 'y')
  const yFloorChild = result.nodes.find((node) => node.id === 'N3')
  const yCeilChild = result.nodes.find((node) => node.id === 'N4')
  assert.equal(yFloorChild.status, 'integral')
  assert.equal(yFloorChild.relaxation.values.x, 5)
  assert.equal(yFloorChild.relaxation.values.y, 3)
  assert.ok(Math.abs(yFloorChild.relaxation.objectiveValue - 0.76) < 1e-9)
  assert.equal(yCeilChild.status, 'integral')
  assert.equal(yCeilChild.relaxation.values.x, 3)
  assert.equal(yCeilChild.relaxation.values.y, 4)
  assert.ok(Math.abs(yCeilChild.relaxation.objectiveValue - 0.72) < 1e-9)
})

test('conserva padre, hijos y camino completo de restricciones', () => {
  const result = solveBranchAndBound(buildModel(configInicial), solveSimplex)
  const root = result.nodes.find((node) => node.id === 'N0')
  const secondLevel = result.nodes.find((node) => node.id === 'N4')

  assert.equal(root.parentId, null)
  assert.equal(secondLevel.parentId, 'N2')
  assert.equal(root.childrenIds.length, 2)
  assert.deepEqual(secondLevel.additionalConstraints.map((constraint) => constraint.nombre), [
    'x ≥ 3',
    'y ≥ 4',
  ])
  assert.ok(result.history.some((entry) => entry.event === 'pruned-infeasible'))
  assert.ok(result.history.some((entry) => entry.event === 'integer-candidate'))
})

test('genera coeficientes de ramificación según el orden real de variables', () => {
  const reversedConfig = {
    ...configInicial,
    instancias: [...configInicial.instancias].reverse(),
  }
  const result = solveBranchAndBound(buildModel(reversedConfig), solveSimplex)
  const floorChild = result.nodes.find((node) => node.id === 'N1')

  assert.equal(result.status, 'optimal')
  assert.equal(result.values.x, 3)
  assert.equal(result.values.y, 4)
  assert.deepEqual(floorChild.branchConstraint.coeficientes, [0, 1])
})

test('poda por cota usa el sentido correcto para minimización', () => {
  assert.equal(shouldPruneByBound(0.72, 0.72), true)
  assert.equal(shouldPruneByBound(0.721, 0.72), true)
  assert.equal(shouldPruneByBound(0.719, 0.72), false)
  assert.equal(shouldPruneByBound(0.72, null), false)
})

test('poda una rama fraccionaria cuando su cota no mejora la incumbente', () => {
  const model = {
    tipo: 'min',
    variables: [
      { id: 'x', nombre: 'x' },
      { id: 'y', nombre: 'y' },
    ],
    c: [1, 2],
    restricciones: [
      { id: 'r1', sentido: '>=', rhs: 3, coeficientes: [2, 1] },
      { id: 'r2', sentido: '>=', rhs: -1.5, coeficientes: [-1, 1] },
    ],
  }
  const result = solveBranchAndBound(model, solveSimplex)
  const boundPrunedChild = result.nodes.find((node) => node.id === 'N2')

  assert.equal(result.status, 'optimal')
  assert.equal(result.values.x, 1)
  assert.equal(result.values.y, 1)
  assert.equal(result.z, 3)
  assert.equal(boundPrunedChild.status, 'pruned-bound')
  assert.ok(Math.abs(boundPrunedChild.lowerBound - 3) < 1e-9)
  assert.ok(result.history.some((entry) => entry.event === 'pruned-bound'))
})