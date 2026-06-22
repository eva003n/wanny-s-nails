interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ...rest
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={rest["aria-label"]}
      className="inline-flex rounded-[--radius-md] bg-surface-raised p-1"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`
            min-h-9 rounded-[--radius-sm] px-4 text-sm font-medium transition-colors
            ${value === opt.value ? "bg-surface text-text-primary shadow-[--shadow-card]" : "text-text-secondary"}
          `}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
