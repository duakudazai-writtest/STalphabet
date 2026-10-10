-- Run if you have not already disabled public access to the old shared table.
drop policy if exists "Anyone can read shared phrases" on public.shared_phrases;
drop policy if exists "Anyone can add shared phrases" on public.shared_phrases;
revoke select, insert on public.shared_phrases from anon;
revoke select, insert, update, delete on public.shared_phrases from authenticated;
