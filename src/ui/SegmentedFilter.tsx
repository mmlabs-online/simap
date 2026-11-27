/**
 * A segmented filter: a labelled group of toggle buttons, one pressed. Native buttons, so Tab and
 * Enter/Space work. Copy-free.
 */
export function SegmentedFilter<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-canvas p-1"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={[
              "min-h-control cursor-pointer rounded-lg border px-3 text-label",
              "transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui) ease-out",
              active
                ? "border-border-strong bg-surface text-text-primary shadow-card"
                : "border-transparent text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
