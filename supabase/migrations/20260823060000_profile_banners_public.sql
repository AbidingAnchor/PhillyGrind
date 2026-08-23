-- Cover photos are loaded via /storage/v1/object/public/profile-banners/...
-- Production had the bucket marked private, so those URLs returned NoSuchBucket
-- even when the file existed. Match avatars: public bucket + public SELECT.

update storage.buckets
set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'profile-banners';

drop policy if exists "Profile banners are publicly accessible" on storage.objects;
create policy "Profile banners are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'profile-banners');
