import { InputHTMLAttributes, forwardRef, useId } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string }>(
  function Input({ label, className = "", id, ...props }, ref) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs uppercase tracking-wider text-jcf-gray">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`bg-jcf-panel border border-white/15 rounded-sm px-3 py-2.5 text-white placeholder:text-jcf-gray/60 focus:outline-none focus:border-jcf-gold focus-visible:ring-2 focus-visible:ring-jcf-gold/80 ${className}`}
          {...props}
        />
      </div>
    );
  }
);
