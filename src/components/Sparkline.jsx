export default function Sparkline({ values, width = 80, height = 28 }) {
  if (!values || values.length < 2) {
    return <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>—</span>
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const pts = values
    .map((v, i) =>
      `${(i / (values.length - 1)) * width},${height - ((v - min) / range) * (height - 2) - 1}`
    )
    .join(' ')

  const trend = values[values.length - 1] - values[0]
  const color = trend > 1 ? 'var(--green)' : trend < -1 ? '#ef5350' : 'var(--muted)'

  return (
    <svg
      width={width}
      height={height}
      style={{ overflow: 'visible', display: 'block' }}
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
