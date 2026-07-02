-- Run this in the Supabase SQL Editor

alter table calls add column if not exists agent_call_sid text;
