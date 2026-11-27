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
 * Presentational app shell: sidebar (>= 800 px) or bottom bar, header and main.
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
    <div className="flex flex-col-reverse md:flex-row h-dvh w-full overflow-hidden text-text-primary">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:inline-flex focus:min-h-control focus:items-center focus:rounded-lg focus:bg-workspace-action focus:px-4 focus:text-label focus:text-on-action"
      >
        {shellCopy.skipLink}
      </a>

      {session && (
        <nav
          aria-label={shellCopy.navLabel}
          className="flex-none flex md:flex-col md:w-sidebar md:gap-2 md:px-3 md:pt-4 md:pb-4 md:overflow-y-auto
                     pb-[env(safe-area-inset-bottom)] bg-surface border-t md:border-t-0 md:border-r border-divider z-10"
        >
          <div className="hidden md:flex px-3 pb-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-workspace-primary text-on-action shadow-card">
              <Icon name="grid_view" filled size={24} />
            </div>
          </div>
          <div className="flex md:flex-col gap-1 w-full overflow-x-auto md:overflow-visible">
            {navItems.map((item) => {
              const active = isActive(item, pathname);
              const count = badges?.[item.id] ?? 0;
              const text = badgeText(count);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="state-layer relative flex flex-col md:flex-row items-center gap-1 md:gap-3 flex-1 md:flex-none
                             min-w-16 md:w-full min-h-16 md:min-h-control px-1 py-2 md:px-3 md:py-0 rounded-lg no-underline
                             text-text-secondary hover:text-text-primary aria-[current=page]:bg-canvas
                             aria-[current=page]:font-semibold aria-[current=page]:text-text-primary
                             transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui) ease-out"
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      data-slot="nav-indicator"
                      className="absolute rounded-full bg-workspace-primary inset-x-3 top-0 h-1 md:inset-x-auto md:left-0 md:inset-y-2 md:h-auto md:w-1"
                    />
                  )}
                  <span className="relative flex size-8 flex-none items-center justify-center">
                    <Icon name={item.icon} filled={active} size={22} />
                    {text !== null && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1 -right-2 min-w-5 h-5 px-1 rounded-full border border-surface bg-danger-tint text-danger text-caption leading-4 font-semibold text-center"
                      >
                        {text}
                      </span>
                    )}
                  </span>
                  <span className="text-caption md:text-label whitespace-nowrap">
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
        <header className="h-16 flex-none flex items-center gap-2 px-4 md:px-6 bg-surface border-b border-divider z-[5]">
          <span className="text-subtitle text-text-primary whitespace-nowrap">
            {shellCopy.brand}
          </span>
          {session && (
            <>
              <span
                title={shellCopy.version.title(version)}
                className="flex-none whitespace-nowrap text-caption text-text-secondary"
              >
                {shellCopy.version.label(version)}
              </span>
              <Link
                href="/credits"
                aria-current={pathname === "/credits" ? "page" : undefined}
                className="inline-flex min-h-control min-w-control flex-none items-center justify-center whitespace-nowrap text-caption text-text-secondary underline hover:text-text-primary aria-[current=page]:text-text-primary"
              >
                {shellCopy.credits}
              </Link>
              <span className="ml-2 min-w-0 max-w-[40vw] truncate text-label text-text-secondary">
                {session.orgName}
              </span>
              {session.devToken && (
                <span
                  title={session.devToken.tooltip}
                  className={`inline-flex flex-none items-center whitespace-nowrap rounded-sm border px-2 text-caption font-semibold uppercase tracking-wide ${
                    session.devToken.prod
                      ? "border-danger bg-danger-tint text-danger"
                      : "border-warning bg-warning-tint text-warning"
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
          <div className="flex-none flex items-center gap-2 px-4 md:px-6 py-2 bg-surface border-b border-divider">
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
            <div className="page-content">
              <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <Icon name="login" size={36} className="text-text-secondary" />
                <h1 className="text-h2 font-semibold text-text-primary">
                  {shellCopy.signedOut.title}
                </h1>
                <p className="text-label text-text-secondary">{shellCopy.signedOut.body}</p>
                <Button disabled>{shellCopy.signedOut.signIn}</Button>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
