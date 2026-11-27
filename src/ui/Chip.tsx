import type { IconName } from "@/lib/icons";
import { Icon } from "./Icon";

const TRANSITION =
  "transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui) ease-out";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

/**
 * Segmented filter chips inside a canvas track. Selected chip fills with
 * the workspace action colour. Rendered as a radiogroup for accessibility.
 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex items-center gap-1 rounded-lg border border-border bg-canvas p-1"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={[
              "state-layer inline-flex min-h-control items-center gap-2 rounded-md px-4 text-label cursor-pointer",
              TRANSITION,
              active
                ? "bg-workspace-action text-on-action"
                : "text-text-secondary enabled:hover:text-text-primary",
            ].join(" ")}
          >
            {opt.icon && <Icon name={opt.icon} size={16} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** A static, non-interactive label chip (group / project tags). */
export function Chip({
  label,
  icon,
  color,
  onColor,
}: {
  label: string;
  icon?: IconName;
  color?: string;
  onColor?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-divider px-2 py-1 text-caption font-medium"
      style={{
        background: color ?? "var(--color-canvas)",
        color: onColor ?? "var(--color-text-primary)",
      }}
    >
      {icon && <Icon name={icon} size={14} />}
      {label}
    </span>
  );
}

const PILL_TONES = {
  accent: "bg-workspace-action text-on-action",
  neutral: "bg-canvas text-text-secondary",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
  info: "bg-info-tint text-info",
} as const;

/** A small rounded label. `decorative` hides it from assistive tech. */
export function Pill({
  label,
  tone = "neutral",
  icon,
  decorative,
  dot,
}: {
  label: string;
  tone?: keyof typeof PILL_TONES;
  icon?: IconName;
  decorative?: boolean;
  /** A decorative dot before the label. */
  dot?: boolean;
}) {
  return (
    <span
      aria-hidden={decorative ? true : undefined}
      className={`inline-flex items-center gap-1 rounded-full px-2 text-caption font-medium ${PILL_TONES[tone]}`}
    >
      {dot && <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
      {icon && <Icon name={icon} size={12} />}
      {label}
    </span>
  );
}
