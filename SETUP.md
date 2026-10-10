# String Alphabet — private online phrase dictionary

## What changed
- Phrase entries are stored in `public.personal_phrases`.
- Sign-in is required to read, add, update, or delete cloud phrases.
- Row Level Security ensures each authenticated user can access only rows whose `user_id` matches their account.
- The old `shared_phrases` table is not used by this version. Your earlier shared rows remain in that table but public read/insert access was revoked by the privacy script you ran. They are not automatically copied because their ownership may not be clear.

## Setup
1. Open `supabase-config.js` and set your Project URL and public publishable/anon key. Never put a database password or service-role/secret key in frontend code.
2. In Supabase SQL Editor, run the included `supabase-schema.sql` to create/configure `personal_phrases`.
3. In Supabase Authentication settings, enable Email sign-ups. Configure your site's allowed redirect URLs if email confirmation is enabled.
4. Serve the folder from a local web server or deploy it as a static website. For local testing, from this folder run `python -m http.server 8000` and visit `http://localhost:8000`.
5. Create an account or sign in. Your phrases should appear only while signed in to that account and sync across devices using the same account.

## Existing phrases
Existing entries in `shared_phrases` are intentionally not imported automatically. Since they were previously public, choose carefully before moving any into your private account. You can manually add them again after signing in, or import local browser entries using the import button (this import goes to your private account).

## Important
A public publishable key is designed for browser use only when Row Level Security is configured correctly. Do not share account passwords. The old shared table stays private to browser clients only if its public policies/grants were revoked as in `make-phrases-private.sql`.
