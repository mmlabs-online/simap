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
  accept: {
    pageTitle: "Accept invitation",
    title: "Join an organization",
    signInHint: "Sign in with the email address the invitation was sent to.",
    newAccountHint:
      "Don't have an account? Create one with the invited address in a new tab, verify it, then come back to this tab and sign in.",
    createAccount: "Create an account",
    forgotPassword: "Forgot your password?",
    acceptAs: (email: string) => `Accept as ${email}`,
    accept: "Accept",
    accepting: "Accepting...",
    otherAccount: "Use another account",
    joining: "Joining...",
    invalidTitle: "Invitation not valid",
    invalid:
      "This invitation link is not valid, has expired or was already used. If you opened it before, open the link from your email again; if you already accepted, go to simap.",
    goHome: "Go to simap",
  },
  fieldErrors: {
    required: "Enter an email address.",
    invalid: "Enter a valid email address.",
    role: "Choose a role.",
  },
} as const;
