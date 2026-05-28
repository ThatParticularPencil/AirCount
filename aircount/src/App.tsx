import { useCallback, useState } from 'react'
import { runTakeoff } from './api/takeoff'
import AirCountApp, { type AirCountDetection, type AirCountLineItem } from './components/AirCountApp'

export default function App() {
  const [detections, setDetections] = useState<AirCountDetection[]>([])
  const [lineItems, setLineItems] = useState<AirCountLineItem[]>([])
  const [takeoffError, setTakeoffError] = useState<string | null>(null)

  const handleRunTakeoff = useCallback(async (imageFile: File) => {
    setTakeoffError(null)
    try {
      const { predictions, lineItems: items } = await runTakeoff(imageFile)

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
  }, [])

  return (
    <AirCountApp
      detections={detections}
      lineItems={lineItems}
      onRunTakeoff={handleRunTakeoff}
      takeoffError={takeoffError}
    />
  )
}
