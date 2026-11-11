import { useEffect, useRef } from 'react'

export interface LogLine {
  t: string
  level: 'info' | 'out' | 'warn' | 'error'
  text: string
}

export default function LogConsole({ logs, onClear }: { logs: LogLine[]; onClear: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight })
  }, [logs])
  return (
    <div className="console">
      <div className="console-bar">
        <span>Output</span>
        <button onClick={onClear}>Clear</button>
      </div>
      <div className="console-body" ref={ref}>
        {logs.map((l, i) => (
          <div key={i} className={`log-${l.level}`}>
            <span className="ts">{l.t}</span> {l.text}
          </div>
        ))}
      </div>
    </div>
  )
}
