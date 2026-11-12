-- Initial CMS schema for the Director Website.
-- Apply in Supabase SQL Editor as the project owner.
-- Do not add credentials, secret keys, or private personal data to public settings.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function private.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.is_active = true
  );
$$;

revoke all on function private.is_active_admin() from public, anon, authenticated;
grant execute on function private.is_active_admin() to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text not null,
  public_url text not null,
  mime_type text,
  alt_text text not null default '',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_assets_drive_file_id_unique unique (drive_file_id)
);

create table if not exists public.site_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null default '',
  seo_title text not null default '',
  seo_description text not null default '',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.page_sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  section_key text not null,
  heading text not null default '',
  content jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_id, section_key)
);

create table if not exists public.director_profile (
  id smallint primary key default 1 check (id = 1),
  full_name text not null default '',
  position text not null default 'ผู้อำนวยการโรงเรียน',
  biography text not null default '',
  portrait_asset_id uuid references public.media_assets(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  body jsonb not null default '{}'::jsonb,
  category text not null default 'ข่าวประชาสัมพันธ์',
  cover_asset_id uuid references public.media_assets(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  location text not null default '',
  cover_asset_id uuid references public.media_assets(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_valid_time check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default 'เอกสารทั่วไป',
  drive_file_id text not null,
  public_url text not null,
  mime_type text,
  is_public boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists page_sections_page_order_idx on public.page_sections(page_id, sort_order);
create index if not exists pages_publication_idx on public.pages(status, published_at);
create index if not exists news_posts_publication_idx on public.news_posts(status, published_at desc);
create index if not exists events_publication_idx on public.events(status, starts_at);
create index if not exists media_assets_public_idx on public.media_assets(is_public);
create index if not exists documents_public_idx on public.documents(is_public, published_at desc);

-- Updated-at triggers
do $$
declare t text;
begin
  foreach t in array array['media_assets','pages','page_sections','director_profile','news_posts','events','documents'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t);
  end loop;
end;
$$;

drop trigger if exists set_updated_at on public.site_settings;
create trigger set_updated_at before update on public.site_settings
for each row execute function private.set_updated_at();

-- Enable RLS on every public table.
alter table public.admin_users enable row level security;
alter table public.media_assets enable row level security;
alter table public.site_settings enable row level security;
alter table public.pages enable row level security;
alter table public.page_sections enable row level security;
alter table public.director_profile enable row level security;
alter table public.news_posts enable row level security;
alter table public.events enable row level security;
alter table public.documents enable row level security;

-- Explicit grants: RLS policies do not replace SQL privileges.
revoke all on table public.admin_users, public.media_assets, public.site_settings,
  public.pages, public.page_sections, public.director_profile,
  public.news_posts, public.events, public.documents from anon, authenticated;

grant select on table public.media_assets, public.site_settings, public.pages,
  public.page_sections, public.director_profile, public.news_posts,
  public.events, public.documents to anon, authenticated;

grant insert, update, delete on table public.media_assets, public.site_settings,
  public.pages, public.page_sections, public.director_profile,
  public.news_posts, public.events, public.documents to authenticated;

grant select on table public.admin_users to authenticated;

-- Public can read only approved/public records.
create policy media_assets_public_read on public.media_assets
for select to anon, authenticated using (is_public = true);
create policy site_settings_public_read on public.site_settings
for select to anon, authenticated using (is_public = true);
create policy pages_public_read on public.pages
for select to anon, authenticated
using (status = 'published' and published_at is not null and published_at <= now());
create policy page_sections_public_read on public.page_sections
for select to anon, authenticated
using (
  is_visible = true and exists (
    select 1 from public.pages p
    where p.id = page_sections.page_id
      and p.status = 'published'
      and p.published_at is not null
      and p.published_at <= now()
  )
);
create policy director_profile_public_read on public.director_profile
for select to anon, authenticated using (true);
create policy news_posts_public_read on public.news_posts
for select to anon, authenticated
using (status = 'published' and published_at is not null and published_at <= now());
create policy events_public_read on public.events
for select to anon, authenticated
using (status = 'published' and published_at is not null and published_at <= now());
create policy documents_public_read on public.documents
for select to anon, authenticated using (is_public = true and published_at is not null and published_at <= now());

-- Admin read/write policies. The helper is in a non-exposed schema and has a pinned empty search_path.
create policy admin_users_read_self on public.admin_users
for select to authenticated using (user_id = (select auth.uid()));

create policy media_assets_admin_all on public.media_assets
for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));
create policy site_settings_admin_all on public.site_settings
for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));
create policy pages_admin_all on public.pages
for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));
create policy page_sections_admin_all on public.page_sections
for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));
create policy director_profile_admin_all on public.director_profile
for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));
create policy news_posts_admin_all on public.news_posts
for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));
create policy events_admin_all on public.events
for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));
create policy documents_admin_all on public.documents
for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

-- First-admin bootstrap (run manually after creating the first Auth user):
-- 1) In Supabase Dashboard > Authentication > Users, create/invite the intended admin user.
-- 2) Copy that user's UUID.
-- 3) Run the following in SQL Editor, replacing the UUID:
-- insert into public.admin_users (user_id) values ('00000000-0000-0000-0000-000000000000');
--
-- Do not grant the browser INSERT/UPDATE/DELETE on admin_users. Add or deactivate admins
-- through SQL Editor until a separately secured admin-management workflow is implemented.
