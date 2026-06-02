import { useCallback, useState } from 'react'
import {
  runTakeoff,
  SYMBOL_TAGS,
  type RoboflowModelId,
  type SymbolTag,
} from './api/takeoff'
import AirCountApp, { type AirCountDetection, type AirCountLineItem } from './components/AirCountApp'

export default function App() {
  const [detections, setDetections] = useState<AirCountDetection[]>([])
  const [lineItems, setLineItems] = useState<AirCountLineItem[]>([])
  const [takeoffError, setTakeoffError] = useState<string | null>(null)
  const [modelId, setModelId] = useState<RoboflowModelId>('production')
  const [qtyByTag, setQtyByTag] = useState<Record<SymbolTag, number>>(() =>
    Object.fromEntries(SYMBOL_TAGS.map((t) => [t, 0])) as Record<SymbolTag, number>,
  )
  const [rawClassCounts, setRawClassCounts] = useState<Record<string, number>>({})

  const handleRunTakeoff = useCallback(
    async (imageFile: File) => {
      setTakeoffError(null)
      try {
        const { predictions, lineItems: items, qtyByTag: qty, rawClassCounts: raw } =
          await runTakeoff(imageFile, modelId)

        setQtyByTag(qty)
        setRawClassCounts(raw)

        setDetections(
          predictions.map((p) => ({
            label: p.class,
            confidence: p.confidence,
            x: p.x,
            y: p.y,
            width: p.width,
            height: p.height,
          })),
        )

        setLineItems(
          items.map((li) => ({
            symbol: li.symbol,
            qty: li.quantity,
            unit: li.unit,
            spec: li.spec,
            description: li.description,
          })),
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Takeoff failed'
        setTakeoffError(message)
      }
    },
    [modelId],
  )

  return (
    <AirCountApp
      detections={detections}
      lineItems={lineItems}
      qtyByTag={qtyByTag}
      rawClassCounts={rawClassCounts}
      modelId={modelId}
      onModelChange={setModelId}
      onRunTakeoff={handleRunTakeoff}
      takeoffError={takeoffError}
    />
  )
}
