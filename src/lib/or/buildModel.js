export function isConfigValid(config) {
  if (!Array.isArray(config?.instancias) || config.instancias.length !== 2) {
    return false
  }

  if (!['S', 'L'].every((id) => config.instancias.some((instancia) => instancia.id === id))) {
    return false
  }

  const demandaValida = [config.demanda, config.reservaFallos].every(
    (value) => Number.isFinite(value) && value >= 0,
  )
  const maximoValido = Number.isInteger(config.maxInstanciasGrandes) && config.maxInstanciasGrandes >= 0

  const instanciasValidas = config.instancias.every(
    (instancia) =>
      Number.isFinite(instancia.capacidad) &&
      instancia.capacidad > 0 &&
      Number.isFinite(instancia.costo) &&
      instancia.costo >= 0,
  )

  return demandaValida && maximoValido && instanciasValidas
}

export function buildModel(config) {
  if (!isConfigValid(config)) {
    return null
  }

  const variables = config.instancias.map((instancia) => ({
    id: instancia.id,
    nombre: instancia.id === 'S' ? 'x' : 'y',
    etiqueta: instancia.nombre,
  }))

  const c = config.instancias.map((instancia) => instancia.costo)

  const restricciones = [
    {
      id: 'capacidad',
      nombre: 'Capacidad requerida (solicitudes/s)',
      sentido: '>=',
      rhs: config.demanda + config.reservaFallos,
      coeficientes: config.instancias.map((instancia) => instancia.capacidad),
    },
    {
      id: 'max-instancias-grandes',
      nombre: 'Máximo de instancias L',
      sentido: '<=',
      rhs: config.maxInstanciasGrandes,
      coeficientes: config.instancias.map((instancia) => Number(instancia.id === 'L')),
    },
  ]

  return {
    tipo: 'min',
    variables,
    c,
    A: restricciones.map((restriccion) => restriccion.coeficientes),
    b: restricciones.map((restriccion) => restriccion.rhs),
    sentidos: restricciones.map((restriccion) => restriccion.sentido),
    restricciones,
  }
}
