drop policy if exists "cp5 images insert" on storage.objects;

create policy "cp5 images insert"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'cp5-images'
  and (storage.foldername(name))[1] in ('profiles', 'groups')
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);
