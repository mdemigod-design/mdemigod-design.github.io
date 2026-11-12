-- Additive content tables for the director website.
-- Existing CMS tables and records are intentionally left unchanged.

create table if not exists public.performance_agreements (
  id uuid primary key default gen_random_uuid(),
  section_type text not null check (section_type in ('standard_position', 'challenging_issue')),
  title text not null,
  summary text not null default '',
  content jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists performance_agreements_public_order_idx
  on public.performance_agreements(section_type, status, sort_order, published_at desc);

create table if not exists public.management_models (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null default '',
  content jsonb not null default '{}'::jsonb,
  image_url text not null default '',
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists management_models_public_order_idx
  on public.management_models(status, sort_order, published_at desc);

create table if not exists public.activity_gallery (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  image_url text not null,
  alt_text text not null default '',
  activity_date date,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists activity_gallery_public_order_idx
  on public.activity_gallery(status, activity_date desc, sort_order);

alter table public.performance_agreements enable row level security;
alter table public.management_models enable row level security;
alter table public.activity_gallery enable row level security;

drop policy if exists performance_agreements_admin_all on public.performance_agreements;
create policy performance_agreements_admin_all on public.performance_agreements
  for all to authenticated
  using ((select private.is_active_admin()))
  with check ((select private.is_active_admin()));
drop policy if exists performance_agreements_public_read on public.performance_agreements;
create policy performance_agreements_public_read on public.performance_agreements
  for select to anon, authenticated
  using (status = 'published' and published_at is not null and published_at <= now());

drop policy if exists management_models_admin_all on public.management_models;
create policy management_models_admin_all on public.management_models
  for all to authenticated
  using ((select private.is_active_admin()))
  with check ((select private.is_active_admin()));
drop policy if exists management_models_public_read on public.management_models;
create policy management_models_public_read on public.management_models
  for select to anon, authenticated
  using (status = 'published' and published_at is not null and published_at <= now());

drop policy if exists activity_gallery_admin_all on public.activity_gallery;
create policy activity_gallery_admin_all on public.activity_gallery
  for all to authenticated
  using ((select private.is_active_admin()))
  with check ((select private.is_active_admin()));
drop policy if exists activity_gallery_public_read on public.activity_gallery;
create policy activity_gallery_public_read on public.activity_gallery
  for select to anon, authenticated
  using (status = 'published' and published_at is not null and published_at <= now());

grant select on public.performance_agreements, public.management_models, public.activity_gallery to anon, authenticated;
grant insert, update, delete on public.performance_agreements, public.management_models, public.activity_gallery to authenticated;
