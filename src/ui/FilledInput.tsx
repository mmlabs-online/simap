import type { InputHTMLAttributes } from "react";
import type { IconName } from "@/lib/icons";
import { Icon } from "./Icon";

/**
 * Brief text field with a leading icon: surface, strong border, radius-lg.
 * The focus ring sits on the whole box (`.field-box`).
 */
export function FilledInput({
  icon = "search",
  trailingIcon,
  className = "",
  id,
  "aria-label": ariaLabel,
  ...rest
}: { icon?: IconName; trailingIcon?: IconName } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div
      className={[
        "field-box group flex h-12 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4",
        "transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui) ease-out",
        className,
      ].join(" ")}
    >
      <Icon name={icon} size={20} className="text-text-secondary" />
      <input
        id={id}
        aria-label={ariaLabel}
        className="flex-1 min-w-0 bg-transparent outline-none text-label text-text-primary placeholder:text-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
        {...rest}
      />
      {trailingIcon && <Icon name={trailingIcon} size={18} className="text-text-secondary" />}
    </div>
  );
}
