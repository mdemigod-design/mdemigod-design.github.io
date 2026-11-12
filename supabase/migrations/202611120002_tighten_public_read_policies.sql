-- Public visitors use anon; authenticated users are restricted to active admins.
-- This removes overlapping permissive SELECT policies for authenticated sessions.
drop policy media_assets_public_read on public.media_assets;
create policy media_assets_public_read on public.media_assets for select to anon using (is_public = true);

drop policy site_settings_public_read on public.site_settings;
create policy site_settings_public_read on public.site_settings for select to anon using (is_public = true);

drop policy pages_public_read on public.pages;
create policy pages_public_read on public.pages for select to anon
using (status = 'published' and published_at is not null and published_at <= now());

drop policy page_sections_public_read on public.page_sections;
create policy page_sections_public_read on public.page_sections for select to anon
using (is_visible = true and exists (
  select 1 from public.pages p
  where p.id = page_sections.page_id
    and p.status = 'published'
    and p.published_at is not null
    and p.published_at <= now()
));

drop policy director_profile_public_read on public.director_profile;
create policy director_profile_public_read on public.director_profile for select to anon using (true);

drop policy news_posts_public_read on public.news_posts;
create policy news_posts_public_read on public.news_posts for select to anon
using (status = 'published' and published_at is not null and published_at <= now());

drop policy events_public_read on public.events;
create policy events_public_read on public.events for select to anon
using (status = 'published' and published_at is not null and published_at <= now());

drop policy documents_public_read on public.documents;
create policy documents_public_read on public.documents for select to anon
using (is_public = true and published_at is not null and published_at <= now());

create index director_profile_portrait_asset_id_idx on public.director_profile(portrait_asset_id);
create index events_cover_asset_id_idx on public.events(cover_asset_id);
create index news_posts_cover_asset_id_idx on public.news_posts(cover_asset_id);
