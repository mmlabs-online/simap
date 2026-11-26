/** English strings for My Portal (D36). */
export const portalCopy = {
  tablistLabel: "My Portal sections",
  tabs: {
    devices: "My devices",
    profile: "Profile",
  },
  devices: {
    heading: "My devices",
    empty: "You do not hold any devices.",
    loadMore: "Load more",
    retry: "Try again",
    waiting: "Waiting for my confirmation",
  },
  profile: {
    heading: "Profile",
    nameLabel: "Display name",
    nameHint: "Up to 80 characters.",
    save: "Save",
    saving: "Saving...",
    saved: "Display name saved.",
    loadFailed: "Could not load your profile.",
    retry: "Try again",
    email: "Email",
    role: "Role",
    managed: "Managed in mmlabs",
    errors: {
      required: "Enter a display name.",
      invalid: "That name cannot be used. Use letters or numbers, up to 80 characters.",
      retry: "Could not save your name. Try again.",
    },
  },
} as const;
