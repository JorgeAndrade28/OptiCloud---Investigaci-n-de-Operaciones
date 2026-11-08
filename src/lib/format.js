export function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }

  return Number(value).toLocaleString('es-CO', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }

  return Number(value).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

export function formatStatus(status) {
  const labels = {
    pendiente: 'Pendiente',
    optimo: 'Óptimo',
    inviable: 'Inviable',
    'no-acotado': 'No acotado',
  }

  return labels[status] ?? status ?? '—'
}
