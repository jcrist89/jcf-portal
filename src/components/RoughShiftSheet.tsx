"use client";
import { Button } from "@/components/Button";
import {
  ROUGH_SHIFT_REASONS,
  REASON_LABELS,
  type RoughShiftReason,
  type ScalingPlan,
} from "@/domain/scaling";

/**
 * Rough Shift, in two steps: say what's going on, then see what today became.
 *
 * The reason is asked first and is not optional. Left as a single button, Rough Shift
 * would be the path of least resistance — one tap versus finishing a full session — and
 * everyone would take it every time, which destroys it as a signal. Asking for a reason
 * makes it a deliberate choice, and the reason is worth more to the coach than the fact:
 * five sessions scaled for "something hurts" is a different conversation from five
 * scaled for "no time".
 *
 * Nothing here apologises or congratulates. The client is having a bad day, not failing.
 */
export function RoughShiftSheet({
  plan,
  onPickReason,
  onApply,
  onCancel,
}: {
  plan: ScalingPlan | null;
  onPickReason: (reason: RoughShiftReason) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="bg-jcf-panel border border-jcf-gold/40 rounded-sm p-4 mb-6">
      <h2 className="font-display uppercase tracking-wide text-sm text-jcf-gold mb-1">
        Rough Shift
      </h2>

      {!plan ? (
        <>
          <p className="text-jcf-gray text-xs mb-4">
            What&apos;s going on today? This shapes what gets cut.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {ROUGH_SHIFT_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => onPickReason(reason)}
                className="px-3 py-2 rounded-sm text-xs uppercase tracking-wide border border-white/15 text-jcf-gray hover:border-jcf-gold hover:text-jcf-gold"
              >
                {REASON_LABELS[reason]}
              </button>
            ))}
          </div>
          <Button variant="secondary" onClick={onCancel} className="w-full">
            Never mind
          </Button>
        </>
      ) : (
        <>
          <p className="text-white text-sm mb-1">{plan.summary}</p>
          {plan.reason && (
            <p className="text-jcf-gray text-xs mb-3">
              Logged as: {REASON_LABELS[plan.reason].toLowerCase()}
            </p>
          )}

          {plan.safetyNote && (
            <p className="text-jcf-gold text-xs border border-jcf-gold/30 rounded-sm p-3 mb-3">
              {plan.safetyNote}
            </p>
          )}

          <ul className="flex flex-col gap-1 mb-4">
            {plan.exercises.map((e, i) => (
              <li
                key={i}
                className={`flex items-baseline justify-between gap-3 text-xs ${
                  e.action === "drop" ? "text-jcf-gray line-through" : "text-white"
                }`}
              >
                <span className="truncate">{e.source.name}</span>
                <span className="shrink-0 text-jcf-gray">{e.note}</span>
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={onCancel} className="flex-1">
              Do the full session
            </Button>
            <Button onClick={onApply} className="flex-1">
              Use this
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
