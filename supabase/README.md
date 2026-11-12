# Supabase setup

## Connected project

- Project: `director-website-cms`
- Project ref: `njcyivxrtfxrppfyodip`
- Region: Singapore (`ap-southeast-1`)
- Project URL: `https://njcyivxrtfxrppfyodip.supabase.co`
- Plan selected at creation: Free

## Database status

The initial schema and policy-hardening migrations have already been applied to the connected project:

- `202611120001_initial_cms.sql`
- `202611120002_tighten_public_read_policies.sql`

The database currently contains 9 public tables. All 9 have Row Level Security enabled, with 17 policies. Supabase Security Advisor returned no security lint findings at the time of verification.

## Create the first administrator

This is a single-admin CMS. Public self-registration must remain disabled.

1. Open [Supabase Authentication Users](https://supabase.com/dashboard/project/njcyivxrtfxrppfyodip/auth/users).
2. Under Authentication settings, keep Email provider enabled and turn **Allow new users to sign up** off.
3. Create/invite the intended administrator account from Authentication > Users.
4. Verify the email if the project requires confirmation.
5. Copy the new user's UUID from the Users list.
6. Open [SQL Editor](https://supabase.com/dashboard/project/njcyivxrtfxrppfyodip/sql/new) and run the statement below, replacing the placeholder UUID:

```sql
insert into public.admin_users (user_id)
values ('00000000-0000-0000-0000-000000000000');
```

The browser cannot insert or modify administrator membership. Add/deactivate admin users only through the Supabase Dashboard SQL Editor.

## Security notes

- The frontend uses the project's URL and a publishable key only. Publishable keys are designed for browser use; never put a Supabase secret or service_role key in GitHub or frontend code.
- The `private` schema must not be added to the Data API exposed schemas.
- Public visitors can read only published pages/news/events and approved public documents/media. Authenticated users must have an active row in `admin_users` to edit CMS data.
- Google Drive files are not uploaded by the CMS. Store only Drive file IDs, share URLs, and metadata; publish only files approved for public access.
