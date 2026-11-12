# Supabase setup

1. Create a Supabase project on the Free plan.
2. Open SQL Editor and run the migration in `migrations/202611120001_initial_cms.sql`.
3. In Authentication settings, disable **Allow new users to sign up**. Keep email/password sign-in enabled and require email confirmation.
4. Create/invite the first administrator in Authentication > Users.
5. Copy that user's UUID and run the bootstrap INSERT documented at the bottom of the migration.
6. Add the project URL and publishable key to GitHub Actions repository secrets/variables or Pages build environment as appropriate. The publishable key is public by design; never add secret/service_role keys to the frontend.
7. In API settings, confirm `public` is the intended exposed schema. Keep `private` out of exposed schemas.

The first admin is provisioned manually in SQL Editor. The browser cannot self-register as an admin.
