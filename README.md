![AirCount img](https://github.com/ThatParticularPencil/AirCount/blob/main/Screenshot%202026-05-28%20at%2012.56.40%E2%80%AFAM.png)
# AirCount
Drawing in, quote out — HVAC takeoff demo built in 2 days

## What it does
AirCount takes a mechanical floor plan image and runs HVAC symbol detection on it using a YOLOv8 model trained on real construction drawings. The UI shows the uploaded drawing with bounding boxes and a takeoff table with totals.

This project exists mostly for my own learning purposes. Training models with roboflow, extracting objects, etc.

## The pipeline
1. Upload a mechanical floor plan image
2. Run YOLOv8 inference to detect HVAC symbols with bounding boxes: SD-1, RG-1, SR-1
3. Count symbols and send counts to Claude (or groq) to map 
4. Render the quote table output (fixed rows + totals)

## Metrics
Using a standard symbol notation, and lots of picky manual annotation I got these metrics on the roboflow model.
- 92% mAP
- 95% precision
- 88% recall

## Stack
- React + Vite + TypeScript + Tailwind
- Roboflow (annotation, hosted YOLOv8 training, inference API)
- Claude API (symbol → line item extraction)

## start
Setup:

```bash
cd aircount
npm install
```

Environment variables (create `aircount/.env`):

```bash
VITE_LLM_PROVIDER=anthropic
VITE_ANTHROPIC_API_KEY=your_key_here

# Optional (if switching to Groq):
# VITE_LLM_PROVIDER=groq
# VITE_GROQ_API_KEY=your_groq_key_here
```

Run:

```bash
cd aircount
npm run dev
```
