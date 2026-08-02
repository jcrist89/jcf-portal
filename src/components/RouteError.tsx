"use client";

/** Shared route-level error boundary UI. Next.js requires each error.tsx to be
 * its own client component file — this is the presentational body they share. */
export function RouteError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center px-6 text-center gap-3" role="alert">
      <p className="text-jcf-danger text-sm font-semibold uppercase tracking-widest">Something went wrong</p>
      <p className="text-jcf-gray text-sm max-w-sm">
        This page hit an unexpected error. It&apos;s been logged — try again, or head back and retry in a moment.
      </p>
      <button
        onClick={reset}
        className="mt-2 bg-jcf-gold text-jcf-black uppercase text-xs font-semibold px-4 py-2 rounded-sm"
      >
        Try Again
      </button>
    </div>
  );
}
