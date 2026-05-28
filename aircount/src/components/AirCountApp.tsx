import { useEffect, useMemo, useRef, useState } from 'react'

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
  imageUrl,
  onPickFile,
  onClear,
}: {
  imageUrl: string | null
  onPickFile: (file: File) => void
  onClear: () => void
}) {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="UPLOAD"
        right={
          imageUrl ? (
            <button
              type="button"
              className="border border-[var(--ac-border)] px-2 py-1 text-xs text-[var(--ac-text)] hover:border-[var(--ac-accent)]"
              onClick={onClear}
            >
              Clear
            </button>
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
            const file = e.dataTransfer.files?.[0]
            if (!file) return
            if (!/image\/(png|jpeg)/.test(file.type)) return
            onPickFile(file)
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
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              onPickFile(file)
              e.currentTarget.value = ''
            }}
          />

          {imageUrl ? (
            <div className="flex w-full flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-[var(--ac-muted)]">
                <span>Preview</span>
                <span>PNG/JPG</span>
              </div>
              <div className="border border-[var(--ac-border)] bg-black">
                <img
                  src={imageUrl}
                  alt="Uploaded drawing"
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
                Sharp edges, no rounding.
              </div>
            </div>
          )}
        </div>
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

function QuoteTable({ lineItems }: { lineItems: AirCountLineItem[] }) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="QUOTE TABLE"
        right={<Kpi label="Line Items" value={String(lineItems.length)} />}
      />
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse font-[var(--ac-mono)] text-xs">
          <thead className="sticky top-0 bg-[var(--ac-panel)]">
            <tr className="border-b border-[var(--ac-border)] text-left text-[var(--ac-muted)]">
              <th className="px-3 py-2 font-medium tracking-[0.08em]">Symbol Type</th>
              <th className="px-3 py-2 font-medium tracking-[0.08em]">Qty</th>
              <th className="px-3 py-2 font-medium tracking-[0.08em]">Unit</th>
              <th className="px-3 py-2 font-medium tracking-[0.08em]">Spec Section</th>
              <th className="px-3 py-2 font-medium tracking-[0.08em]">
                Line Item Description
              </th>
            </tr>
          </thead>
          <tbody>
            {lineItems.length ? (
              lineItems.map((li, idx) => (
                <tr
                  key={`${li.symbol}-${idx}`}
                  className="border-b border-[rgba(23,50,77,0.55)] hover:bg-[rgba(125,211,252,0.06)]"
                >
                  <td className="px-3 py-2 text-[var(--ac-text)]">{li.symbol}</td>
                  <td className="px-3 py-2 text-[var(--ac-text)]">{li.qty}</td>
                  <td className="px-3 py-2 text-[var(--ac-text)]">{li.unit}</td>
                  <td className="px-3 py-2 text-[var(--ac-text)]">{li.spec}</td>
                  <td className="px-3 py-2 text-[var(--ac-text)]">{li.description}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-4 text-[var(--ac-muted)]" colSpan={5}>
                  No line items.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AirCountApp({
  detections,
  lineItems,
  onRunTakeoff,
  mockMode = false,
  takeoffError = null,
}: AirCountAppProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl)
    }
  }, [imageUrl])

  const topStats = useMemo(() => {
    const det = detections.length
    const items = lineItems.length
    const totalQty = lineItems.reduce((acc, li) => acc + (Number.isFinite(li.qty) ? li.qty : 0), 0)
    return { det, items, totalQty }
  }, [detections, lineItems])

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex items-center justify-between border-b border-[var(--ac-border)] bg-[var(--ac-header)] px-4 py-3">
        <div className="flex items-baseline gap-3">
          <div className="text-sm font-semibold tracking-[0.22em]">AIRCOUNT</div>
          <div className="text-xs text-[var(--ac-muted)]">
            Single-page takeoff workspace
          </div>
          {mockMode ? (
            <div className="border border-[var(--ac-border)] px-2 py-1 text-[10px] tracking-[0.18em] text-[var(--ac-muted)]">
              MOCK MODE
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-4 md:flex">
            <Kpi label="Detections" value={String(topStats.det)} />
            <Kpi label="Items" value={String(topStats.items)} />
            <Kpi label="Total Qty" value={String(topStats.totalQty)} />
          </div>

          <button
            type="button"
            disabled={running || !imageFile}
            className={[
              'border border-[var(--ac-border)] bg-[rgba(125,211,252,0.08)] px-3 py-2 text-xs font-medium tracking-[0.12em] text-[var(--ac-text)]',
              running || !imageFile ? 'opacity-60' : 'hover:border-[var(--ac-accent)]',
            ].join(' ')}
            onClick={async () => {
              if (!imageFile) return
              try {
                setRunning(true)
                await onRunTakeoff(imageFile)
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
            imageUrl={imageUrl}
            onPickFile={(file) => {
              if (imageUrl) URL.revokeObjectURL(imageUrl)
              setImageFile(file)
              setImageUrl(URL.createObjectURL(file))
            }}
            onClear={() => {
              if (imageUrl) URL.revokeObjectURL(imageUrl)
              setImageUrl(null)
              setImageFile(null)
            }}
          />
        </section>

        <section className="min-h-0 border-r border-[var(--ac-border)] bg-[var(--ac-panel)]">
          <DetectionPanel imageUrl={imageUrl} detections={detections} />
        </section>

        <section className="min-h-0 bg-[var(--ac-panel)]">
          <QuoteTable lineItems={lineItems} />
        </section>
      </main>
    </div>
  )
}

