import { useState } from 'react'
import { fakeIdVg, sweep, type Experiment } from '../data'

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#be185d', '#65a30d', '#7c3aed', '#ca8a04', '#0f766e', '#475569']

type Mode = 'IdVg' | 'IdVd'

interface Props {
  experiments: Experiment[]
  highlight: number
}

export default function PlotView({ experiments, highlight }: Props) {
  const [mode, setMode] = useState<Mode>('IdVg')
  const [logY, setLogY] = useState(true)
  const [hover, setHover] = useState<number | null>(null)

  if (experiments.length === 0) {
    return <div className="empty">No results yet. Press <b>▶ Run</b> to generate (dummy) device results.</div>
  }

  const W = 760
  const H = 440
  const m = { l: 70, r: 20, t: 20, b: 50 }
  const pw = W - m.l - m.r
  const ph = H - m.t - m.b
  const xs = sweep(0, 1.2, 61)
  const useLog = mode === 'IdVg' && logY

  const series = experiments.map((e) => ({
    e,
    pts: xs.map((v) => {
      const id =
        mode === 'IdVg'
          ? fakeIdVg(e.values.Lg, e.values.Tox, e.values.Vd, v)
          : fakeIdVg(e.values.Lg, e.values.Tox, Math.max(v, 1e-3), 1.0)
      return [v, id] as const
    }),
  }))

  const allY = series.flatMap((s) => s.pts.map((p) => p[1]))
  const yMax = Math.max(...allY)
  const yMin = useLog ? 1e-12 : 0
  const yTop = useLog ? 10 ** Math.ceil(Math.log10(yMax)) : yMax * 1.05

  const fx = (x: number) => m.l + (x / 1.2) * pw
  const fy = (y: number) =>
    useLog
      ? m.t + ph * (1 - (Math.log10(Math.max(y, yMin)) - Math.log10(yMin)) / (Math.log10(yTop) - Math.log10(yMin)))
      : m.t + ph * (1 - y / yTop)

  const yTicks = useLog
    ? sweep(Math.log10(yMin), Math.log10(yTop), Math.log10(yTop) - Math.log10(yMin) + 1).map((p) => 10 ** p)
    : sweep(0, yTop, 6)

  return (
    <div className="plot">
      <div className="structure-bar">
        <strong>Plot_{mode}</strong>
        <label>
          Curve
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="IdVg">Id–Vg (transfer)</option>
            <option value="IdVd">Id–Vd (output, Vg=1.0V)</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={logY} disabled={mode !== 'IdVg'} onChange={(e) => setLogY(e.target.checked)} /> Log Y
        </label>
      </div>
      <div className="plot-main">
        <svg viewBox={`0 0 ${W} ${H}`} className="chart">
          <rect x={m.l} y={m.t} width={pw} height={ph} fill="var(--plot-bg)" stroke="var(--border)" />
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={m.l} x2={m.l + pw} y1={fy(t)} y2={fy(t)} stroke="var(--grid)" />
              <text x={m.l - 6} y={fy(t) + 4} textAnchor="end" className="tick">
                {useLog ? `1e${Math.round(Math.log10(t))}` : t.toExponential(1)}
              </text>
            </g>
          ))}
          {sweep(0, 1.2, 7).map((t) => (
            <g key={t}>
              <line x1={fx(t)} x2={fx(t)} y1={m.t} y2={m.t + ph} stroke="var(--grid)" />
              <text x={fx(t)} y={m.t + ph + 16} textAnchor="middle" className="tick">
                {t.toFixed(1)}
              </text>
            </g>
          ))}
          <text x={m.l + pw / 2} y={H - 10} textAnchor="middle" className="axis-label">
            {mode === 'IdVg' ? 'gate OuterVoltage [V]' : 'drain OuterVoltage [V]'}
          </text>
          <text transform={`translate(16 ${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" className="axis-label">
            drain TotalCurrent [A/µm]
          </text>
          {series.map(({ e, pts }, i) => {
            const active = hover === e.id || (hover === null && e.id === highlight)
            return (
              <polyline
                key={e.id}
                fill="none"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={active ? 3 : 1.5}
                opacity={hover !== null && !active ? 0.3 : 1}
                points={pts.map(([x, y]) => `${fx(x)},${fy(y)}`).join(' ')}
              />
            )
          })}
        </svg>
        <ul className="plot-legend">
          {series.map(({ e }, i) => (
            <li key={e.id} onMouseEnter={() => setHover(e.id)} onMouseLeave={() => setHover(null)}>
              <i style={{ background: COLORS[i % COLORS.length] }} />
              n{e.id * 10 + 2}: Lg={e.values.Lg} Tox={e.values.Tox} Vd={e.values.Vd}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
