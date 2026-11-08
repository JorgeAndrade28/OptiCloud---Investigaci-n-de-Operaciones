import { useState } from 'react'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { useOptiCloud } from '../../context/OptiCloudContext'
import { configInicial } from '../../data/catalogoInstancias'
import './page.css'

function crearBorrador(config) {
  return {
    demanda: String(config.demanda),
    capacidadS: String(config.instancias.find((instancia) => instancia.id === 'S').capacidad),
    costoS: String(config.instancias.find((instancia) => instancia.id === 'S').costo),
    capacidadL: String(config.instancias.find((instancia) => instancia.id === 'L').capacidad),
    costoL: String(config.instancias.find((instancia) => instancia.id === 'L').costo),
    maxInstanciasGrandes: String(config.maxInstanciasGrandes),
    reservaFallos: String(config.reservaFallos),
  }
}

const campos = [
  { name: 'demanda', label: 'Solicitudes por segundo', min: '0', step: 'any', unit: 'solicitudes/s' },
  { name: 'capacidadS', label: 'Capacidad S', min: '0.01', step: 'any', unit: 'solicitudes/s' },
  { name: 'costoS', label: 'Costo S', min: '0', step: 'any', unit: 'unidades monetarias/hora' },
  { name: 'capacidadL', label: 'Capacidad L', min: '0.01', step: 'any', unit: 'solicitudes/s' },
  { name: 'costoL', label: 'Costo L', min: '0', step: 'any', unit: 'unidades monetarias/hora' },
  { name: 'maxInstanciasGrandes', label: 'Máximo de instancias L', min: '0', step: '1', unit: 'instancias' },
  { name: 'reservaFallos', label: 'Reserva ante fallos', min: '0', step: 'any', unit: 'solicitudes/s' },
]

export function ConfiguracionPage() {
  const { config, updateConfig, resetConfig } = useOptiCloud()
  const [borrador, setBorrador] = useState(() => crearBorrador(config))
  const [mensaje, setMensaje] = useState('')

  function guardarConfiguracion(event) {
    event.preventDefault()
    const form = event.currentTarget

    if (!form.reportValidity()) {
      return
    }

    const valores = Object.fromEntries(
      Object.entries(borrador).map(([key, value]) => [key, Number(value)]),
    )
    if (Object.values(valores).some((value) => !Number.isFinite(value))) {
      setMensaje('Revisa los valores: todos deben ser números válidos.')
      return
    }

    updateConfig((actual) => ({
      ...actual,
      demanda: valores.demanda,
      reservaFallos: valores.reservaFallos,
      maxInstanciasGrandes: valores.maxInstanciasGrandes,
      instancias: actual.instancias.map((instancia) =>
        instancia.id === 'S'
          ? { ...instancia, capacidad: valores.capacidadS, costo: valores.costoS }
          : { ...instancia, capacidad: valores.capacidadL, costo: valores.costoL },
      ),
    }))
    setMensaje('Configuración guardada.')
  }

  function restaurarConfiguracion() {
    resetConfig()
    setBorrador(crearBorrador(configInicial))
    setMensaje('Se restauraron los valores iniciales.')
  }

  return (
    <div className="page configuracion-page">
      <PageHeader
        title="Configuración"
        description="Ajusta la demanda, las capacidades y los límites de disponibilidad."
        actions={
          <button type="button" className="btn btn-ghost" onClick={restaurarConfiguracion}>
            Restablecer valores
          </button>
        }
      />

      <Card title="Parámetros del dimensionamiento">
        <form className="config-form" onSubmit={guardarConfiguracion} noValidate>
          {campos.map((campo) => (
            <label className="config-field" key={campo.name}>
              <span>{campo.label}</span>
              <span className="config-input-wrap">
                <input
                  type="number"
                  name={campo.name}
                  min={campo.min}
                  step={campo.step}
                  required
                  value={borrador[campo.name]}
                  onChange={(event) => {
                    setBorrador((actual) => ({ ...actual, [campo.name]: event.target.value }))
                    setMensaje('')
                  }}
                />
                <span className="config-unit">{campo.unit}</span>
              </span>
            </label>
          ))}
          <p className="config-note" role="status" aria-live="polite">{mensaje}</p>
          <div className="config-actions">
            <button type="submit" className="btn">Guardar cambios</button>
          </div>
        </form>
      </Card>
    </div>
  )
}
