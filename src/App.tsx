import { Fragment, useCallback, useMemo, useRef, useState } from 'react'
import { buildExperiments, FLOW, fakeLog, fakeVth, type Status } from './data'
import Workbench from './components/Workbench'
import StructureView from './components/StructureView'
import CommandEditor from './components/CommandEditor'
import PlotView from './components/PlotView'
import LogConsole, { type LogLine } from './components/LogConsole'
import ProjectTree from './components/ProjectTree'

type Tab = 'workbench' | 'structure' | 'editor' | 'plot'

const TABS: { id: Tab; label: string }[] = [
  { id: 'workbench', label: 'Workbench' },
  { id: 'structure', label: 'Structure' },
  { id: 'editor', label: 'Command File' },
  { id: 'plot', label: 'Visual' },
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const now = () => new Date().toLocaleTimeString('en-GB')
const cellKey = (stepId: string, expId: number) => `${stepId}:${expId}`

export default function App() {
  const experiments = useMemo(() => buildExperiments(FLOW), [])
  const [tab, setTab] = useState<Tab>('workbench')
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [selectedExp, setSelectedExp] = useState(1)
  const [selectedStep, setSelectedStep] = useState(FLOW[0].id)
  const [logs, setLogs] = useState<LogLine[]>([
    { t: now(), level: 'info', text: 'TCAD Studio (dummy) started. Project: mosfet_planar' },
  ])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const cancel = useRef(false)

  const log = useCallback((level: LogLine['level'], text: string) => {
    setLogs((l) => [...l.slice(-400), { t: now(), level, text }])
  }, [])

  const run = useCallback(async () => {
    cancel.current = false
    setRunning(true)
    const queue = experiments.flatMap((e) => FLOW.map((s) => ({ step: s, exp: e })))
    setStatus(Object.fromEntries(queue.map((q) => [cellKey(q.step.id, q.exp.id), 'queued' as Status])))
    log('info', `Submitting ${queue.length} jobs to local queue (4 slots)`)
    let doneCount = 0
    const failedExps = new Set<number>()
    for (const { step, exp } of queue) {
      if (cancel.current) break
      const key = cellKey(step.id, exp.id)
      if (failedExps.has(exp.id)) {
        log('warn', `[n${exp.id}:${step.label}] skipped (upstream node failed)`)
        setStatus((s) => ({ ...s, [key]: 'none' }))
        setProgress(++doneCount / queue.length)
        continue
      }
      setStatus((s) => ({ ...s, [key]: 'running' }))
      log('info', `[n${exp.id}:${step.label}] started`)
      for (const line of fakeLog(step.kind)) {
        if (cancel.current) break
        await sleep(40 + Math.random() * 60)
        log('out', `[n${exp.id}:${step.label}] ${line}`)
      }
      // Dummy failure: one particular combination fails to converge.
      const fail = step.kind === 'device' && exp.values.Lg === 0.045 && exp.values.Tox === 2.0 && exp.values.Vd === 1.0
      if (cancel.current) {
        setStatus((s) => ({ ...s, [key]: 'none' }))
        break
      }
      if (fail) {
        log('error', `[n${exp.id}:${step.label}] Newton iteration did not converge at gate=0.9125V (dummy)`)
        setStatus((s) => ({ ...s, [key]: 'failed' }))
        failedExps.add(exp.id)
      } else {
        if (step.kind === 'visual') {
          const vth = fakeVth(exp.values.Lg, exp.values.Tox) - 0.08 * exp.values.Vd
          log('out', `[n${exp.id}:${step.label}] DOE: Vth ${vth.toFixed(4)}`)
        }
        setStatus((s) => ({ ...s, [key]: 'done' }))
      }
      doneCount++
      setProgress(doneCount / queue.length)
    }
    // Mark anything left in queue as not run.
    setStatus((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v === 'queued' ? 'none' : v])))
    log(cancel.current ? 'warn' : 'info', cancel.current ? 'Run aborted by user' : 'All jobs finished')
    setRunning(false)
  }, [experiments, log])

  const stop = () => {
    cancel.current = true
  }

  const clean = () => {
    setStatus({})
    setProgress(0)
    log('info', 'Cleaned node outputs')
  }

  const exp = experiments.find((e) => e.id === selectedExp) ?? experiments[0]
  const step = FLOW.find((s) => s.id === selectedStep) ?? FLOW[0]
  const finishedExps = experiments.filter((e) => status[cellKey('dev', e.id)] === 'done')

  return (
    <div className="app">
      <header className="menubar">
        <span className="brand">
          <span className="logo">◆</span> TCAD Studio <em>dummy</em>
        </span>
        {['Project', 'Edit', 'Scheme', 'Parameter', 'Experiments', 'Nodes', 'Optimization', 'Tools', 'Help'].map((m) => (
          <button key={m} className="menu">
            {m}
          </button>
        ))}
      </header>

      <div className="toolbar">
        <button className="tb primary" onClick={run} disabled={running}>
          ▶ Run
        </button>
        <button className="tb" onClick={stop} disabled={!running}>
          ■ Abort
        </button>
        <button className="tb" disabled={running} onClick={() => log('info', 'Preprocessing: substituted @Lg@ @Tox@ @Vd@ for 12 nodes')}>
          ⚙ Preprocess
        </button>
        <button className="tb" onClick={clean} disabled={running}>
          ✕ Clean
        </button>
        <span className="sep" />
        <label className="tb-label">
          Queue
          <select>
            <option>local:default (4 slots)</option>
            <option>cluster:slurm-short</option>
          </select>
        </label>
        <div className="progress">
          <div className="bar" style={{ width: `${progress * 100}%` }} />
          <span>{Math.round(progress * 100)}%</span>
        </div>
      </div>

      <div className="main">
        <aside className="sidebar">
          <ProjectTree
            selectedStep={selectedStep}
            onSelectStep={(id) => {
              setSelectedStep(id)
              setTab('editor')
            }}
          />
          <div className="props">
            <h4>Properties</h4>
            <dl>
              <dt>Experiment</dt>
              <dd>#{exp.id}</dd>
              {Object.entries(exp.values).map(([k, v]) => (
                <Fragment key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </Fragment>
              ))}
              <dt>Tool</dt>
              <dd>{step.label}</dd>
              <dt>Status</dt>
              <dd className={`st-${status[cellKey(step.id, exp.id)] ?? 'none'}`}>{status[cellKey(step.id, exp.id)] ?? 'none'}</dd>
            </dl>
          </div>
        </aside>

        <section className="workspace">
          <nav className="tabs">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="tab-body">
            {tab === 'workbench' && (
              <Workbench
                experiments={experiments}
                status={status}
                selectedExp={selectedExp}
                selectedStep={selectedStep}
                onSelect={(e, s) => {
                  setSelectedExp(e)
                  setSelectedStep(s)
                }}
              />
            )}
            {tab === 'structure' && <StructureView lg={exp.values.Lg} tox={exp.values.Tox} expId={exp.id} />}
            {tab === 'editor' && <CommandEditor step={step} exp={exp} />}
            {tab === 'plot' && <PlotView experiments={finishedExps} highlight={selectedExp} />}
          </div>
        </section>
      </div>

      <LogConsole logs={logs} onClear={() => setLogs([])} />

      <footer className="statusbar">
        <span>{running ? 'Running…' : 'Ready'}</span>
        <span>Project: ~/projects/mosfet_planar</span>
        <span>
          Nodes: {Object.values(status).filter((s) => s === 'done').length} done /{' '}
          {Object.values(status).filter((s) => s === 'failed').length} failed / {experiments.length * FLOW.length} total
        </span>
        <span>License: DEMO (no real solver)</span>
      </footer>
    </div>
  )
}
