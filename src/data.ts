// All data in this file is dummy. Nothing here is physically accurate.

export type Status = 'none' | 'queued' | 'running' | 'done' | 'failed'

export type ToolKind = 'process' | 'structure' | 'mesh' | 'device' | 'visual'

export interface ToolStep {
  id: string
  label: string
  kind: ToolKind
  cmdFile: string
  params: { name: string; values: number[]; unit: string }[]
}

export const TOOL_COLORS: Record<ToolKind, string> = {
  process: '#c2410c',
  structure: '#7c3aed',
  mesh: '#0891b2',
  device: '#15803d',
  visual: '#be185d',
}

export const FLOW: ToolStep[] = [
  {
    id: 'proc',
    label: 'ProcSim',
    kind: 'process',
    cmdFile: 'proc_fps.cmd',
    params: [
      { name: 'Lg', values: [0.045, 0.065, 0.09], unit: 'um' },
      { name: 'Tox', values: [1.2, 2.0], unit: 'nm' },
    ],
  },
  { id: 'mesh', label: 'MeshGen', kind: 'mesh', cmdFile: 'mesh_msh.cmd', params: [] },
  {
    id: 'dev',
    label: 'DevSim',
    kind: 'device',
    cmdFile: 'dev_des.cmd',
    params: [{ name: 'Vd', values: [0.05, 1.0], unit: 'V' }],
  },
  { id: 'vis', label: 'Plot', kind: 'visual', cmdFile: 'vis_vsv.tcl', params: [] },
]

export interface Experiment {
  id: number
  values: Record<string, number>
}

export function buildExperiments(flow: ToolStep[]): Experiment[] {
  let rows: Record<string, number>[] = [{}]
  for (const step of flow) {
    for (const p of step.params) {
      rows = rows.flatMap((r) => p.values.map((v) => ({ ...r, [p.name]: v })))
    }
  }
  return rows.map((values, i) => ({ id: i + 1, values }))
}

// ---- Dummy physics ---------------------------------------------------------

/** Fake threshold voltage from gate length and oxide thickness. */
export function fakeVth(lg: number, tox: number) {
  return 0.25 + 0.06 * (tox - 1.2) + 0.9 * (lg - 0.045) - 0.02
}

/** Fake transfer curve Id(Vg) in A/um (smooth subthreshold + saturating). */
export function fakeIdVg(lg: number, tox: number, vd: number, vg: number) {
  const vth = fakeVth(lg, tox) - 0.08 * vd // fake DIBL
  const ss = 0.075 + 0.4 * (0.065 - Math.min(lg, 0.065)) // V/dec
  const n = ss / (Math.LN10 * 0.0259)
  const vov = n * 0.0259 * Math.log(1 + Math.exp((vg - vth) / (n * 0.0259)))
  const k = (2.2e-4 * 0.065) / lg / (tox / 1.2)
  const id = k * vov * vov * (1 - Math.exp(-vd / 0.08)) * (1 + 0.1 * vd)
  return Math.max(id, 1e-13) + 2e-12 * vd
}

export function sweep(from: number, to: number, n: number) {
  return Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1))
}

/** Fake 2D net doping (log10 |N|, signed) for a planar MOSFET cross-section. */
export function fakeDoping(x: number, y: number, lg: number) {
  // x in [-0.15, 0.15] um, y in [0, 0.12] um (depth)
  const half = lg / 2
  const sub = -1e18 // p-type substrate
  const sdPeak = 1e20
  const lateral = (xx: number) => 0.5 * (1 + Math.tanh((xx - half - 0.01) / 0.006))
  const vertical = Math.exp(-((y / 0.03) ** 2))
  const sd = sdPeak * lateral(Math.abs(x)) * vertical
  const ext = 3e19 * Math.exp(-((y / 0.012) ** 2)) * 0.5 * (1 + Math.tanh((Math.abs(x) - half + 0.008) / 0.004))
  const halo = -4e18 * Math.exp(-(((Math.abs(x) - half) / 0.012) ** 2) - ((y - 0.02) / 0.015) ** 2)
  return sub + sd + ext + halo
}

export const CMD_FILES: Record<string, string> = {
  'proc_fps.cmd': `# ---- Process flow (dummy) ----------------------------
math coord.ucs
line x location= 0.0      spacing= 1<nm>   tag= SiTop
line x location= 0.5<um>  spacing= 50<nm>  tag= SiBottom
line y location= 0.0      spacing= 10<nm>  tag= Left
line y location= @Lg@/2+0.1 spacing= 10<nm> tag= Right

region Silicon xlo= SiTop xhi= SiBottom ylo= Left yhi= Right
init concentration= 1e15<cm-3> field= Boron wafer.orient= 100

# Well implant
implant Boron  dose= 2e13<cm-2> energy= 200<keV> tilt= 0 rotation= 0
diffuse temperature= 1050<C> time= 10<s>

# Gate oxide
deposit material= {Oxide} type= isotropic thickness= @Tox@<nm>

# Poly gate
deposit material= {PolySilicon} type= anisotropic thickness= 0.08<um>
mask name= gate_mask left= -1 right= @Lg@/2
etch material= {PolySilicon} type= anisotropic thickness= 0.1<um> mask= gate_mask

# Halo + extension
implant Boron   dose= 5e13<cm-2> energy= 10<keV> tilt= 30 rotation= 0
implant Arsenic dose= 1e15<cm-2> energy= 3<keV>  tilt= 0
diffuse temperature= 1000<C> time= 1<s> ; # spike anneal

# Spacer
deposit material= {Nitride} type= isotropic thickness= 0.02<um>
etch    material= {Nitride} type= anisotropic thickness= 0.025<um>

# Source / Drain
implant Arsenic dose= 4e15<cm-2> energy= 15<keV>
diffuse temperature= 1050<C> time= 0.1<s>

struct tdr= n@node@_proc
exit
`,
  'mesh_msh.cmd': `# ---- Mesh definition (dummy) -------------------------
Definitions {
  Refinement "global" { MaxElementSize = (0.02 0.02) MinElementSize = (0.002 0.002) }
  Refinement "channel" {
    MaxElementSize = (0.002 0.001)
    RefineFunction = MaxTransDiff(Variable = "DopingConcentration", Value = 1)
  }
}
Placements {
  Refinement "global"  { Reference = "global" }
  Refinement "channel" { Reference = "channel"
    RefineWindow = Rectangle [(-@Lg@/2-0.02 0) (@Lg@/2+0.02 0.03)] }
}
`,
  'dev_des.cmd': `# ---- Device simulation (dummy) -----------------------
File {
  Grid    = "n@node|mesh@_msh.tdr"
  Plot    = "n@node@_des.tdr"
  Current = "n@node@_des.plt"
  Output  = "n@node@_des.log"
}
Electrode {
  { Name="source"    Voltage= 0.0 }
  { Name="drain"     Voltage= 0.0 }
  { Name="gate"      Voltage= 0.0 WorkFunction= 4.1 }
  { Name="substrate" Voltage= 0.0 }
}
Physics {
  Mobility( DopingDependence HighFieldSaturation Enormal )
  EffectiveIntrinsicDensity( OldSlotboom )
  Recombination( SRH( DopingDependence ) )
}
Plot { eDensity hDensity ElectricField/Vector Potential SpaceCharge }
Math { Extrapolate Derivatives NewDiscretization Iterations= 20 }

Solve {
  Coupled( Iterations= 100 ) { Poisson }
  Coupled { Poisson Electron }
  Quasistationary( Goal { Name="drain" Voltage= @Vd@ } ) { Coupled { Poisson Electron } }
  Quasistationary( InitialStep= 1e-2 MaxStep= 0.05
    Goal { Name="gate" Voltage= 1.2 } ) { Coupled { Poisson Electron } }
}
`,
  'vis_vsv.tcl': `# ---- Visualization script (dummy) --------------------
set plt n@node|dev@_des.plt
load_file $plt -name IdVg
create_plot -1d -name Plot_IdVg
create_curve -plot Plot_IdVg -dataset IdVg \\
  -axisX "gate OuterVoltage" -axisY "drain TotalCurrent"
set_axis_prop -plot Plot_IdVg -axis y -type log

# Extract
set Vth [ext::ExtractVtgm -out Vtgm -name "Vth" -v $Vgs -i $Ids]
puts "DOE: Vth [format %.4f $Vth]"
`,
}

const LOG_LINES: Record<ToolKind, string[]> = {
  process: [
    'Reading command file proc_fps.cmd',
    'Initializing 1D grid (412 points)',
    'implant: Boron  dose=2.0e13 energy=200 keV  [MC: 50000 particles]',
    'diffuse: T=1050C t=10s  ... step 34/34 converged',
    'deposit Oxide (isotropic)  -> 2D structure generated',
    'etch PolySilicon (anisotropic)  -> boundary updated',
    'implant Arsenic dose=4.0e15 energy=15 keV',
    'diffuse: T=1050C t=0.1s  ... step 12/12 converged',
    'Writing TDR file',
  ],
  structure: ['Building geometry', 'Writing TDR file'],
  mesh: [
    'Reading boundary from TDR',
    'Delaunay triangulation: 18342 vertices, 36011 elements',
    'Refinement by doping gradient: +4219 vertices',
    'Mesh quality: min angle 21.3 deg',
    'Writing mesh TDR file',
  ],
  device: [
    'Loading grid (22561 vertices)',
    'Physics: Mobility(DopingDep HighFieldSat Enormal) SRH',
    'Solve: Coupled { Poisson }  -> converged in 7 iterations',
    'Solve: Coupled { Poisson Electron }  -> converged in 4 iterations',
    'Quasistationary drain ramp ... t=1.0000 done',
    'Quasistationary gate ramp  ... t=0.2500',
    'Quasistationary gate ramp  ... t=0.5000',
    'Quasistationary gate ramp  ... t=0.7500',
    'Quasistationary gate ramp  ... t=1.0000 done',
    'Writing current file (.plt)',
  ],
  visual: ['Loading .plt', 'Creating plot Plot_IdVg', 'Extracting Vth (max-gm method)'],
}

export function fakeLog(kind: ToolKind) {
  return LOG_LINES[kind]
}
