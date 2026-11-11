import { FLOW, TOOL_COLORS, fakeVth, type Experiment, type Status } from '../data'

const key = (s: string, e: number) => `${s}:${e}`

interface Props {
  experiments: Experiment[]
  status: Record<string, Status>
  selectedExp: number
  selectedStep: string
  onSelect: (expId: number, stepId: string) => void
}

export default function Workbench({ experiments, status, selectedExp, selectedStep, onSelect }: Props) {
  return (
    <div className="workbench">
      <table className="flow">
        <thead>
          <tr className="tool-row">
            {FLOW.map((s) => (
              <th key={s.id} colSpan={Math.max(1, s.params.length)} style={{ borderTopColor: TOOL_COLORS[s.kind] }}>
                <span className="tool-icon" style={{ background: TOOL_COLORS[s.kind] }}>
                  {s.label[0]}
                </span>
                {s.label}
              </th>
            ))}
            <th className="extract" rowSpan={2}>
              Vth [V]
            </th>
          </tr>
          <tr className="param-row">
            {FLOW.flatMap((s) =>
              s.params.length
                ? s.params.map((p) => (
                    <th key={s.id + p.name}>
                      {p.name} <small>[{p.unit}]</small>
                    </th>
                  ))
                : [<th key={s.id + '-'} className="noparam">—</th>],
            )}
          </tr>
        </thead>
        <tbody>
          {experiments.map((e) => {
            const vis = status[key('vis', e.id)]
            const vth = fakeVth(e.values.Lg, e.values.Tox) - 0.08 * e.values.Vd
            return (
              <tr key={e.id} className={e.id === selectedExp ? 'sel' : ''}>
                {FLOW.flatMap((s) => {
                  const st = status[key(s.id, e.id)] ?? 'none'
                  const cells = s.params.length ? s.params : [null]
                  return cells.map((p, i) => (
                    <td
                      key={s.id + i}
                      className={`cell st-${st} ${e.id === selectedExp && s.id === selectedStep ? 'focus' : ''}`}
                      onClick={() => onSelect(e.id, s.id)}
                      title={`n${e.id}:${s.label} — ${st}`}
                    >
                      {i === 0 && <span className="node">n{e.id * 10 + FLOW.indexOf(s)}</span>}
                      {p ? e.values[p.name] : ''}
                    </td>
                  ))
                })}
                <td className="extract">{vis === 'done' ? vth.toFixed(4) : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="legend">
        {(['none', 'queued', 'running', 'done', 'failed'] as Status[]).map((s) => (
          <span key={s}>
            <i className={`sw st-${s}`} /> {s}
          </span>
        ))}
      </div>
    </div>
  )
}
