import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { IconName } from "@/lib/icons";
import { Icon } from "./Icon";

type Variant = "filled" | "pixel" | "tonal" | "outlined" | "text" | "danger";
type Size = "sm" | "md" | "lg";

const TRANSITION =
  "transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui) ease-out";
const DISABLED = "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";

const variants: Record<Variant, string> = {
  // Primary (brief): workspace action fill, white text.
  filled: "bg-workspace-action text-on-action enabled:hover:bg-workspace-action-hover",
  // Pixel variant: pixel green with the pixel shadow (callers adopt it in slice 6).
  pixel: "bg-pixel-primary text-on-action shadow-pixel enabled:hover:bg-pixel-hover",
  // Secondary (brief): surface + 1px border.
  tonal: "bg-surface text-text-primary border border-border enabled:hover:border-border-strong",
  outlined: "bg-surface text-text-primary border border-border enabled:hover:border-border-strong",
  text: "bg-transparent text-text-primary",
  danger: "bg-danger-tint text-danger border border-danger/30",
};

const sizes: Record<Size, string> = {
  sm: "px-4",
  md: "px-5",
  lg: "min-h-12 px-6",
};

/**
 * Brief button: radius-lg, 44 px minimum height, Label type, currentColor state
 * layer. `filled` is the brief's primary, `tonal`/`outlined` its secondary.
 * `icon` renders a leading Material Symbol.
 */
export function Button({
  children,
  variant = "filled",
  size = "md",
  icon,
  iconFilled,
  fullWidth,
  className = "",
  type = "button",
  ...rest
}: {
  children?: ReactNode;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconFilled?: boolean;
  fullWidth?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={[
        "state-layer inline-flex items-center justify-center gap-2 rounded-lg min-h-control text-label",
        "whitespace-nowrap select-none cursor-pointer",
        TRANSITION,
        "enabled:active:scale-95",
        DISABLED,
        variants[variant],
        sizes[size],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      data-variant={variant}
      {...rest}
    >
      {icon && <Icon name={icon} filled={iconFilled} size={size === "lg" ? 20 : 18} />}
      {children}
    </button>
  );
}

/** Square 44 px icon-only button (top-bar / panel actions). `label` is required. */
export function IconButton({
  icon,
  iconFilled,
  label,
  active,
  className = "",
  ...rest
}: {
  icon: IconName;
  iconFilled?: boolean;
  label: string;
  active?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={[
        "state-layer inline-flex size-control flex-none items-center justify-center rounded-lg cursor-pointer",
        TRANSITION,
        "enabled:active:scale-95",
        DISABLED,
        active
          ? "bg-canvas text-text-primary border border-border"
          : "text-text-secondary enabled:hover:bg-canvas enabled:hover:text-text-primary",
        className,
      ].join(" ")}
      {...rest}
    >
      <Icon name={icon} filled={iconFilled} size={22} />
    </button>
  );
}
