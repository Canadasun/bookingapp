"use client";
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "outline";
type Size = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:     "bg-violet-600 text-white hover:bg-violet-700 shadow-md shadow-violet-200/70 disabled:bg-violet-300",
  secondary:   "bg-[#E6F4F3] text-[#0F6468] hover:bg-[#D4ECEA] border border-[#BFE2DF]",
  ghost:       "text-gray-600 hover:bg-violet-50 hover:text-violet-700",
  destructive: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
  outline:     "bg-white/90 text-gray-800 border border-[#E9DDCB] hover:bg-violet-50 hover:border-violet-200",
};

const sizeClasses: Record<Size, string> = {
  xs: "min-h-10 px-2.5 py-1 text-xs lg:min-h-0",
  sm: "min-h-10 px-3 py-1.5 text-sm lg:min-h-0",
  md: "min-h-11 px-4 py-2 text-sm lg:min-h-0",
  lg: "px-6 py-3 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-violet-500 focus-visible:outline-offset-2",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4A8 8 0 014 12z" />
        </svg>
      )}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
