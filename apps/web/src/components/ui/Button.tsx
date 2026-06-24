/**
 * §6 Button Specification
 *
 * Three variants only: Primary, Secondary, Destructive.
 * Height: min-h-11 (44px), border-radius: --radius-lg (16px).
 * Font: font-semibold text-[1.0625rem] (17px).
 * Loading: replace label with 16px spinner, keep dimensions identical.
 * Disabled: opacity-50, cursor-not-allowed.
 * §10 Accessibility: min-h-11 minimum for touch targets.
 */
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  loading?: boolean;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", loading, fullWidth, className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          /* Base: all buttons */
          "inline-flex items-center justify-center font-semibold text-[1.0625rem]",
          "min-h-11 px-6 rounded-[--radius-lg]",
          "transition-colors duration-150",
          fullWidth && "w-full",
          variant === "primary" && [
            "w-full bg-primary text-white",
            "hover:bg-primary-dark active:scale-[0.98]",
          ],
          variant === "secondary" && [
            "bg-surface hover:bg-surface-raised",
            "border border-border text-primary",
          ],

          variant === "ghost" && [
            "w-full bg-transparent text-text-primary",
            "hover:bg-surface-raised active:scale-[0.98]",
          ],
          (disabled || loading) && "opacity-50 cursor-not-allowed",
          className,
        )}
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 animate-spin"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              opacity="0.25"
            />
            <path
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              fill="currentColor"
              opacity="0.75"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;