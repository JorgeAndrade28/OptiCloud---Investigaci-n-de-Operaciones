import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { useOptiCloud } from '../../context/OptiCloudContext'
import './page.css'

export function ModeloPage() {
  const { config, model, configValida } = useOptiCloud()

  function terminos(coeficientes) {
    return coeficientes
      .map((coeficiente, index) => ({ coeficiente, variable: model.variables[index].nombre }))
      .filter(({ coeficiente }) => coeficiente !== 0)
      .map(({ coeficiente, variable }) => `${coeficiente === 1 ? '' : coeficiente}${variable}`)
      .join(' + ') || '0'
  }

  function explicarRestriccion(restriccion) {
    if (restriccion.id === 'capacidad') {
      return `La capacidad combinada debe cubrir la demanda (${config.demanda}) más la reserva ante fallos (${config.reservaFallos}): ${restriccion.rhs} solicitudes/s.`
    }

    return `La cantidad de instancias grandes no puede superar el máximo configurado de ${config.maxInstanciasGrandes}.`
  }

  return (
    <div className="page modelo-page">
      <PageHeader
        title="Modelo matemático"
        description="Minimiza el costo por hora sujeto a la demanda y la reserva de capacidad ante fallos."
      />

      {!configValida || !model ? (
        <Card>
          <p className="muted">No hay un modelo válido. Completa la configuración del caso.</p>
        </Card>
      ) : (
        <>
          <Card title="Variables de decisión">
            <dl className="modelo-variables">
              {model.variables.map((variable) => (
                <div key={variable.id}>
                  <dt>{variable.nombre}</dt>
                  <dd>{variable.etiqueta}: cantidad de instancias que se aprovisionan.</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card title="Función objetivo">
            <p className="modelo-equation">
              Minimizar Z = {terminos(model.c)}
            </p>
            <p className="muted">Minimiza el costo total por hora de las instancias aprovisionadas.</p>
          </Card>
          <Card title="Restricciones">
            <ul className="modelo-constraints">
              {model.restricciones.map((restriccion) => (
                <li key={restriccion.id}>
                  <strong className="modelo-equation">
                    {terminos(restriccion.coeficientes)} {restriccion.sentido === '>=' ? '≥' : '≤'}{' '}
                    {restriccion.rhs}
                  </strong>
                  <span className="modelo-restriccion-nombre">{restriccion.nombre}</span>
                  <span className="muted">{explicarRestriccion(restriccion)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Dominio e integralidad">
            <p className="modelo-equation">x ≥ 0, y ≥ 0</p>
            <p>Las cantidades de instancias no pueden ser negativas.</p>
            <div className="modelo-dominios">
              <section>
                <h5>Relajación continua (PL)</h5>
                <p>
                  x, y ∈ R≥0. Permite cantidades fraccionarias y sirve como referencia para el costo mínimo,
                  pero una fracción de instancia no se puede aprovisionar.
                </p>
              </section>
              <section>
                <h5>Modelo entero (PLE)</h5>
                <p className="modelo-equation">x, y ∈ Z≥0</p>
                <p>
                  Las instancias son unidades indivisibles. Por eso la solución que se despliega debe ser entera;
                  Branch and Bound busca esa solución factible y óptima.
                </p>
              </section>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
