import type { ReactNode } from "react";
import type { IconName } from "@/lib/icons";
import { Card } from "./Card";
import { Icon } from "./Icon";

/** A titled card: header with optional icon, adornment and aside, a body and an optional footer. Copy-free. */
export function SectionCard({
  headingId,
  title,
  subtitle,
  icon,
  titleAdornment,
  aside,
  footer,
  divided = true,
  className = "",
  children,
}: {
  headingId: string;
  title: string;
  subtitle?: string;
  icon?: IconName;
  titleAdornment?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  divided?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <section aria-labelledby={headingId}>
        <div
          className={[
            "flex items-start justify-between gap-3 p-4 sm:p-5",
            divided ? "border-b border-outline-variant" : "",
          ].join(" ")}
        >
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              {icon && <Icon name={icon} size={20} className="text-primary" />}
              <h3 id={headingId} className="text-base font-extrabold text-on-surface">
                {title}
              </h3>
              {titleAdornment}
            </div>
            {subtitle && <p className="text-xs text-on-surface-variant">{subtitle}</p>}
          </div>
          {aside}
        </div>
        <div className="p-4 sm:p-5">{children}</div>
        {footer && <div className="border-t border-outline-variant p-4 sm:p-5">{footer}</div>}
      </section>
    </Card>
  );
}
