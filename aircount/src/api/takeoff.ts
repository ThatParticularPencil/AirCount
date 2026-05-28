const ROBOFLOW_PATH = '/hvac-mechanical-2/3'
const ROBOFLOW_API_KEY = 'NWbqS9yO8GSLFBw249JQ'

const CLAUDE_PATH = '/v1/messages'
const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

const GROQ_PATH = '/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

const CLAUDE_SYSTEM_PROMPT = `You are an HVAC takeoff assistant. Convert detected HVAC symbols 
into contractor quote line items. Return ONLY a valid JSON array, 
no explanation, no markdown.

Symbol mapping:
- SD-1 → Supply Air Diffuser, Ceiling, Sec. 23.37.00
- RG-1 → Return Air Grille, Ceiling, Sec. 23.37.00
- EG-2 → Exhaust Air Grille, Ceiling, Sec. 23.37.00
- SR-1 → Supply Air Register, Wall, Sec. 23.37.00

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

async function detectWithRoboflow(base64: string): Promise<RoboflowResponse> {
  const baseUrl = import.meta.env.DEV
    ? `/api/roboflow${ROBOFLOW_PATH}`
    : `https://serverless.roboflow.com${ROBOFLOW_PATH}`

  // Roboflow serverless expects the api_key as a query param (like axios `params`)
  // and the base64 image in the POST body with x-www-form-urlencoded content-type.
  const url = `${baseUrl}?api_key=${encodeURIComponent(ROBOFLOW_API_KEY)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: base64,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Roboflow request failed (${res.status}): ${detail || res.statusText}`)
  }

  return (await res.json()) as RoboflowResponse
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

export async function runTakeoff(imageFile: File): Promise<{
  predictions: TakeoffPrediction[]
  lineItems: TakeoffLineItem[]
}> {
  const base64 = await fileToBase64(imageFile)
  const roboflow = await detectWithRoboflow(base64)
  const rawPredictions = roboflow.predictions ?? []

  const imageWidth = roboflow.image?.width
  const imageHeight = roboflow.image?.height
  const predictions = rawPredictions.map((p) => toTopLeftBox(p, imageWidth, imageHeight))

  const symbolCounts = countByClass(rawPredictions)
  const lineItems = await quoteLineItems(symbolCounts)

  return { predictions, lineItems }
}
