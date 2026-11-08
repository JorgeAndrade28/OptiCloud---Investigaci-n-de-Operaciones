import { Chart } from 'chart.js/auto'
import { useEffect, useRef } from 'react'

export function ChartPanel({ type = 'bar', data, options }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !data) {
      return undefined
    }

    chartRef.current?.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...options,
      },
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [type, data, options])

  if (!data) {
    return <p className="muted">Aún no hay datos para graficar.</p>
  }

  return (
    <div className="chart-panel">
      <canvas ref={canvasRef} />
    </div>
  )
}
