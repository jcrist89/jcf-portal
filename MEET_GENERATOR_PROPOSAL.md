# Meet-Program Generator — Status & Proposal

## What exists today

`src/lib/meetPrep/generateProgram.ts` contains `generateMeetPrepProgram(input)` — a
complete, fairly sophisticated 13-week phase generator (`WEEK_PLAN`, lines ~36-245):
Accumulation (weeks 1-4) → Intensification (5-8) → Meet-Specific Peak (9-11) →
Opener Practice (12) → Taper (13), with per-week top-single percentages, RPE targets/
caps, wave/ramp sets, and accessory volume. It takes an athlete's 1RMs, a start/meet
date pair, free-text injury notes, and a `weaknesses: { bench: string[], deadlift:
string[] }` argument drawn from the same option lists (`weaknesses.ts`) the coach's
"Weaknesses" panel uses.

**It is never called from anywhere.** No route, page, or component imports or
invokes `generateMeetPrepProgram`. It's reachable only by direct code edit, not from
any coach workflow today. Two of its other exports (`phaseForWeek`,
`projectedTrainingMaxes`) *are* used elsewhere (joker eligibility, training-max
projections) — those aren't affected by anything below.

**The `weaknesses` parameter is accepted but never read inside the function body.**
Accessory exercise selection (`pick(pool, weekIdx)`, lines ~78-92 and ~162-179) rotates
through fixed pools (e.g. `BENCH_TRICEPS`, `DL_HAMSTRING`) purely by week index — a
client's selected weaknesses have zero effect on what the generator would produce, even
if it were wired up.

## Is anything misleading exposed to users right now?

No. The coach's live "Weaknesses" panel (`ClientDetailView.tsx`, the `WeaknessesPanel`
component) persists selected weaknesses to `programs.weaknesses` via `PATCH /api/
templates/[id]`, and its own on-screen copy is accurate about what it does: *"Reference
for accessory selection — edit exercises directly via Edit This Program."* It's
presented as a note for the coach to consult manually, not as an auto-generation input.
There's no unfinished button, no "Generate Program" control anywhere, no promise the UI
makes that the code doesn't keep. Nothing needed hiding or disabling.

## Why this wasn't wired up or deleted

Connecting the generator to a real "Generate Program" flow, or making `weaknesses`
actually influence its output, requires product/training-methodology decisions that
aren't mine to make:

1. **Should the coach be able to trigger generation at all**, or is hand-editing via
   the existing template editor the intended permanent workflow? (If the latter, the
   generator and the whole `weaknesses` plumbing could be removed outright — see below.)
2. **If generation should exist**, does a selected weakness *replace* an accessory
   in the fixed pool, *add* to it, *reorder* it, or *bias sets/reps*? The current pools
   (e.g. `BENCH_TRICEPS = [...]`) would need a real mapping from weakness key → exercise
   change, which is a training-methodology call (e.g. "weak off the chest" → which
   specific accessory addition is actually correct programming?), not something to
   infer from the existing code or invent here.
3. **Does generation happen once (at meet-prep setup) or regenerate on demand** as
   1RMs/weaknesses change mid-block? Regenerating over a client's in-progress, possibly
   coach-hand-edited program risks silently overwriting real edits — needs an explicit
   answer before any UI ships.

## Recommendation

Two honest options, both fine from a code-health standpoint since the function is
inert and costs nothing to leave as-is:

- **Keep it as a starting point.** It's a real, structured 13-week template that could
  save the coach time once the three decisions above are made. No action needed beyond
  this note.
- **Delete it** (`generateProgram.ts`'s `generateMeetPrepProgram` + the unused
  `weaknesses`/`injuryNotes` fields on `MeetPrepGeneratorInput`, keeping `phaseForWeek`/
  `projectedTrainingMaxes` since those are live) if there's no near-term plan to build
  the generation flow — reduces dead-code surface for future maintainers to trip over.

Neither was done here — this is exactly the kind of call the audit was told to defer
rather than assume. No training methodology was invented and no code was removed.
