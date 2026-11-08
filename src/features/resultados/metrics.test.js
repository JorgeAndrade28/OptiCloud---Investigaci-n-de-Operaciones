import assert from 'node:assert/strict'
import test from 'node:test'
import { configInicial } from '../../data/catalogoInstancias.js'
import {
  buildInstanceAlternatives,
  calculateCapacityMetrics,
  calculateSavingsPercent,
  calculateSmallOnlyAlternative,
  extractInstanceCounts,
} from './metrics.js'

test('extrae conteos usando los resultados reales de los algoritmos', () => {
  const variables = [
    { id: 'S', nombre: 'x' },
    { id: 'L', nombre: 'y' },
  ]
  assert.deepEqual(extractInstanceCounts({
    status: 'optimal',
    values: { x: 2.5, y: 4 },
    solution: [2.5, 4],
  }, variables), { S: 2.5, L: 4 })
  assert.equal(extractInstanceCounts({ status: 'infeasible' }, variables), null)
})

test('calcula capacidad, reserva, utilización y escenarios de fallo desde la solución entera', () => {
  const metrics = calculateCapacityMetrics(configInicial, { S: 3, L: 4 })

  assert.equal(metrics.demand, 1000)
  assert.equal(metrics.configuredReserve, 250)
  assert.equal(metrics.required, 1250)
  assert.equal(metrics.installed, 1300)
  assert.equal(metrics.availableReserve, 300)
  assert.equal(metrics.marginOverRequired, 50)
  assert.ok(Math.abs(metrics.utilizationPercent - (1000 / 1300) * 100) < 1e-9)
  assert.equal(metrics.afterLargeFailure, 1050)
  assert.equal(metrics.afterSmallFailure, 1200)
})

test('calcula la alternativa de solo pequeñas y el ahorro porcentual', () => {
  const smallOnly = calculateSmallOnlyAlternative(configInicial)

  assert.equal(smallOnly.smallCount, 13)
  assert.equal(smallOnly.capacity, 1300)
  assert.ok(Math.abs(smallOnly.cost - 1.04) < 1e-9)
  assert.ok(Math.abs(calculateSavingsPercent(smallOnly.cost, 0.72) - (0.32 / 1.04) * 100) < 1e-9)
})

test('genera combinaciones factibles según la demanda y el máximo configurado', () => {
  const alternatives = buildInstanceAlternatives(configInicial, 4)

  assert.deepEqual(alternatives.map(({ smallCount, largeCount }) => [smallCount, largeCount]), [
    [13, 0],
    [10, 1],
    [8, 2],
    [5, 3],
    [3, 4],
  ])
  assert.ok(alternatives.every((alternative) => alternative.capacity >= 1250))
  assert.ok(alternatives.every((alternative) => alternative.largeCount <= configInicial.maxInstanciasGrandes))
})

test('actualiza los cálculos al cambiar demanda, reserva y capacidades', () => {
  const config = {
    ...configInicial,
    demanda: 800,
    reservaFallos: 200,
    instancias: configInicial.instancias.map((instance) =>
      instance.id === 'S' ? { ...instance, capacidad: 200, costo: 0.1 } : instance,
    ),
  }
  const smallOnly = calculateSmallOnlyAlternative(config)
  const alternatives = buildInstanceAlternatives(config)

  assert.equal(smallOnly.smallCount, 5)
  assert.equal(smallOnly.capacity, 1000)
  assert.equal(smallOnly.cost, 0.5)
  assert.ok(alternatives.every((alternative) => alternative.capacity >= 1000))
})