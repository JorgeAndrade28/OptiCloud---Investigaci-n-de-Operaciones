export const catalogoInstancias = [
  {
    id: 'S',
    nombre: 'Instancia pequeña S',
    capacidad: 100,
    costo: 0.08,
  },
  {
    id: 'L',
    nombre: 'Instancia grande L',
    capacidad: 250,
    costo: 0.12,
  },
]

export const configInicial = {
  instancias: catalogoInstancias,
  demanda: 1000,
  maxInstanciasGrandes: 4,
  reservaFallos: 250,
}
