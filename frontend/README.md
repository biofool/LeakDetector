# frontend — React + Vite + Tailwind PWA

Public reporting flow and staff dashboard. Implements `docs/spec.md` §5 UX.

## Setup

```bash
npm install
cp .env.example .env        # VITE_API_BASE_URL — default http://127.0.0.1:8080
npm run dev                 # on :5173
npm run build               # → dist/
npm test                    # vitest (api client + helpers)
```

## Routes

| Path | Page | Who |
|---|---|---|
| `/` | report a leak (locate → duplicate check → details) | public |
| `/map` | public leak map | public |
| `/r/:id` | tracking page (from the receipt URL) | public |
| `/staff` | duty dashboard — login, list by SLA, PATCH actions | council staff |

## Notes

- API base comes from `VITE_API_BASE_URL` at build time.
- Leaflet markers use `divIcon` — no image assets needed.
- PWA manifest via `vite-plugin-pwa`; OSM tiles for the dev basemap
  (swap to LINZ basemaps for production).
