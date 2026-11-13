create table if not exists public.best_practices (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null,
  title text not null,
  details jsonb not null default '{}'::jsonb,
  pdf_file_id text,
  image_file_id text,
  image_url text not null default '',
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.best_practices enable row level security;
grant select on public.best_practices to anon, authenticated;
grant insert, update, delete on public.best_practices to authenticated;
drop policy if exists "Public can view published best practices" on public.best_practices;
create policy "Public can view published best practices"
on public.best_practices for select to anon, authenticated
using (status = 'published' and published_at is not null and published_at <= now());
drop policy if exists "Admins can manage best practices" on public.best_practices;
create policy "Admins can manage best practices"
on public.best_practices for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));