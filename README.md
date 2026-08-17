# MP Tick Utility

Robust logbook utility and data visualizer for Mountain Project ticks

Available at [akhotam.github.io/mp-tick-util/](https://akhotam.github.io/mp-tick-util/)

## Why

- Mountain Project will delete ticks from your logbook when the route is deleted/lost/hidden
- Current Mountain Project data analytics are pretty poor

## Using the Tick Utility

The site is static and runs entirely in the browser. No account creation and no backend processing!

### First Time Users (no existing logbook)

1. On Mountain Project: `Profile` > `Ticks` > **`Export CSV`**.
2. Upload the `ticks.csv` file to the tick utility webpage
3. Download the `logbook.json` file created
   - Recommended: back this file up somewhere! Create a git repository for change tracking and server storage
4. Explore the data visualizations and analytics

### Existing Users

1. Upload your existing `logbook.json` file to the tick utility webpage
2. Download your newly updated ticks from Mountain Project
3. Select `Add an Export` to import your new ticks
4. Enjoy the data visualizations and analytics

### Formatting ticks on MP for best results

- **Partners:** use `w/` to denote who you climbed with
   - Example: `Lead` > `Redpoint`: `w/ Charlie.`
- **Rope/Free Solo:** tick rope solos as the rope style (`lead` or `TR`) and mention `solo` in the beginning of the tick. Free solos are ticked as `Solo` on MP
   - Example: `Lead` > `Onsight`: `solo. Tested out the new Roc Solo while Bob watched...`
- **Top Rope Styles:** the first word in the tick should be a standard style like `onsight` or `flash`
   - Example: `TR`: `Flash w/ John. Fun route...`

## Development

Clone the repo and run:

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
