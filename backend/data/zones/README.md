# Council zone boundaries

`ta-2026-clipped.geojson` — 67 NZ territorial-authority polygons, simplified to
0.0005° (~50 m) with `ST_SimplifyPreserveTopology` (was ~97 MB at full
resolution). Sourced from Stats NZ's open ArcGIS FeatureServer.

## Refresh

```bash
# fetch full-resolution source (raw/ is gitignored)
mkdir -p raw
curl -sL "https://services2.arcgis.com/vKb0s8tBIA3bdocZ/arcgis/rest/services/Territorial_Authority_2026/FeatureServer/0/query?where=1%3D1&outFields=TA2026_V1_00_NAME&outSR=4326&f=geojson" -o raw/ta-2026.geojson

# import into postgres (creates one council + zone per TA)
cd ../.. && npm run zones -- data/zones/raw/ta-2026.geojson
```

Feature properties used: `TA2026_V1_00_NAME` → `councils.name` → zone `'All areas'`.
`Area Outside Territorial Authority` is skipped. Alert recipients stay empty —
fill `alert_emails`/`alert_sms` per council during a pilot.

Source: Stats NZ Geographic Data Service / ArcGIS Hub, "Territorial Authority
2026" feature service (item `b7f8726da7f6467a9cb42221b0013938`). Check
https://datafinder.stats.govt.nz/ for the current year's layer.
