import AirCountApp, { type AirCountDetection, type AirCountLineItem } from './components/AirCountApp'

const MOCK_DETECTIONS: AirCountDetection[] = [
  { label: 'DIFFUSER', confidence: 0.92, x: 0.08, y: 0.12, width: 0.18, height: 0.14 },
  { label: 'GRILLE', confidence: 0.88, x: 0.42, y: 0.33, width: 0.22, height: 0.16 },
  { label: 'VAV', confidence: 0.81, x: 0.66, y: 0.58, width: 0.21, height: 0.19 },
]

const MOCK_LINE_ITEMS: AirCountLineItem[] = [
  {
    symbol: 'DIFFUSER',
    qty: 12,
    unit: 'EA',
    spec: '23 37 13',
    description: '2x2 lay-in supply diffuser, white, with opposed blade damper',
  },
  {
    symbol: 'GRILLE',
    qty: 9,
    unit: 'EA',
    spec: '23 37 13',
    description: 'Return air grille, aluminum, 12"x12", eggcrate core',
  },
  {
    symbol: 'VAV',
    qty: 3,
    unit: 'EA',
    spec: '23 36 00',
    description: 'VAV terminal unit, pressure independent, 8" inlet, w/ DDC controls',
  },
]

export default function App() {
  return (
    <AirCountApp
      mockMode
      detections={MOCK_DETECTIONS}
      lineItems={MOCK_LINE_ITEMS}
      onRunTakeoff={async () => {
        await new Promise((r) => setTimeout(r, 900))
      }}
    />
  )
}
