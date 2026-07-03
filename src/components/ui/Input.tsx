"use client";

import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-text-secondary">
            {label}
            {props.required && <span className="text-rose"> *</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "min-h-[44px] w-full rounded-lg border bg-slate-800/80 px-3.5 text-white",
            "placeholder:text-slate-500 placeholder:italic",
            "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg focus:ring-emerald",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-rose ring-1 ring-rose" : "border-white/10",
            className
          )}
          aria-invalid={!!error}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-rose">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-text-secondary">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="mb-1.5 block text-xs font-medium text-text-secondary">
            {label}
            {props.required && <span className="text-rose"> *</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "min-h-[44px] w-full rounded-lg border bg-slate-800/80 px-3.5 text-white",
            "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg focus:ring-emerald",
            error ? "border-rose ring-1 ring-rose" : "border-white/10",
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="mt-1 text-sm text-rose">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
