export function formatIST(dateInput) {
  if (!dateInput) return '—'
  if (typeof dateInput === 'string' && dateInput.includes('IST')) {
    return dateInput
  }
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return String(dateInput)
  return (
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(d) + ' IST'
  )
}
