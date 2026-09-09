import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "danger";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}

const variants = { default: "primary", secondary: "secondary", ghost: "quiet", danger: "danger" };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className = "", variant = "default", size = "default", type = "button", isLoading, disabled, children, ...props }, ref,
) {
  return <button ref={ref} {...props} type={type} disabled={disabled || isLoading} aria-busy={isLoading || props["aria-busy"]}
    className={`button ${variants[variant]} button-${size} ${className}`}>
    {children}
  </button>;
});
