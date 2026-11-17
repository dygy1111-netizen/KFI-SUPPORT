-- Run in Supabase SQL Editor BEFORE merging the photo-size UI change.
-- Does not touch existing photographs, texts, review states, or publication flags.
begin;
alter table public.casebook_cases
  add column if not exists photo1_width_pct smallint not null default 100;
alter table public.casebook_cases
  add column if not exists photo2_width_pct smallint not null default 100;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.casebook_cases'::regclass
      and conname = 'casebook_photo1_width_range'
  ) then
    alter table public.casebook_cases
      add constraint casebook_photo1_width_range
      check (photo1_width_pct between 45 and 100);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.casebook_cases'::regclass
      and conname = 'casebook_photo2_width_range'
  ) then
    alter table public.casebook_cases
      add constraint casebook_photo2_width_range
      check (photo2_width_pct between 45 and 100);
  end if;
end
$$;
commit;
