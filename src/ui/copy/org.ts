/** English strings for entering and switching organizations (D36). Org names are data and are never put here. */
export const orgCopy = {
  picker: {
    title: "Choose an organization",
    listLabel: "Your organizations",
    entering: "Entering...",
  },
  switcher: {
    title: "Switch organization",
    submit: "Switch",
    legend: "Organizations",
    current: "Current",
    loading: "Loading your organizations...",
    loadFailed: "Could not load your organizations.",
    retry: "Try again",
    only: "You are only in this organization.",
  },
  badge: {
    supportAccess: "Support access",
  },
  notices: {
    org_denied: "You no longer have access to that organization.",
  },
  none: {
    title: "No organization",
    body: (email: string | null) =>
      email
        ? `Signed in as ${email}. You are not in any organization yet.`
        : "You are not in any organization yet.",
    howTo: "Ask an organization admin to add you, then sign in again.",
  },
} as const;
