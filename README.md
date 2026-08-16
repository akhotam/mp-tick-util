# MP Tick Utility

Robust logbook utility and data visualizer for Mountain Project ticks

## Why

- Mountain Project will delete ticks from your logbook when the route is deleted/lost/hidden
- Current Mountain Project data analytics are pretty poor

The site is static and runs entirely in the browser. No accounts, no backend, no upload.

## Using the Tick Utility

The site is static and runs entirely in the browser. No account creation and no backend processing!

### First Time Users (no existing logbook)

1. On Mountain Project: `Profile` > `Ticks` > **`Export CSV`**.
2. Upload the `ticks.csv` file to the tick utility webpage
3. Download the `logbook.json` file created
   - Recommended: back this file up somewhere! Create a git repository for change tracking and server storage
4. Explore the data visualizations and analytics

## Existing Users

1. Upload your existing `logbook.json` file to the tick utility webpage
2. Download your newly updated ticks from Mountain Project
3. Select `Add an Export` to import your new ticks
4. Enjoy the data visualizations and analytics

## Keeping your own backup in this repo

`data/` holds the raw exports and `public/logbook.json` is the merged result. Both are committed,
so git history is the backup — including anything Mountain Project has since deleted.

```bash
mv ~/Downloads/"ticks 7.csv" data/
npm run ingest      # rebuilds public/logbook.json, prints what changed
git add data public/logbook.json && git commit -m "Add ticks 7 export"
```

`npm run ingest` always rebuilds from every CSV in `data/`, so it's idempotent — running it twice
produces a byte-identical file, and `git diff` shows only real changes.

## Development

```bash
npm install
npm run dev        # http://localhost:5173/mp-tick-util/
npm test           # merge engine and parsing invariants
npm run build
```

## How the merge works

Exports carry no tick ID, so identity is `date | route ID | style | lead style | pitches`, plus an
occurrence index — repeat laps of the same route on the same day stay distinct ticks. The route ID
comes from the URL and survives renames.

Snapshots are ordered by filename number, then file mtime, then by the data itself (later exports
have later dates and more rows). Order matters because absence from a newer export is what marks a
tick deleted — MP always exports the complete list, so absence is meaningful. The resolved order is
always shown rather than assumed.

Each record keeps the raw CSV row verbatim plus its provenance: `first_seen`, `last_seen`,
`deleted`, `deleted_at`, and an `edits` log of changes. Everything analytic — partners, grade bands,
areas, repeat counts — is derived at load time, so changing an analysis never needs a data
migration. `Avg Stars` and `Your Stars` are updated but not logged as edits: they drift constantly
as other climbers rate routes, and would bury real changes in noise.

**Known limit:** editing a tick's date or style on Mountain Project reads as one delete plus one
add. Without tick IDs that's unresolvable, so the ingest output prints added and removed rows
together, making the pattern easy to spot.
