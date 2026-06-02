export const SYMBOL_DESCRIPTIONS = {
  'SD-1': 'Supply Air Diffuser 1, 10" Ceiling, 300 CFM',
  'RG-1': 'Return Air Grille, 10" Ceiling',
  'EG-2': 'Exhaust Air Grille 1, Ceiling, 800 CFM',
  'SR-1': 'Supply Air Register, Wall, 45 deg Branch Duct',
} as const

export type SymbolTag = keyof typeof SYMBOL_DESCRIPTIONS

export const SYMBOL_TAGS: SymbolTag[] = ['SD-1', 'RG-1', 'EG-2', 'SR-1']

/** Roboflow / LLM class strings that map to a quote-table tag (keys are canonicalized) */
const SYMBOL_ALIASES: Record<string, SymbolTag> = {
  CSD: 'SD-1',
  'CSD-1': 'SD-1',
  CSD1: 'SD-1',
  SD: 'SD-1',
  'SD-1': 'SD-1',
  SD1: 'SD-1',
  'SD 1': 'SD-1',
  SUPPLY: 'SD-1',
  SUPPLYAIRDIFFUSER: 'SD-1',
  SUPPLYDIFFUSER: 'SD-1',
  DIFFUSER: 'SD-1',
  RG: 'RG-1',
  'RG-1': 'RG-1',
  RG1: 'RG-1',
  'RG 1': 'RG-1',
  RETURN: 'RG-1',
  RETURNAIRGRILLE: 'RG-1',
  GRILLE: 'RG-1',
  EG: 'EG-2',
  'EG-2': 'EG-2',
  EG2: 'EG-2',
  'EG 2': 'EG-2',
  EXHAUST: 'EG-2',
  SR: 'SR-1',
  'SR-1': 'SR-1',
  SR1: 'SR-1',
  'SR 1': 'SR-1',
  REGISTER: 'SR-1',
}

function canonicalizeClassKey(raw: string): string {
  return raw
    .trim()
    .replace(/[\u2010-\u2015–—]/g, '-')
    .replace(/_/g, '-')
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

function compactClassKey(raw: string): string {
  return canonicalizeClassKey(raw).replace(/[\s-]/g, '')
}

export function normalizeSymbolTag(raw: string): SymbolTag | null {
  if (!raw?.trim()) return null

  const canonical = canonicalizeClassKey(raw)
  const compact = compactClassKey(raw)

  for (const tag of SYMBOL_TAGS) {
    if (canonicalizeClassKey(tag) === canonical) return tag
    if (compactClassKey(tag) === compact) return tag
  }

  if (canonical in SYMBOL_ALIASES) return SYMBOL_ALIASES[canonical]
  if (compact in SYMBOL_ALIASES) return SYMBOL_ALIASES[compact]

  // Fuzzy fallbacks for Roboflow labels that don't match drawing notation exactly
  if (
    compact.includes('CSD') ||
    compact.startsWith('SD') ||
    canonical.includes('DIFFUSER') ||
    canonical.includes('SUPPLY')
  ) {
    return 'SD-1'
  }
  if (compact.startsWith('RG') || canonical.includes('RETURN') || canonical.includes('GRILLE')) {
    return 'RG-1'
  }
  if (compact.startsWith('EG') || canonical.includes('EXHAUST')) {
    return 'EG-2'
  }
  if (compact.startsWith('SR') || canonical.includes('REGISTER')) {
    return 'SR-1'
  }

  return null
}

function getPredictionClassName(raw: Record<string, unknown>): string {
  const name = raw.class ?? raw.class_name ?? raw.name
  if (typeof name === 'string' && name.trim()) return name.trim()
  if (typeof raw.class_id === 'number') return `class_${raw.class_id}`
  return 'unknown'
}

function parseRoboflowPrediction(raw: Record<string, unknown>): RoboflowPrediction {
  return {
    class: getPredictionClassName(raw),
    confidence: Number(raw.confidence ?? 0),
    x: Number(raw.x ?? 0),
    y: Number(raw.y ?? 0),
    width: Number(raw.width ?? 0),
    height: Number(raw.height ?? 0),
  }
}

export function quoteQtyByTagFromCounts(
  counts: Record<string, number>,
): Record<SymbolTag, number> {
  const qty = Object.fromEntries(SYMBOL_TAGS.map((t) => [t, 0])) as Record<SymbolTag, number>
  for (const [cls, n] of Object.entries(counts)) {
    const tag = normalizeSymbolTag(cls)
    if (tag && Number.isFinite(n)) qty[tag] += n
  }
  return qty
}

export function quoteQtyByTagFromDetections(
  detections: Array<{ label: string }>,
): Record<SymbolTag, number> {
  const counts: Record<string, number> = {}
  for (const d of detections) {
    counts[d.label] = (counts[d.label] ?? 0) + 1
  }
  return quoteQtyByTagFromCounts(counts)
}

export type RoboflowModelId = 'production' | 'experimental'

export const ROBOFLOW_MODELS: Record<
  RoboflowModelId,
  { path: string; label: string }
> = {
  production: {
    path: '/hvac-mechanical-2/2',
    label: 'v2',
  },
  experimental: {
    path: '/hvac-mechanical-2/3',
    label: 'v3 (exp)',
  },
}

const CLAUDE_PATH = '/v1/messages'
const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

const GROQ_PATH = '/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

const CLAUDE_SYSTEM_PROMPT = `You are an HVAC takeoff assistant. Convert detected HVAC symbols 
into contractor quote line items. Return ONLY a valid JSON array, 
no explanation, no markdown.

Symbol mapping:
- SD-1 → Supply Air Diffuser 1, 10" Ceiling, 300 CFM
- RG-1 → Return Air Grille, 10" Ceiling
- EG-2 → Exhaust Air Grille 1, Ceiling, 800 CFM
- SR-1 → Supply Air Register, Wall, 45 deg Branch Duct

Output format:
[{
  symbol: string,
  description: string,
  quantity: number,
  unit: 'EA',
  spec: string
}]`

export type TakeoffPrediction = {
  class: string
  confidence: number
  x: number
  y: number
  width: number
  height: number
}

export type TakeoffLineItem = {
  symbol: string
  description: string
  quantity: number
  unit: string
  spec: string
}

type LlmProvider = 'anthropic' | 'groq'

type RoboflowPrediction = {
  class: string
  confidence: number
  x: number
  y: number
  width: number
  height: number
}

type RoboflowResponse = {
  predictions?: RoboflowPrediction[]
  image?: { width?: number; height?: number }
}

type ClaudeLineItem = {
  symbol: string
  description: string
  quantity: number
  unit: string
  spec: string
}

async function fileToBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
  const comma = dataUrl.indexOf(',')
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
}

function countByClass(predictions: RoboflowPrediction[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of predictions) {
    counts[p.class] = (counts[p.class] ?? 0) + 1
  }
  return counts
}

function toTopLeftBox(
  pred: RoboflowPrediction,
  imageWidth?: number,
  imageHeight?: number,
): TakeoffPrediction {
  const left = pred.x - pred.width / 2
  const top = pred.y - pred.height / 2

  if (imageWidth && imageHeight && imageWidth > 0 && imageHeight > 0) {
    return {
      class: pred.class,
      confidence: pred.confidence,
      x: left / imageWidth,
      y: top / imageHeight,
      width: pred.width / imageWidth,
      height: pred.height / imageHeight,
    }
  }

  return {
    class: pred.class,
    confidence: pred.confidence,
    x: left,
    y: top,
    width: pred.width,
    height: pred.height,
  }
}

async function detectWithRoboflow(
  base64: string,
  modelId: RoboflowModelId,
): Promise<RoboflowResponse> {
  const apiKey = import.meta.env.VITE_ROBOFLOW_API_KEY
  if (!apiKey) {
    throw new Error('Missing VITE_ROBOFLOW_API_KEY — add it to your .env file')
  }

  const { path } = ROBOFLOW_MODELS[modelId]
  const baseUrl = import.meta.env.DEV
    ? `/api/roboflow${path}`
    : `https://serverless.roboflow.com${path}`

  // Roboflow serverless expects the api_key as a query param (like axios `params`)
  // and the base64 image in the POST body with x-www-form-urlencoded content-type.
  const url = `${baseUrl}?api_key=${encodeURIComponent(apiKey)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: base64,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Roboflow request failed (${res.status}): ${detail || res.statusText}`)
  }

  const data = (await res.json()) as RoboflowResponse & {
    predictions?: Array<Record<string, unknown>>
  }

  return {
    ...data,
    predictions: (data.predictions ?? []).map((p) => parseRoboflowPrediction(p)),
  }
}

function parseClaudeJsonArray(text: string): ClaudeLineItem[] {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() ?? trimmed
  const arrayMatch = candidate.match(/\[[\s\S]*\]/)
  if (!arrayMatch) {
    throw new Error('Claude response did not contain a JSON array')
  }
  const parsed = JSON.parse(arrayMatch[0]) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('Claude response JSON was not an array')
  }
  return parsed as ClaudeLineItem[]
}

function getLlmProvider(): LlmProvider {
  const raw = (import.meta.env.VITE_LLM_PROVIDER ?? 'anthropic').toLowerCase()
  if (raw === 'groq') return 'groq'
  return 'anthropic'
}

async function quoteWithClaude(symbolCounts: Record<string, number>): Promise<TakeoffLineItem[]> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('Missing VITE_ANTHROPIC_API_KEY — add it to your .env file')
  }

  const url = import.meta.env.DEV
    ? `/api/anthropic${CLAUDE_PATH}`
    : `https://api.anthropic.com${CLAUDE_PATH}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: CLAUDE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Detected symbol counts:\n${JSON.stringify(symbolCounts, null, 2)}`,
        },
      ],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Claude request failed (${res.status}): ${detail || res.statusText}`)
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>
  }

  const text = data.content?.find((block) => block.type === 'text')?.text
  if (!text) {
    throw new Error('Claude response did not include text content')
  }

  return parseClaudeJsonArray(text)
}

async function quoteWithGroq(symbolCounts: Record<string, number>): Promise<TakeoffLineItem[]> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) {
    throw new Error('Missing VITE_GROQ_API_KEY — add it to your .env file')
  }

  const url = import.meta.env.DEV ? `/api/groq${GROQ_PATH}` : `https://api.groq.com${GROQ_PATH}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      messages: [
        { role: 'system', content: CLAUDE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Detected symbol counts:\n${JSON.stringify(symbolCounts, null, 2)}`,
        },
      ],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Groq request failed (${res.status}): ${detail || res.statusText}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const text = data.choices?.[0]?.message?.content
  if (!text) {
    throw new Error('Groq response did not include message content')
  }

  return parseClaudeJsonArray(text)
}

async function quoteLineItems(symbolCounts: Record<string, number>): Promise<TakeoffLineItem[]> {
  const provider = getLlmProvider()
  if (provider === 'groq') return quoteWithGroq(symbolCounts)
  return quoteWithClaude(symbolCounts)
}

export async function runTakeoff(
  imageFile: File,
  modelId: RoboflowModelId = 'production',
): Promise<{
  predictions: TakeoffPrediction[]
  lineItems: TakeoffLineItem[]
  qtyByTag: Record<SymbolTag, number>
  rawClassCounts: Record<string, number>
}> {
  const base64 = await fileToBase64(imageFile)
  const roboflow = await detectWithRoboflow(base64, modelId)
  const rawPredictions = roboflow.predictions ?? []

  const imageWidth = roboflow.image?.width
  const imageHeight = roboflow.image?.height
  const predictions = rawPredictions.map((p) => toTopLeftBox(p, imageWidth, imageHeight))

  const symbolCounts = countByClass(rawPredictions)
  const qtyByTag = quoteQtyByTagFromCounts(symbolCounts)

  const llmItems = await quoteLineItems(symbolCounts)
  const lineItems: TakeoffLineItem[] = SYMBOL_TAGS.map((tag) => {
    const llm = llmItems.find((li) => normalizeSymbolTag(li.symbol) === tag)
    return {
      symbol: tag,
      description: llm?.description ?? SYMBOL_DESCRIPTIONS[tag],
      quantity: qtyByTag[tag],
      unit: llm?.unit ?? 'EA',
      spec: llm?.spec ?? '',
    }
  })

  return { predictions, lineItems, qtyByTag, rawClassCounts: symbolCounts }
}
