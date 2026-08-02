-- Enable Realtime postgres_changes broadcasts for the meet-prep tables the
-- coach dashboard now subscribes to live (CoachOverview.tsx).
alter publication supabase_realtime add table joker_requests;
alter publication supabase_realtime add table readiness_checkins;
alter publication supabase_realtime add table deviation_reports;
