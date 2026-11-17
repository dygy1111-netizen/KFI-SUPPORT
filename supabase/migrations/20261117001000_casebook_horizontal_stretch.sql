-- KFI-SUPPORT: photo horizontal stretch, 100% = original aspect ratio.
-- Backward-compatible, idempotent and does not modify any existing photo.
begin;
alter table public.casebook_cases
  add column if not exists photo1_stretch_x_pct smallint not null default 100;
alter table public.casebook_cases
  add column if not exists photo2_stretch_x_pct smallint not null default 100;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.casebook_cases'::regclass
      and conname = 'casebook_photo1_stretch_x_range'
  ) then
    alter table public.casebook_cases
      add constraint casebook_photo1_stretch_x_range
      check (photo1_stretch_x_pct between 100 and 300);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.casebook_cases'::regclass
      and conname = 'casebook_photo2_stretch_x_range'
  ) then
    alter table public.casebook_cases
      add constraint casebook_photo2_stretch_x_range
      check (photo2_stretch_x_pct between 100 and 300);
  end if;
end
$$;
commit;
