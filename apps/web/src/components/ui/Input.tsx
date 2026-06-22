/**
 * §6.1 Input Anatomy
 *
 * Label always above field, never placeholder-only.
 * 48px min height, --radius-sm, --color-border default, --color-accent focus.
 * Never clear field on validation error.
 */
import { forwardRef, type InputHTMLAttributes } from "react";
import { clsx } from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className, ...props }, ref) => {
    const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, "-")}`;

    return (
      <div className="flex flex-col">
        <label
          htmlFor={inputId}
          className="mb-1 font-medium"
          style={{
            fontSize: "13px",
            lineHeight: "18px",
            letterSpacing: "0.1px",
            fontWeight: 500,
            color: "var(--color-text-secondary)",
          }}
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            "form-input",
            error && "error",
            className,
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            role="alert"
            style={{
              fontSize: "13px",
              lineHeight: "18px",
              letterSpacing: "0.1px",
              color: "var(--color-error)",
              marginTop: "var(--space-4)",
            }}
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export default Input;