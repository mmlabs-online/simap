import type { ReactNode } from "react";

/** Page or section header: title, optional subtitle and a right-aligned aside. Copy-free. */
export function PageHeader({
  title,
  subtitle,
  aside,
  titleAdornment,
  level = 2,
  id,
}: {
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  titleAdornment?: ReactNode;
  level?: 2 | 3;
  id?: string;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Heading id={id} className="text-xl font-extrabold text-on-surface">
            {title}
          </Heading>
          {titleAdornment}
        </div>
        {subtitle && <p className="text-sm text-on-surface-variant">{subtitle}</p>}
      </div>
      {aside && <div className="sm:ml-auto">{aside}</div>}
    </div>
  );
}
