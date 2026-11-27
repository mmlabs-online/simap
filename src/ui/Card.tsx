import type { ReactNode } from "react";

/**
 * Brief card: radius-xl, surface, card shadow and a divider border; the border
 * darkens on hover when interactive.
 */
export function Card({
  children,
  className = "",
  interactive = false,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  as?: "div" | "section" | "article";
}) {
  return (
    <As
      className={[
        "rounded-xl border border-divider bg-surface shadow-card",
        interactive
          ? "transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui) ease-out hover:-translate-y-0.5 hover:border-border-strong"
          : "",
        className,
      ].join(" ")}
    >
      {children}
    </As>
  );
}
