"use client";
import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary: "bg-jcf-gold text-jcf-black hover:bg-jcf-goldLight font-semibold",
    secondary: "bg-jcf-panel text-white border border-white/15 hover:border-jcf-gold/60",
    ghost: "bg-transparent text-jcf-gray hover:text-white",
    danger: "bg-jcf-danger/90 text-white hover:bg-jcf-danger",
  };
  return (
    <button
      className={`px-4 py-2.5 rounded-sm uppercase tracking-wide text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
