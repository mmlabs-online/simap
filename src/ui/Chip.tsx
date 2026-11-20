import type { IconName } from "@/lib/icons";
import { Icon } from "./Icon";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

/**
 * MD3 segmented filter chips inside a tonal track. Selected chip fills with
 * primary. Rendered as a radiogroup for accessibility.
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
      className="flex items-center gap-0.5 rounded-full bg-surface-high border border-outline-variant p-[3px]"
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
              "state-layer inline-flex items-center gap-1.5 rounded-full px-4 py-2 cursor-pointer",
              "text-[13px] font-bold font-[inherit] transition-colors duration-150 ease-[cubic-bezier(0.2,0.7,0.2,1)]",
              active
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:text-on-surface",
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
      className="inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1 text-[11px] font-bold border border-outline-variant"
      style={{
        background: color ?? "var(--secondary-container)",
        color: onColor ?? "var(--on-secondary-container)",
      }}
    >
      {icon && <Icon name={icon} size={14} />}
      {label}
    </span>
  );
}
