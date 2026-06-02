import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ROBOFLOW_MODELS,
  SYMBOL_DESCRIPTIONS,
  SYMBOL_TAGS,
  type RoboflowModelId,
  type SymbolTag,
} from '../api/takeoff'

export type AirCountDetection = {
  label: string
  confidence: number
  x: number
  y: number
  width: number
  height: number
}

export type AirCountLineItem = {
  symbol: string
  qty: number
  unit: string
  spec: string
  description: string
}

export type AirCountAppProps = {
  detections: AirCountDetection[]
  lineItems: AirCountLineItem[]
  qtyByTag: Record<SymbolTag, number>
  rawClassCounts: Record<string, number>
  modelId: RoboflowModelId
  onModelChange: (id: RoboflowModelId) => void
  onRunTakeoff: (imageFile: File) => Promise<void>
  mockMode?: boolean
  takeoffError?: string | null
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function asPx(value: number, size: number) {
  return value <= 1 ? value * size : value
}

function PanelHeader({
  title,
  right,
}: {
  title: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--ac-border)] px-3 py-2">
      <div className="text-xs tracking-[0.18em] text-[var(--ac-muted)]">{title}</div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-[var(--ac-muted)]">{label}</span>
      <span className="font-medium text-[var(--ac-text)]">{value}</span>
    </div>
  )
}

function UploadPanel({
  files,
  selectedId,
  onAddFiles,
  onSelect,
  onRemove,
  onClearAll,
}: {
  files: Array<{ id: string; name: string; url: string }>
  selectedId: string | null
  onAddFiles: (files: File[]) => void
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onClearAll: () => void
}) {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const selected = files.find((f) => f.id === selectedId) ?? null

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="UPLOAD"
        right={
          files.length ? (
            <div className="flex items-center gap-2">
              <div className="text-[10px] tracking-[0.18em] text-[var(--ac-muted)]">
                {files.length} FILES
              </div>
              <button
                type="button"
                className="border border-[var(--ac-border)] px-2 py-1 text-xs text-[var(--ac-text)] hover:border-[var(--ac-accent)]"
                onClick={onClearAll}
              >
                Clear All
              </button>
            </div>
          ) : null
        }
      />
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div
          className={[
            'relative flex flex-1 items-center justify-center border border-dashed border-[var(--ac-border)] bg-[var(--ac-subpanel)]',
            dragActive ? 'border-[var(--ac-accent)]' : '',
          ].join(' ')}
          onDragEnter={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDragActive(true)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDragActive(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDragActive(false)
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDragActive(false)
            const dropped = Array.from(e.dataTransfer.files ?? []).filter((f) =>
              /image\/(png|jpeg)/.test(f.type),
            )
            if (!dropped.length) return
            onAddFiles(dropped)
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []).filter((f) =>
                /image\/(png|jpeg)/.test(f.type),
              )
              if (!picked.length) return
              onAddFiles(picked)
              e.currentTarget.value = ''
            }}
          />

          {selected ? (
            <div className="flex w-full flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-[var(--ac-muted)]">
                <span>Active</span>
                <span>PNG/JPG</span>
              </div>
              <div className="border border-[var(--ac-border)] bg-black">
                <img
                  src={selected.url}
                  alt={selected.name}
                  className="block h-[240px] w-full object-contain"
                  draggable={false}
                />
              </div>
            </div>
          ) : (
            <div className="flex max-w-[22rem] flex-col gap-2 text-left">
              <div className="text-sm font-medium text-[var(--ac-text)]">
                Drop a drawing here
              </div>
              <div className="text-xs text-[var(--ac-muted)]">
                Drag and drop a <span className="text-[var(--ac-text)]">PNG</span> or{' '}
                <span className="text-[var(--ac-text)]">JPG</span>, or click to select.
              </div>
              <div className="mt-2 inline-flex items-center gap-2 text-xs text-[var(--ac-muted)]">
                <span className="h-2 w-2 border border-[var(--ac-border)]" />
              </div>
            </div>
          )}
        </div>

        {files.length ? (
          <div className="border border-[var(--ac-border)] bg-[var(--ac-subpanel)]">
            <div className="grid grid-cols-3 gap-2 p-2">
              {files.map((f) => {
                const isActive = f.id === selectedId
                return (
                  <button
                    key={f.id}
                    type="button"
                    className={[
                      'group relative border border-[var(--ac-border)] bg-white p-1 text-left',
                      isActive ? 'border-[var(--ac-accent)]' : 'hover:border-[var(--ac-accent)]',
                    ].join(' ')}
                    onClick={() => onSelect(f.id)}
                    title={f.name}
                  >
                    <img
                      src={f.url}
                      alt={f.name}
                      className="block h-16 w-full object-contain"
                      draggable={false}
                    />
                    <div className="mt-1 truncate font-[var(--ac-mono)] text-[10px] text-[var(--ac-muted)]">
                      {f.name}
                    </div>
                    <div className="absolute right-1 top-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        className="border border-[var(--ac-border)] bg-[var(--ac-header)] px-1 py-0.5 text-[10px] text-[var(--ac-text)] hover:border-[var(--ac-danger)]"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          onRemove(f.id)
                        }}
                      >
                        X
                      </button>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function DetectionPanel({
  imageUrl,
  detections,
}: {
  imageUrl: string | null
  detections: AirCountDetection[]
}) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [imgReady, setImgReady] = useState(false)

  const draw = () => {
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = img.getBoundingClientRect()
    const w = Math.max(1, Math.floor(rect.width))
    const h = Math.max(1, Math.floor(rect.height))
    canvas.width = w
    canvas.height = h
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    ctx.clearRect(0, 0, w, h)
    ctx.lineWidth = 2
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
    ctx.textBaseline = 'top'

    for (const d of detections) {
      const x = asPx(d.x, w)
      const y = asPx(d.y, h)
      const bw = asPx(d.width, w)
      const bh = asPx(d.height, h)
      if (bw <= 1 || bh <= 1) continue

      const nx = clamp(x, 0, w)
      const ny = clamp(y, 0, h)
      const nbw = clamp(bw, 0, w - nx)
      const nbh = clamp(bh, 0, h - ny)

      // box
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.95)'
      ctx.strokeRect(nx, ny, nbw, nbh)

      // label plate
      const tag = `${d.label} ${(d.confidence * 100).toFixed(0)}%`
      const padX = 6
      const padY = 3
      const textW = ctx.measureText(tag).width
      const plateW = Math.ceil(textW + padX * 2)
      const plateH = 18

      ctx.fillStyle = 'rgba(7, 20, 38, 0.92)'
      ctx.fillRect(nx, Math.max(0, ny - plateH), plateW, plateH)
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.85)'
      ctx.strokeRect(nx, Math.max(0, ny - plateH), plateW, plateH)

      ctx.fillStyle = 'rgba(211, 221, 233, 0.95)'
      ctx.fillText(tag, nx + padX, Math.max(0, ny - plateH) + padY)
    }
  }

  useEffect(() => {
    if (!imgReady) return
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgReady, detections])

  useEffect(() => {
    if (!imgRef.current) return
    const img = imgRef.current
    const ro = new ResizeObserver(() => draw())
    ro.observe(img)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, imgReady])

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="DETECTIONS"
        right={<Kpi label="Boxes" value={String(detections.length)} />}
      />

      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="relative flex flex-1 items-center justify-center border border-[var(--ac-border)] bg-black">
          {imageUrl ? (
            <>
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Drawing with detections"
                className="block max-h-full max-w-full object-contain"
                onLoad={() => setImgReady(true)}
                draggable={false}
              />
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              />
            </>
          ) : (
            <div className="text-xs text-[var(--ac-muted)]">
              Upload a drawing to view detection overlays.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border border-[var(--ac-border)] bg-[var(--ac-subpanel)] px-3 py-2 text-xs">
          <span className="text-[var(--ac-muted)]">
            Box coordinates accept normalized \([0..1]\) or pixel values.
          </span>
          <span className="text-[var(--ac-muted)]">
            Render: <span className="text-[var(--ac-text)]">canvas overlay</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function QuoteTable({
  lineItems,
  qtyByTag,
  rawClassCounts,
}: {
  lineItems: AirCountLineItem[]
  qtyByTag: Record<SymbolTag, number>
  rawClassCounts: Record<string, number>
}) {
  const rows = useMemo(() => {
    return SYMBOL_TAGS.map((tag) => ({
      tag,
      description: SYMBOL_DESCRIPTIONS[tag],
      qty: qtyByTag[tag] ?? 0,
      unit: 'EA' as const,
    }))
  }, [qtyByTag])

  const rawClassSummary = useMemo(
    () =>
      Object.entries(rawClassCounts)
        .map(([cls, n]) => `${cls} (${n})`)
        .join(', '),
    [rawClassCounts],
  )

  const totalQty = useMemo(() => rows.reduce((acc, r) => acc + r.qty, 0), [rows])

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="QUOTE TABLE"
        right={<Kpi label="Total Qty" value={String(totalQty)} />}
      />
      <div className="flex-1 overflow-auto">
        {lineItems.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center font-[var(--ac-mono)] text-xs text-[var(--ac-muted)]">
            Run takeoff to generate quote
          </div>
        ) : (
          <table className="w-full border-collapse font-[var(--ac-mono)] text-xs">
            <thead className="sticky top-0 bg-[var(--ac-panel)]">
              <tr className="border-b border-[var(--ac-border)] text-left text-[var(--ac-muted)]">
                <th className="px-3 py-2 font-medium tracking-[0.08em]">Tag</th>
                <th className="px-3 py-2 font-medium tracking-[0.08em]">Description</th>
                <th className="px-3 py-2 font-medium tracking-[0.08em]">Qty</th>
                <th className="px-3 py-2 font-medium tracking-[0.08em]">Unit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={r.tag}
                  className={[
                    'ac-row-in border-b border-[rgba(11,23,38,0.12)]',
                    idx % 2 === 0 ? 'bg-white' : 'bg-[rgba(14,165,233,0.035)]',
                  ].join(' ')}
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <td className="px-3 py-2 text-[var(--ac-text)]">{r.tag}</td>
                  <td className="px-3 py-2 text-[var(--ac-text)]">{r.description}</td>
                  <td className="px-3 py-2 text-[var(--ac-text)]">{r.qty}</td>
                  <td className="px-3 py-2 text-[var(--ac-text)]">{r.unit}</td>
                </tr>
              ))}

              <tr
                className="ac-row-in border-t-2 border-[var(--ac-text)] bg-white font-semibold"
                style={{ animationDelay: `${rows.length * 100}ms` }}
              >
                <td className="px-3 py-2 text-[var(--ac-text)]">TOTAL DEVICES</td>
                <td className="px-3 py-2 text-[var(--ac-text)]"></td>
                <td className="px-3 py-2 text-[var(--ac-text)]">{totalQty}</td>
                <td className="px-3 py-2 text-[var(--ac-text)]">EA</td>
              </tr>
            </tbody>
          </table>
        )}
        {lineItems.length > 0 && rawClassSummary ? (
          <div className="border-t border-[var(--ac-border)] px-3 py-2 font-[var(--ac-mono)] text-[10px] text-[var(--ac-muted)]">
            Roboflow classes: {rawClassSummary}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ModelToggle({
  modelId,
  onModelChange,
}: {
  modelId: RoboflowModelId
  onModelChange: (id: RoboflowModelId) => void
}) {
  const options: RoboflowModelId[] = ['production', 'experimental']

  return (
    <div className="flex border border-[var(--ac-border)]">
      {options.map((id) => {
        const active = modelId === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onModelChange(id)}
            className={[
              'px-2 py-2 text-xs font-medium tracking-[0.08em]',
              active
                ? 'bg-[rgba(14,165,233,0.12)] text-[var(--ac-text)]'
                : 'bg-white text-[var(--ac-muted)] hover:text-[var(--ac-text)]',
            ].join(' ')}
          >
            {ROBOFLOW_MODELS[id].label}
          </button>
        )
      })}
    </div>
  )
}

export default function AirCountApp({
  detections,
  lineItems,
  qtyByTag,
  rawClassCounts,
  modelId,
  onModelChange,
  onRunTakeoff,
  mockMode = false,
  takeoffError = null,
}: AirCountAppProps) {
  const [uploads, setUploads] = useState<Array<{ id: string; file: File; url: string }>>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    return () => {
      for (const u of uploads) URL.revokeObjectURL(u.url)
    }
  }, [uploads])

  const selectedUpload = uploads.find((u) => u.id === selectedId) ?? uploads[uploads.length - 1] ?? null
  const activeFile = selectedUpload?.file ?? null
  const activeUrl = selectedUpload?.url ?? null

  const topStats = useMemo(() => {
    const det = detections.length
    const items = lineItems.length
    const totalQty = SYMBOL_TAGS.reduce((acc, tag) => acc + (qtyByTag[tag] ?? 0), 0)
    return { det, items, totalQty }
  }, [detections, lineItems, qtyByTag])

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex items-center justify-between border-b border-[var(--ac-border)] bg-[var(--ac-header)] px-4 py-3">
        <div className="flex items-baseline gap-3">
          <div className="text-sm font-semibold tracking-[0.22em]">AIRCOUNT</div>
          {mockMode ? (
            <div className="border border-[var(--ac-border)] px-2 py-1 text-[10px] tracking-[0.18em] text-[var(--ac-muted)]">
              MOCK MODE
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-4 md:flex">
            <Kpi label="Model" value={ROBOFLOW_MODELS[modelId].label} />
            <Kpi label="Detections" value={String(topStats.det)} />
            <Kpi label="Items" value={String(topStats.items)} />
            <Kpi label="Total Qty" value={String(topStats.totalQty)} />
          </div>

          <ModelToggle modelId={modelId} onModelChange={onModelChange} />

          <button
            type="button"
            disabled={running || !activeFile}
            className={[
              'border border-[var(--ac-border)] bg-[rgba(125,211,252,0.08)] px-3 py-2 text-xs font-medium tracking-[0.12em] text-[var(--ac-text)]',
              running || !activeFile ? 'opacity-60' : 'hover:border-[var(--ac-accent)]',
            ].join(' ')}
            onClick={async () => {
              if (!activeFile) return
              try {
                setRunning(true)
                await onRunTakeoff(activeFile)
              } finally {
                setRunning(false)
              }
            }}
          >
            {running ? 'Running…' : 'Run Takeoff'}
          </button>
        </div>
      </header>

      {takeoffError ? (
        <div className="border-b border-[var(--ac-danger)] bg-[rgba(251,113,133,0.12)] px-4 py-2 text-xs text-[var(--ac-danger)]">
          {takeoffError}
        </div>
      ) : null}

      <main className="grid h-full flex-1 grid-cols-1 gap-0 md:grid-cols-3">
        <section className="min-h-0 border-r border-[var(--ac-border)] bg-[var(--ac-panel)]">
          <UploadPanel
            files={uploads.map((u) => ({ id: u.id, name: u.file.name, url: u.url }))}
            selectedId={selectedUpload?.id ?? null}
            onAddFiles={(files) => {
              const next = files.map((file) => ({
                id: `${crypto.randomUUID?.() ?? String(Date.now())}-${file.name}`,
                file,
                url: URL.createObjectURL(file),
              }))
              setUploads((prev) => [...prev, ...next])
              const last = next[next.length - 1]
              if (last) setSelectedId(last.id)
            }}
            onSelect={(id) => setSelectedId(id)}
            onRemove={(id) => {
              setUploads((prev) => {
                const victim = prev.find((p) => p.id === id)
                if (victim) URL.revokeObjectURL(victim.url)
                const next = prev.filter((p) => p.id !== id)
                const nextSelected =
                  selectedId === id ? (next[next.length - 1]?.id ?? null) : selectedId
                setSelectedId(nextSelected)
                return next
              })
            }}
            onClearAll={() => {
              for (const u of uploads) URL.revokeObjectURL(u.url)
              setUploads([])
              setSelectedId(null)
            }}
          />
        </section>

        <section className="min-h-0 border-r border-[var(--ac-border)] bg-[var(--ac-panel)]">
          <DetectionPanel imageUrl={activeUrl} detections={detections} />
        </section>

        <section className="min-h-0 bg-[var(--ac-panel)]">
          <QuoteTable
            lineItems={lineItems}
            qtyByTag={qtyByTag}
            rawClassCounts={rawClassCounts}
          />
        </section>
      </main>
    </div>
  )
}

