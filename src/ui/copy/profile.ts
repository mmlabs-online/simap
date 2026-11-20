/** English strings for the first-visit profile screen (D36). */
export const profileCopy = {
  title: "Welcome",
  intro: (email: string) => `Signed in as ${email}. Choose the name other people will see.`,
  label: "Display name",
  hint: "Up to 80 characters.",
  submit: "Continue",
  saving: "Saving...",
  errors: {
    required: "Enter a display name.",
    invalid: "That name cannot be used. Use letters or numbers, up to 80 characters.",
    retry: "Could not save your name. Try again.",
  },
} as const;
