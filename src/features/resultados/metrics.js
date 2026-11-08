const ROUNDING_EPSILON = 1e-10
const MAX_ALTERNATIVE_ROWS = 20

function nameOf(variable, index) {
  return variable.nombre ?? variable.name ?? `x${index + 1}`
}

function countToMeet(requiredCapacity, instanceCapacity) {
  if (requiredCapacity <= 0) return 0
  return Math.max(0, Math.ceil(requiredCapacity / instanceCapacity - ROUNDING_EPSILON))
}

export function extractInstanceCounts(result, variables) {
  if (result?.status !== 'optimal' || !Array.isArray(variables)) return null
  const solution = result.solution ?? result.x
  const counts = {}

  for (const [index, variable] of variables.entries()) {
    const name = nameOf(variable, index)
    const value = result.values?.[name] ?? solution?.[index]
    if (!Number.isFinite(value)) return null
    counts[variable.id ?? name] = value
  }

  return counts
}

export function calculateCapacityMetrics(config, counts) {
  if (!counts) return null
  const small = config.instancias.find((instance) => instance.id === 'S')
  const large = config.instancias.find((instance) => instance.id === 'L')
  const installed = config.instancias.reduce(
    (capacity, instance) => capacity + instance.capacidad * (counts[instance.id] ?? 0),
    0,
  )
  const required = config.demanda + config.reservaFallos

  return {
    demand: config.demanda,
    configuredReserve: config.reservaFallos,
    required,
    installed,
    availableReserve: installed - config.demanda,
    marginOverRequired: installed - required,
    utilizationPercent: installed > 0 ? (config.demanda / installed) * 100 : null,
    targetUtilizationPercent: installed > 0 ? (required / installed) * 100 : null,
    afterLargeFailure: (counts.L ?? 0) >= 1 ? installed - large.capacidad : null,
    afterSmallFailure: (counts.S ?? 0) >= 1 ? installed - small.capacidad : null,
  }
}

export function calculateSmallOnlyAlternative(config) {
  const small = config.instancias.find((instance) => instance.id === 'S')
  const required = config.demanda + config.reservaFallos
  const count = countToMeet(required, small.capacidad)
  return {
    smallCount: count,
    largeCount: 0,
    capacity: count * small.capacidad,
    cost: count * small.costo,
  }
}

export function calculateSavingsPercent(referenceCost, integerCost) {
  if (!Number.isFinite(referenceCost) || referenceCost <= 0 || !Number.isFinite(integerCost)) {
    return null
  }
  return ((referenceCost - integerCost) / referenceCost) * 100
}

export function buildInstanceAlternatives(config, preferredLargeCount = null) {
  const small = config.instancias.find((instance) => instance.id === 'S')
  const large = config.instancias.find((instance) => instance.id === 'L')
  const required = config.demanda + config.reservaFallos
  const largestUsefulCount = Math.min(
    config.maxInstanciasGrandes,
    countToMeet(required, large.capacidad),
  )
  const stride = Math.max(1, Math.ceil((largestUsefulCount + 1) / MAX_ALTERNATIVE_ROWS))
  const largeCounts = new Set()

  for (let count = 0; count <= largestUsefulCount; count += stride) {
    largeCounts.add(count)
  }
  largeCounts.add(largestUsefulCount)
  if (
    Number.isInteger(preferredLargeCount) &&
    preferredLargeCount >= 0 &&
    preferredLargeCount <= config.maxInstanciasGrandes
  ) {
    largeCounts.add(preferredLargeCount)
  }

  return [...largeCounts]
    .sort((left, right) => left - right)
    .map((largeCount) => {
      const smallCount = countToMeet(
        required - largeCount * large.capacidad,
        small.capacidad,
      )
      return {
        smallCount,
        largeCount,
        capacity: smallCount * small.capacidad + largeCount * large.capacidad,
        cost: smallCount * small.costo + largeCount * large.costo,
      }
    })
}