import type { ReactNode } from "react";

/**
 * MD3 tonal card: large radius, low tonal surface, hairline outline and soft
 * elevation on hover when interactive.
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
        "rounded-md3-lg border border-outline-variant bg-surface-low shadow-[var(--card-shadow)]",
        interactive
          ? "transition-[transform,box-shadow,border-color] duration-150 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:-translate-y-0.5 hover:border-outline hover:shadow-[var(--card-shadow-hover)]"
          : "",
        className,
      ].join(" ")}
    >
      {children}
    </As>
  );
}
