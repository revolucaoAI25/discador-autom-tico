-- Run this in the Supabase SQL Editor

alter table contacts add column if not exists last_no_answer_date date;
