-- Threads exercises.id through the program structures and workout logs that already
-- exist, so history joins on identity rather than on a display string.
--
-- Both rewrites are purely additive: an `exerciseId` key is merged into each existing
-- object with `||`, and every other key — name, sets, reps, rest, notes, liftKey,
-- percentOfTm, rpeCap, unit — is carried through untouched. Ordering is preserved
-- explicitly with WITH ORDINALITY, because jsonb_agg without an ORDER BY has no
-- guaranteed order and an exercise list that reshuffles is a corrupted program.
--
-- Structure and week objects are merged rather than rebuilt (`w.value || ...`) so keys
-- this migration doesn't know about survive it.

-- ── program structures ──────────────────────────────────────────────────────

update programs pr
set structure = pr.structure || jsonb_build_object('weeks', coalesce((
      select jsonb_agg(
               w.value || jsonb_build_object('days', coalesce((
                 select jsonb_agg(
                          d.value || jsonb_build_object('exercises', coalesce((
                            select jsonb_agg(
                                     case when e.id is null then ex.value
                                          else ex.value || jsonb_build_object('exerciseId', e.id)
                                     end
                                     order by ex.ordinality
                                   )
                            from jsonb_array_elements(d.value->'exercises')
                                   with ordinality as ex
                            left join exercises e on e.slug = slugify(ex.value->>'name')
                          ), '[]'::jsonb))
                          order by d.ordinality
                        )
                 from jsonb_array_elements(w.value->'days') with ordinality as d
               ), '[]'::jsonb))
               order by w.ordinality
             )
      from jsonb_array_elements(pr.structure->'weeks') with ordinality as w
    ), '[]'::jsonb)),
    updated_at = now()
where pr.structure ? 'weeks'
  and jsonb_typeof(pr.structure->'weeks') = 'array';

-- ── workout logs ────────────────────────────────────────────────────────────

update workout_logs wl
set exercises_completed = coalesce((
      select jsonb_agg(
               case when e.id is null then ex.value
                    else ex.value || jsonb_build_object('exerciseId', e.id)
               end
               order by ex.ordinality
             )
      from jsonb_array_elements(wl.exercises_completed) with ordinality as ex
      left join exercises e on e.slug = slugify(ex.value->>'name')
    ), '[]'::jsonb)
where jsonb_typeof(wl.exercises_completed) = 'array'
  and jsonb_array_length(wl.exercises_completed) > 0;
