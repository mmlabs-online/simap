import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { IconName } from "@/lib/icons";
import { Icon } from "./Icon";

type Variant = "filled" | "tonal" | "outlined" | "text" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  // Primary CTA = solid pill; hover lifts with a soft shadow.
  filled: "bg-primary text-on-primary hover:shadow-[0_6px_18px_var(--shadow-strong)]",
  // Secondary = surface pill + hairline border.
  tonal: "bg-surface text-on-surface border border-outline-variant hover:border-outline",
  outlined: "bg-surface text-on-surface border border-outline-variant hover:border-outline",
  text: "bg-transparent text-on-surface hover:text-primary",
  danger: "bg-error-container text-on-error-container border border-error/30",
};

const sizes: Record<Size, string> = {
  sm: "text-[13px] px-4 py-2 gap-1.5",
  md: "text-sm px-5 py-2.5 gap-2",
  lg: "text-[15px] px-6 py-3.5 gap-2",
};

/**
 * MD3 pill button with a currentColor state layer, active press-scale and
 * emphasized easing. `icon` renders a leading Material Symbol.
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
        "state-layer inline-flex items-center justify-center rounded-full font-bold cursor-pointer",
        "font-[inherit] whitespace-nowrap select-none",
        "transition-[transform,box-shadow,border-color] duration-150 ease-[cubic-bezier(0.2,0.7,0.2,1)]",
        "active:scale-95 disabled:opacity-40 disabled:pointer-events-none",
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

/** Circular icon-only button (top-bar / panel actions). `label` is required. */
export function IconButton({
  icon,
  iconFilled,
  label,
  size = 44,
  active,
  className = "",
  ...rest
}: {
  icon: IconName;
  iconFilled?: boolean;
  label: string;
  size?: number;
  active?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={[
        "state-layer inline-flex items-center justify-center rounded-full cursor-pointer flex-none",
        "transition-[transform,filter] duration-150 ease-[cubic-bezier(0.2,0.7,0.2,1)] active:scale-95",
        "disabled:opacity-40 disabled:pointer-events-none",
        active
          ? "bg-surface-high text-on-surface border border-outline-variant"
          : "text-on-surface-variant hover:text-on-surface hover:bg-surface-high",
        className,
      ].join(" ")}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} filled={iconFilled} size={22} />
    </button>
  );
}
