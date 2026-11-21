/** English strings for the dev-token gate (SIM-028.1, D36). Imported only by `DevGate`, which production never loads. */
export const devTokenCopy = {
  invalidTitle: "No usable dev token",
  invalidBody:
    "Run pnpm dev:token, then check again. If you started with pnpm dev:prod, run pnpm dev:token --org <the org in the banner>. The server console names the exact cause.",
  needOrgTitle: "Dev token has no organization",
  needOrgBody: "Run pnpm dev:token --org <uuid>, then check again.",
  checkAgain: "Check again",
  badge: { label: "Dev token", tooltip: "Signed in with a local development token" },
  prodBadge: {
    label: "Production data",
    tooltip:
      "Signed in with a development token against the production database: every change is real",
  },
} as const;
