import type { ReactNode } from "react";
import Link from "next/link";
import { isActive, navItemsFor, type NavId } from "@/lib/nav";
import type { Session } from "@/lib/session";
import { Avatar } from "./Avatar";
import { Button, IconButton } from "./Button";
import { APP_VERSION } from "./app-version";
import { Card } from "./Card";
import { shellCopy } from "./copy/shell";
import { Icon } from "./Icon";
import { badgeText } from "./requests/request-badge";
import { RoleBadge } from "./RoleBadge";
import type { ShellActions } from "./session";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Presentational app shell: nav rail (>= 1024 px) or bottom bar, header and main.
 * Takes the session as a prop so it renders without a router or context.
 * Nav entries are hidden by tier for UX only; the API enforces permissions.
 */
export function AppShellView({
  session,
  pathname,
  actions,
  roomSwitcher,
  badges,
  badgeLabels,
  version = APP_VERSION,
  photoUrl,
  children,
}: {
  session: Session | null;
  pathname: string;
  actions: ShellActions;
  roomSwitcher?: ReactNode;
  /** A count per nav entry (0 or missing: no badge). Only entries the tier can see render. */
  badges?: Partial<Record<NavId, number>>;
  /** Screen-reader text per nav entry; it replaces the default text for the entry's count. */
  badgeLabels?: Partial<Record<NavId, string>>;
  /** The release tag shown in the header (SIM-040); defaults to the build-time constant. */
  version?: string;
  /** The member's own photo (blob URL); initials when null. */
  photoUrl?: string | null;
  children: ReactNode;
}) {
  const navItems = session
    ? navItemsFor(session.tier).filter((item) => item.placement === "rail")
    : [];

  return (
    <div className="flex flex-col-reverse lg:flex-row h-dvh w-full overflow-hidden text-on-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md3 focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-on-primary"
      >
        {shellCopy.skipLink}
      </a>

      {session && (
        <nav
          aria-label={shellCopy.navLabel}
          className="flex-none flex lg:flex-col items-center justify-around lg:justify-start
                     lg:w-[88px] lg:py-3.5 lg:gap-2 min-h-[68px] lg:min-h-0
                     pb-[env(safe-area-inset-bottom)] lg:pb-3.5
                     bg-surface border-t lg:border-t-0 lg:border-r border-outline-variant z-10"
        >
          <div className="hidden lg:flex mb-3.5">
            <div
              className="w-10 h-10 rounded-md3 flex items-center justify-center shadow-[0_4px_12px_var(--accent-shadow)]"
              style={{ background: "var(--accent-orange)", color: "var(--on-accent)" }}
            >
              <Icon name="grid_view" filled size={24} />
            </div>
          </div>
          <div className="flex lg:flex-col gap-1.5 w-full justify-start overflow-x-auto lg:overflow-visible">
            {navItems.map((item) => {
              const active = isActive(item, pathname);
              const count = badges?.[item.id] ?? 0;
              const text = badgeText(count);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="state-layer flex flex-col items-center gap-1 flex-1 min-w-16 lg:flex-none lg:min-w-0 lg:w-16 min-h-11 px-1 py-1.5 rounded-md3
                             no-underline text-on-surface-variant aria-[current=page]:text-on-surface"
                >
                  <span
                    className={[
                      "relative w-14 h-8 rounded-md3 flex items-center justify-center transition-colors duration-150",
                      active
                        ? "bg-secondary-container text-on-secondary-container border border-outline-variant"
                        : "",
                    ].join(" ")}
                  >
                    <Icon name={item.icon} filled={active} size={22} />
                    {text !== null && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-error-container text-on-error-container border border-surface text-[10px] font-extrabold leading-[18px] text-center"
                      >
                        {text}
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] font-semibold tracking-[0.02em]">
                    {shellCopy.nav[item.id]}
                  </span>
                  {text !== null && (
                    <span className="sr-only">
                      {badgeLabels?.[item.id] ??
                        (shellCopy.badge.byNav[item.id] ?? shellCopy.badge.newDecisions)(count)}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="h-16 flex-none flex items-center gap-2 px-4 lg:px-5 bg-surface border-b border-outline-variant z-[5]">
          <span className="font-heading text-[18px] font-extrabold tracking-[-0.01em] text-on-surface whitespace-nowrap">
            {shellCopy.brand}
          </span>
          {session && (
            <>
              <span
                title={shellCopy.version.title(version)}
                className="flex-none whitespace-nowrap text-[11px] font-semibold text-on-surface-variant"
              >
                {shellCopy.version.label(version)}
              </span>
              <Link
                href="/credits"
                aria-current={pathname === "/credits" ? "page" : undefined}
                className="flex-none whitespace-nowrap text-[11px] font-semibold text-on-surface-variant underline aria-[current=page]:text-on-surface"
              >
                {shellCopy.credits}
              </Link>
              <span className="ml-2 min-w-0 max-w-[40vw] truncate text-[13px] font-semibold text-on-surface-variant">
                {session.orgName}
              </span>
              {session.devToken && (
                <span
                  title={session.devToken.tooltip}
                  className={`inline-flex flex-none items-center whitespace-nowrap rounded-[8px] border px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.06em] ${
                    session.devToken.prod
                      ? "border-red-700 bg-red-600 text-white"
                      : "border-amber-500 bg-amber-300 text-amber-950"
                  }`}
                >
                  {session.devToken.label}
                </span>
              )}
              {actions.switchOrg && (
                <IconButton
                  icon="swap_horiz"
                  label={shellCopy.actions.switchOrg}
                  onClick={actions.switchOrg}
                />
              )}
            </>
          )}

          <div className="flex-1" />

          <ThemeToggle />

          {session && (
            <>
              <IconButton
                icon="sync"
                label={shellCopy.actions.refreshPermissions}
                onClick={actions.refreshPermissions}
                disabled={!actions.refreshPermissions}
              />
              {!session.devToken && (
                <IconButton
                  icon="logout"
                  label={shellCopy.actions.signOut}
                  onClick={actions.signOut}
                  disabled={!actions.signOut}
                />
              )}
              <div className="flex items-center gap-2 flex-none">
                <span title={session.email}>
                  <Avatar name={session.email.split("@")[0]} size={40} src={photoUrl} />
                </span>
                <span className="hidden lg:inline-flex">
                  <RoleBadge tier={session.tier} />
                </span>
              </div>
            </>
          )}
        </header>

        {session && roomSwitcher && (
          <div className="flex-none flex items-center gap-2 px-4 lg:px-5 py-2 bg-surface border-b border-outline-variant">
            {roomSwitcher}
          </div>
        )}

        <main
          id="main"
          tabIndex={-1}
          className="flex-1 min-h-0 overflow-auto relative outline-none"
        >
          {session ? (
            children
          ) : (
            <div className="p-4 lg:p-6">
              <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <Icon name="login" size={36} className="text-on-surface-variant" />
                <h1 className="text-h2 font-extrabold text-on-surface">
                  {shellCopy.signedOut.title}
                </h1>
                <p className="text-sm font-medium text-on-surface-variant">
                  {shellCopy.signedOut.body}
                </p>
                <Button disabled>{shellCopy.signedOut.signIn}</Button>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
