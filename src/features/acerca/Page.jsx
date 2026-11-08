import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import './page.css'

const temas = [
  {
    title: 'Problema real',
    text: 'Una aplicación web puede recibir cientos o miles de solicitudes por segundo y necesita suficiente capacidad de procesamiento para responderlas sin interrupciones.',
  },
  {
    title: 'Investigación de Operaciones',
    text: 'Los modelos matemáticos permiten elegir una combinación de recursos que minimice costos y, al mismo tiempo, cumpla la demanda y las restricciones operativas.',
  },
  {
    title: 'Ingeniería de Software',
    text: 'La capacidad de cada tipo de instancia es un parámetro estimado. En un entorno real debe calibrarse con pruebas de carga, mediciones de rendimiento y las características de la aplicación.',
  },
  {
    title: 'Infraestructura en la nube',
    text: 'La asignación calculada puede servir como referencia para diseñar políticas de escalabilidad automática, por ejemplo, AWS Auto Scaling, junto con métricas, límites y validaciones operativas.',
  },
]

export function AcercaPage() {
  return (
    <div className="page acerca-page">
      <PageHeader
        title="Acerca del proyecto"
        description="OptiCloud conecta optimización matemática, ingeniería de software e infraestructura en la nube."
      />

      <div className="acerca-grid">
        {temas.map((tema) => (
          <Card key={tema.title} title={tema.title}>
            <p>{tema.text}</p>
          </Card>
        ))}
      </div>

      <Card title="Alcance de OptiCloud">
        <p className="acerca-disclaimer">
          OptiCloud es una herramienta académica de apoyo a la optimización. Formula y compara soluciones,
          pero no administra servidores reales ni aplica cambios en cuentas o servicios de nube.
        </p>
      </Card>
    </div>
  )
}