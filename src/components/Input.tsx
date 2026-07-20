import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string }>(
  function Input({ label, className = "", id, ...props }, ref) {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-xs uppercase tracking-wider text-jcf-gray">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`bg-jcf-panel border border-white/15 rounded-sm px-3 py-2.5 text-white placeholder:text-jcf-gray/60 focus:outline-none focus:border-jcf-gold ${className}`}
          {...props}
        />
      </div>
    );
  }
);
