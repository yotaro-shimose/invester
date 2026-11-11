import { useEffect, useState } from 'react'
import { CMD_FILES, type Experiment, type ToolStep } from '../data'

interface Props {
  step: ToolStep
  exp: Experiment
}

export default function CommandEditor({ step, exp }: Props) {
  const [text, setText] = useState(CMD_FILES[step.cmdFile])
  const [preview, setPreview] = useState(false)
  useEffect(() => setText(CMD_FILES[step.cmdFile]), [step.cmdFile])

  const shown = preview
    ? text
        .replace(/@node(\|\w+)?@/g, String(exp.id * 10))
        .replace(/@(\w+)@/g, (m, name) => (name in exp.values ? String(exp.values[name]) : m))
    : text
  const lines = shown.split('\n')

  return (
    <div className="editor">
      <div className="editor-bar">
        <strong>{step.cmdFile}</strong>
        <label>
          <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} /> Preprocessed view
          (experiment #{exp.id})
        </label>
      </div>
      <div className="code">
        <pre className="gutter">{lines.map((_, i) => i + 1).join('\n')}</pre>
        {preview ? (
          <pre className="src">{highlight(shown)}</pre>
        ) : (
          <textarea spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
        )}
      </div>
    </div>
  )
}

function highlight(src: string) {
  return src.split('\n').map((line, i) => {
    if (line.trimStart().startsWith('#'))
      return (
        <div key={i} className="hl-comment">
          {line || ' '}
        </div>
      )
    const parts = line.split(/(\b(?:implant|diffuse|deposit|etch|mask|struct|region|init|line|Solve|Physics|Electrode|File|Math|Plot|Coupled|Quasistationary)\b|\d+(?:\.\d+)?(?:e[-+]?\d+)?)/)
    return (
      <div key={i}>
        {parts.map((p, j) =>
          j % 2 === 1 ? (
            <span key={j} className={/^\d/.test(p) ? 'hl-num' : 'hl-kw'}>
              {p}
            </span>
          ) : (
            p
          ),
        )}
        {line === '' && ' '}
      </div>
    )
  })
}
