import { forwardRef, type ReactNode, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  children: ReactNode;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, id, className = "", children, ...rest }, ref) => {
    const selectId = id ?? `select-${label.toLowerCase().replace(/\s+/g, "-")}`;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={selectId} className="text-sm font-medium text-text-primary">
          {label}
        </label>
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            aria-invalid={!!error}
            className={`
              w-full appearance-none bg-surface-raised border border-border rounded-[--radius-md]
              min-h-11 px-3 pr-9 text-base text-text-primary
              focus:border-primary focus:outline-none
              aria-[invalid=true]:border-error
              ${className}
            `}
            {...rest}
          >
            {children}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
        </div>
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  },
);

Select.displayName = "Select";
export default Select;
