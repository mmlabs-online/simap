# Review — BUG-005

## Attempt 1 — 2026-11-26
Verdict: PASS

Checks run by reviewer on bug/BUG-003 (local Postgres en_US): format:check exit 0; typecheck exit 0; check:layers exit 0 (799 files, no violations); test exit 0; build exit 0; test:db exit 0 (0 failures). Matches impl-log. Scope: diff of this ticket is within the plan file list; backlog rows are the expected batch-branch rule. No High path touched.

### Acceptance criteria
- Regression test fails before, passes after: met. New test "list order does not depend on the database locale"; impl-log shows it failing on old map-items.ts with local datcollate en_US.utf8 (2 failed) and passing after. Test is sound: under en_US "!!ab" would not sort last of the three.
- Expected behaviour: met. SQL is now `order by lower(name) collate "C", builtin_key collate "C"`; the existing order test uses an explicit code-point comparator matching it.
- All checks pass: met.

### Product change vs D67 and the UI
- D67 1 says catalog items are listed alphabetically by name. "C" order is a deterministic by-name order (code point on lowercased name); it is a baseline only. Known limit: non-ASCII names (e.g. Vietnamese diacritics) sort by byte value in the API response. Acceptable, and documented in the plan and comment.
- UI re-sorts everything itself with localeCompare("en", base) then builtinKey: src/ui/mapItems/map-items-state.ts:14-26 (catalogGroups) and src/lib/layout-editor/palette.ts:38-54 (catalogPalette). So the visible order does not change. The only listMapItems consumers are the route and tests; none depend on SQL order other than the limit window (MAP_ITEM_LIMITS.list), which is unaffected in practice.
- R6: org scoping unchanged. No migration needed (R2 n/a). Within plan; the planned tie-break assertion was dropped because map_items_org_name_key makes it impossible (justified in impl-log).

### Nits / Follow-ups
- Other order-by clauses on map data may have the same locale dependence (not checked).
- The comment on listMapItems is long on one line; format:check passes.
