# Skyarc Agreement Generator

DOOH advertising slot booking agreement generator with Skymurals letterhead.

## Setup

```bash
npm install
npm run dev
```

## Deploy to Vercel

```bash
npx vercel
```

## Font: Plus Jakarta Sans

Font files are in `public/fonts/`. To swap fonts, replace the `.ttf` files and update the paths in `src/pdfGenerator.ts`.

## Agreement Number Format

`SA/{LOCATION_CODE}/{YEAR}/{AUTO_INCREMENT}`

Counter stored in localStorage per location per year.

## Adding Locations

Edit `LOCATIONS` in `src/pdfGenerator.ts`.
