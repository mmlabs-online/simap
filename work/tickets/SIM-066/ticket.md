# SIM-066: Redesign My Portal → Profile layout and the portal tab bar

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P2 |
| Size | M |
| Areas | ui, ux |
| Gate | none |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | — |

## Goal
The Profile tab of My Portal follows Ming's mockup (`mockup-profile.png` in this folder): a two-column "Profile
settings" page with personal information, workspace membership and a live pixel-character editor, and the portal tab
bar gets a clearer, more polished look.

## Scope reference
`docs/spec-v1.md` POR-01 (tabs), POR-04 (display name, email, role), POR-05 (profile photo), POR-06 (pixel character);
decisions D70, D71, D36 (copy in `src/ui/copy/`), D52 (clean UI kit for portal). Request: Ming 2026-11-26 with the
mockup image.

## Scope
- **Tab bar (POR-01):** My seat / My devices / Profile as icon + label tabs with an accent underline and accent
  text on the selected tab, a "You" chip on Profile as in the mockup, a full-width divider under the bar; keeps the
  existing keyboard behaviour, ARIA tab roles, `?tab=` URL and the My Portal badge counts.
- **Page header:** "Profile settings" title, subtitle, and an "Only visible to your workspace" note on the right.
- **Left column:**
  - "Personal information" card: avatar (photo or initial) with "Upload photo" and the format hint (POR-05, existing
    upload/crop flow), display name with required marker, helper text and a character counter (D17 rules), email as
    a read-only field with a lock icon and "Managed by your organization" (POR-04).
  - "Workspace membership" card: org name and initial, "Your organization", the caller's simap role as a badge, and
    "Your role and access are managed by your organization".
- **Right column:** "Your pixel character" card (POR-06): live preview on a dotted stage with Front/Back toggle and
  the name tag, "This is how you appear on room maps", then Skin tone, Hair color, Hairstyle (cards with a small
  preview) and Shirt color swatches with a clear selected state, and "Reset character".
- **Footer bar:** save status on the left, Cancel and "Save changes" on the right (see open questions for what they
  cover).
- Stacks to one column at 390 px; copy in `src/ui/copy/portal.ts`.

## Out of scope
- Any API, schema or validation change; new avatar parts or colours (only the existing preset values); the My seat
  and My devices tab contents.

## Acceptance criteria
- [ ] The portal tab bar matches the mockup (icons, accent underline, "You" chip on Profile) and keeps tab roles,
  arrow-key navigation, `?tab=` URLs and the badge counts; existing tab tests pass or are updated.
- [ ] The Profile tab shows the header, the Personal information and Workspace membership cards on the left and the
  pixel character card on the right at desktop width, and one column at 390 px.
- [ ] Display name keeps today's validation and limit, with a live character counter; email and role are read-only.
- [ ] The pixel character card offers only the existing preset values, shows a live front/back preview, and Reset
  returns to the derived look (POR-06).
- [ ] Cancel discards unsaved edits and "Save changes" saves them through the existing APIs; the footer shows whether
  changes are saved; nothing is saved to browser storage.
- [ ] Unit/render tests cover the tab bar, the layout regions and the save/cancel state.

## Technical notes
- Files: `src/ui/portal/PortalTabs.tsx`, `ProfileTab.tsx`, `ProfileTabView.tsx`, `ProfilePhotoSection.tsx`,
  `PixelLookSection.tsx`, `PixelLookPicker.tsx`, `LookPreview.tsx`, `src/ui/copy/portal.ts`.
- Today the name and the character each have their own Save button and the photo saves on upload.
- Open questions (planner proposes a default, Ming confirms at PLAN/PR):
  1. Does "Save changes" cover display name + character together (photo still saves on upload, as now)?
  2. The mockup footer says "Stored on this browser"; data is stored on the server, so the copy should say
     "Saved to your account" (or similar). Confirm.
  3. Which data shows the org name in "Workspace membership" (session org) and whether a User sees their role
     badge too (POR-04 shows the role read-only to everyone).

## Test plan
- Unit: tab bar render/keyboard, layout regions, dirty/save/cancel state.
- Manual: 1280 px and 390 px, light and dark theme.

## Notes / answers from Ming
- 2026-11-26: requested with the mockup image `mockup-profile.png`.

- Plan approved (2026-11-26, batch 2026-11-26-7): Ming "duyệt hết, theo mặc định hết" — all batch questions 1–12 take their defaults.
- Merge approved (2026-11-26, batch 2026-11-26-7): Ming "cho merge SIM-066, SIM-067, SIM-069".

## Handoff
