-- Enable Supabase Realtime postgres_changes broadcasts for the tables the
-- coach dashboard subscribes to live.
alter publication supabase_realtime add table profiles;
alter publication supabase_realtime add table workout_logs;
alter publication supabase_realtime add table measurements;
alter publication supabase_realtime add table prs;
alter publication supabase_realtime add table coach_notes;
