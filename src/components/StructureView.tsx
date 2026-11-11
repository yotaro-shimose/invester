import { useEffect, useRef, useState } from 'react'
import { fakeDoping } from '../data'

type Field = 'NetActive' | 'ElectronDensity' | 'ElectricField'

const X0 = -0.15
const X1 = 0.15
const Y0 = -0.11
const Y1 = 0.12

// Rainbow colormap: t in [0,1]
function rainbow(t: number): [number, number, number] {
  t = Math.min(1, Math.max(0, t))
  const stops: [number, number, number][] = [
    [30, 40, 160],
    [40, 140, 230],
    [60, 200, 200],
    [120, 210, 80],
    [240, 220, 50],
    [245, 130, 30],
    [200, 30, 30],
  ]
  const f = t * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(f))
  const u = f - i
  return stops[i].map((c, k) => Math.round(c + (stops[i + 1][k] - c) * u)) as [number, number, number]
}

function value(field: Field, x: number, y: number, lg: number) {
  const n = fakeDoping(x, y, lg)
  if (field === 'NetActive') {
    const s = Math.sign(n) * Math.max(0, Math.log10(Math.abs(n) + 1) - 14)
    return { t: 0.5 + s / 12, label: `${n.toExponential(2)} cm⁻³` }
  }
  if (field === 'ElectronDensity') {
    const inv = Math.exp(-y / 0.003) * 1e19 * (Math.abs(x) < lg / 2 ? 1 : 0)
    const e = Math.max(n, 0) + inv + 1e4
    const t = (Math.log10(e) - 4) / 16
    return { t, label: `${e.toExponential(2)} cm⁻³` }
  }
  // fake field peak near drain edge
  const half = lg / 2
  const ef = 6e5 * Math.exp(-(((x - half) / 0.012) ** 2) - (y / 0.01) ** 2) + 5e4 * Math.exp(-y / 0.03)
  return { t: ef / 6.5e5, label: `${ef.toExponential(2)} V/cm` }
}

interface Props {
  lg: number
  tox: number
  expId: number
}

export default function StructureView({ lg, tox, expId }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [field, setField] = useState<Field>('NetActive')
  const [mesh, setMesh] = useState(false)
  const [junction, setJunction] = useState(true)
  const [probe, setProbe] = useState<string>('')

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const W = c.width
    const H = c.height
    const ctx = c.getContext('2d')!
    const img = ctx.createImageData(W, H)
    const toX = (px: number) => X0 + ((X1 - X0) * px) / W
    const toY = (py: number) => Y0 + ((Y1 - Y0) * py) / H
    const toxUm = tox / 1000
    const half = lg / 2
    for (let py = 0; py < H; py++) {
      const y = toY(py)
      for (let px = 0; px < W; px++) {
        const x = toX(px)
        let rgb: [number, number, number]
        if (y >= 0) {
          rgb = rainbow(value(field, x, y, lg).t)
        } else if (y >= -toxUm * 4 && Math.abs(x) < half + 0.02) {
          rgb = [150, 60, 40] // oxide (thickness exaggerated)
        } else if (y >= -toxUm * 4 - 0.07 && Math.abs(x) < half) {
          rgb = [200, 80, 140] // poly gate
        } else if (y >= -toxUm * 4 - 0.07 && Math.abs(x) < half + 0.02) {
          rgb = [210, 200, 150] // nitride spacer
        } else if (y >= -0.004 && Math.abs(x) > half + 0.03) {
          rgb = [170, 170, 170] // contact
        } else {
          rgb = [245, 245, 245]
        }
        const o = (py * W + px) * 4
        img.data[o] = rgb[0]
        img.data[o + 1] = rgb[1]
        img.data[o + 2] = rgb[2]
        img.data[o + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)

    const sx = (x: number) => ((x - X0) / (X1 - X0)) * W
    const sy = (y: number) => ((y - Y0) / (Y1 - Y0)) * H

    if (junction && field === 'NetActive') {
      // draw contour where net doping changes sign
      ctx.fillStyle = '#fff'
      for (let px = 0; px < W; px += 1) {
        let prev = fakeDoping(toX(px), 0, lg)
        for (let py = Math.ceil(sy(0)); py < H; py += 1) {
          const v = fakeDoping(toX(px), toY(py), lg)
          if (Math.sign(v) !== Math.sign(prev)) ctx.fillRect(px, py, 1.5, 1.5)
          prev = v
        }
      }
    }

    if (mesh) {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 0.5
      // dummy triangular mesh, denser near the channel
      const xs: number[] = []
      for (let x = X0; x <= X1 + 1e-9; ) {
        xs.push(x)
        x += Math.abs(x) < half + 0.03 ? 0.004 : 0.012
      }
      const ys: number[] = []
      for (let y = 0; y <= Y1 + 1e-9; ) {
        ys.push(y)
        y += y < 0.02 ? 0.002 + y * 0.2 : 0.012
      }
      ctx.beginPath()
      for (const x of xs) {
        ctx.moveTo(sx(x), sy(0))
        ctx.lineTo(sx(x), sy(Y1))
      }
      for (const y of ys) {
        ctx.moveTo(sx(X0), sy(y))
        ctx.lineTo(sx(X1), sy(y))
      }
      for (let i = 0; i < xs.length - 1; i++)
        for (let j = 0; j < ys.length - 1; j++) {
          ctx.moveTo(sx(xs[i]), sy(ys[j]))
          ctx.lineTo(sx(xs[i + 1]), sy(ys[j + 1]))
        }
      ctx.stroke()
    }

    // labels
    ctx.fillStyle = '#111'
    ctx.font = '12px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText('Gate', sx(0), sy(-0.05))
    ctx.fillText('Source', sx(-0.11), sy(-0.01))
    ctx.fillText('Drain', sx(0.11), sy(-0.01))
    ctx.fillStyle = '#fff'
    ctx.fillText('Substrate', sx(0), sy(0.11))
  }, [lg, tox, field, mesh, junction])

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = X0 + ((X1 - X0) * (e.clientX - r.left)) / r.width
    const y = Y0 + ((Y1 - Y0) * (e.clientY - r.top)) / r.height
    const pos = `x=${(x * 1000).toFixed(1)} nm, y=${(y * 1000).toFixed(1)} nm`
    setProbe(y >= 0 ? `${pos}  ${field}=${value(field, x, y, lg).label}` : `${pos}  (insulator / gate)`)
  }

  const unit = field === 'ElectricField' ? 'V/cm' : 'cm⁻³'
  const ticks =
    field === 'NetActive'
      ? ['-1e20', '-1e17', '0', '1e17', '1e20']
      : field === 'ElectronDensity'
        ? ['1e4', '1e8', '1e12', '1e16', '1e20']
        : ['0', '1.6e5', '3.2e5', '4.9e5', '6.5e5']

  return (
    <div className="structure">
      <div className="structure-bar">
        <strong>n{expId * 10}_proc.tdr</strong>
        <span className="muted">
          Lg = {lg * 1000} nm, Tox = {tox} nm
        </span>
        <label>
          Field
          <select value={field} onChange={(e) => setField(e.target.value as Field)}>
            <option>NetActive</option>
            <option>ElectronDensity</option>
            <option>ElectricField</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={mesh} onChange={(e) => setMesh(e.target.checked)} /> Mesh
        </label>
        <label>
          <input type="checkbox" checked={junction} onChange={(e) => setJunction(e.target.checked)} /> Junction
        </label>
      </div>
      <div className="structure-main">
        <div className="canvas-wrap">
          <canvas ref={canvas} width={720} height={460} onMouseMove={onMove} onMouseLeave={() => setProbe('')} />
          <div className="axis-x">
            <span>-150</span>
            <span>-75</span>
            <span>0</span>
            <span>75</span>
            <span>150 nm</span>
          </div>
        </div>
        <div className="colorbar">
          <div className="cb-title">
            {field}
            <br />
            <small>[{unit}]</small>
          </div>
          <div className="cb-grad" />
          <div className="cb-ticks">
            {[...ticks].reverse().map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="probe">{probe || 'Hover over the structure to probe values'}</div>
    </div>
  )
}
