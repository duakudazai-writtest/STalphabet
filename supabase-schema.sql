-- String Alphabet: private online phrase dictionary
-- Run this in Supabase SQL Editor. Each account can access only its own rows.

create table if not exists public.personal_phrases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phrase_key text not null check (char_length(trim(phrase_key)) between 1 and 2000),
  phrase_key_normalized text not null check (char_length(trim(phrase_key_normalized)) between 1 and 2000),
  meaning text not null check (char_length(trim(meaning)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_phrases_user_phrase_unique unique (user_id, phrase_key_normalized)
);

alter table public.personal_phrases enable row level security;

drop policy if exists "Users can read their own phrases" on public.personal_phrases;
drop policy if exists "Users can insert their own phrases" on public.personal_phrases;
drop policy if exists "Users can update their own phrases" on public.personal_phrases;
drop policy if exists "Users can delete their own phrases" on public.personal_phrases;

create policy "Users can read their own phrases" on public.personal_phrases
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own phrases" on public.personal_phrases
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own phrases" on public.personal_phrases
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own phrases" on public.personal_phrases
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.personal_phrases to authenticated;
revoke all on public.personal_phrases from anon;
