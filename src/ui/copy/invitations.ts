/** English strings of the invite flow (D36). Identity error messages come from `authErrorMessage`. */
export const invitationsCopy = {
  open: "Invite people",
  title: "Invite people",
  subtitle: "We email them a link to join this organization.",
  submit: "Send invitation",
  fields: { email: "Email", role: "Role" },
  roles: { "simap:user": "User", "simap:manager": "Manager" },
  sent: (email: string) =>
    `Invitation created for ${email}. If the address can receive mail, an invitation is on its way.`,
  sentNotRecorded: "The invitation was sent, but it may not appear in the pending list.",
  retryRecord: "Try saving again",
  another: "Invite someone else",
  close: "Close",
  unavailable: "Invitations are not available right now. Sign in again and retry.",
  fieldErrors: {
    required: "Enter an email address.",
    invalid: "Enter a valid email address.",
    role: "Choose a role.",
  },
} as const;
