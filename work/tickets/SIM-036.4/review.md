## Attempt 1 — 2026-11-25
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (716 files)
- `pnpm typecheck && pnpm check:layers` — exit 0, "Types generated successfully"; "check-layers: 662 files, no violations"
- `pnpm test` — exit 0, Test Files 252 passed | 1 skipped (253); Tests 2474 passed | 7 skipped (2481). Matches impl-log.
- `pnpm build` — exit 0
- `pnpm test:db` — CI-only, not run (no DB change in this diff)

### Acceptance criteria
- [x] Draw list unit tests: catalog image at its slot; seeded type uses the built-in sprite; unknown type uses the placeholder — evidence: `src/lib/sprites/placement.test.ts` › "catalog device images (SIM-036.4)": "catalog image op at the slot position, centred on the slot frame" (all 4 rotations), "seeded type without image keeps the built-in sprite", "deviceType null draws the device.other placeholder"; `src/lib/sprites/device-slots.test.ts` › "resolveDeviceArt" (6 cases). All green.
- [x] A failed or slow image load shows the placeholder, and the rest of the map draws normally — evidence: `placement.test.ts` › "image not ready draws the placeholder at the type's slot; other ops unchanged" (compares non-placeholder frames to the device-free draw list); `src/ui/roomlayout/catalog-images.test.ts` › "failed fetch and decode error report not ready"; `paint.test.ts` › "a null source skips the op without throwing". Code: `resolveDeviceArt` returns placeholder while `imageReady` is false (`src/lib/sprites/device-slots.ts` resolveDeviceArt); decode errors are caught to `null` in `catalog-images.ts` decodeReady. The devtools blocking check is part of Ming's verification below.
- [x] Each type image is fetched at most once per page load — evidence: `catalog-images.test.ts` › "fetches once per type across devices, repeated syncs and a same-version reload" (`load` called once); "a bumped version fetches again". One hook instance per page (`SeatsPage.tsx`, `LayoutEditorPage.tsx` AdminEditor). The `api` memo depends on `apiFetch`, which is stable (runtime objects in AuthGate/DevGate), so the cache is not recreated during a page's life. React StrictMode in dev may run the effect twice; production does not.

Ming verification after merge (carry into the PR):
- Create a "Headset" type with an image (slot phone or other), place a headset device at a seat, open the room and the layout editor: the 24 × 24 image shows at the slot, centred sensibly (A3 centring was not checked by eye).
- Block `/api/device-types/*/image` in devtools: the map still draws with the square placeholder.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: ui files import only `@/lib/**` and other ui modules (check:layers clean). R4: all changed files are in the plan's list; `catalog-images.ts` is the plan's preferred pure factory; `LayoutEditor.tsx` is named in the plan ("or `LayoutEditor.tsx`") and justified in impl-log. No High path touched. R5: new logic has unit tests. R3/R6/R7/R2: not applicable (no server, config or schema change). D36: no new UI copy.

### Blockers from review agents
None.

### Nits (do not block)
- `src/ui/roomlayout/RoomMap.tsx` and `EditorCanvas.tsx`: the paint effect reads `catalogImages?.source` but does not list it in deps. It works because `list` changes with `catalogImages.version` and `source` reads through a ref, but a comment saying so would help the next reader.
- `src/ui/roomlayout/useCatalogImages.ts`: `ref.current = images` is assigned during render; harmless here, but a `useEffect` assignment is the usual React pattern.
- `placement.test.ts` › stacking test checks only the `s` direction and only `x`; the `-3` (v axis) case is not covered for images (the shared `placeDevices` stacking is covered by existing tests).

### Follow-ups (out of scope)
- Check the 24 × 24 centring on `/dev/roommap` with a real image once a browser run is available (A3); adjust only the centring offset, not the slot table.
