
-- Disable RLS on realtime.messages - source table RLS already handles authorization
ALTER TABLE realtime.messages DISABLE ROW LEVEL SECURITY;
