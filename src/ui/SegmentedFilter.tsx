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
      className="inline-flex flex-wrap gap-0.5 rounded-xl bg-surface-high p-1"
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
              "min-h-11 cursor-pointer rounded-lg px-3 text-sm font-semibold font-[inherit] transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              active
                ? "bg-surface text-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
