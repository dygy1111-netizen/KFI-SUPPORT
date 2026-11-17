-- KFI-SUPPORT: allow 1–4 photographs per case without changing earlier cases.
-- Safe to run more than once. No source photos or review states are touched.
begin;
alter table public.casebook_cases
  add column if not exists photo3_path text,
  add column if not exists photo4_path text,
  add column if not exists photo3_width_pct smallint not null default 100,
  add column if not exists photo4_width_pct smallint not null default 100,
  add column if not exists photo3_stretch_x_pct smallint not null default 100,
  add column if not exists photo4_stretch_x_pct smallint not null default 100;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.casebook_cases'::regclass and conname = 'casebook_photo3_width_range'
  ) then
    alter table public.casebook_cases
      add constraint casebook_photo3_width_range check (photo3_width_pct between 45 and 100);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.casebook_cases'::regclass and conname = 'casebook_photo4_width_range'
  ) then
    alter table public.casebook_cases
      add constraint casebook_photo4_width_range check (photo4_width_pct between 45 and 100);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.casebook_cases'::regclass and conname = 'casebook_photo3_stretch_range'
  ) then
    alter table public.casebook_cases
      add constraint casebook_photo3_stretch_range check (photo3_stretch_x_pct between 100 and 300);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.casebook_cases'::regclass and conname = 'casebook_photo4_stretch_range'
  ) then
    alter table public.casebook_cases
      add constraint casebook_photo4_stretch_range check (photo4_stretch_x_pct between 100 and 300);
  end if;
end
$$;
commit;
