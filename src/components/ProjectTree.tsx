import { FLOW, TOOL_COLORS } from '../data'

interface Props {
  selectedStep: string
  onSelectStep: (id: string) => void
}

export default function ProjectTree({ selectedStep, onSelectStep }: Props) {
  return (
    <div className="tree">
      <h4>Projects</h4>
      <ul>
        <li className="folder open">
          ▾ mosfet_planar
          <ul>
            {FLOW.map((s) => (
              <li
                key={s.id}
                className={s.id === selectedStep ? 'leaf active' : 'leaf'}
                onClick={() => onSelectStep(s.id)}
              >
                <span className="dot" style={{ background: TOOL_COLORS[s.kind] }} />
                {s.cmdFile}
              </li>
            ))}
            <li className="leaf muted">gtree.dat</li>
            <li className="leaf muted">models.par</li>
          </ul>
        </li>
        <li className="folder">▸ finfet_3d</li>
        <li className="folder">▸ sic_mosfet_power</li>
        <li className="folder">▸ diode_breakdown</li>
      </ul>
    </div>
  )
}
