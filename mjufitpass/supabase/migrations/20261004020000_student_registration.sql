-- Onboarding becomes a registration form: student ID, first/last name,
-- faculty and year. The faculty list lives in the app (src/lib/registration.ts);
-- the DB only checks shape so the list can change without a migration.

alter table public.profiles
  add column first_name    text check (char_length(first_name) between 1 and 100),
  add column last_name     text check (char_length(last_name) between 1 and 100),
  add column faculty       text check (char_length(faculty) between 1 and 100),
  add column year_of_study smallint check (year_of_study between 1 and 8),
  add column registered_at timestamptz,
  add constraint profiles_registered_complete check (
    registered_at is null
    or (student_id is not null and first_name is not null and last_name is not null
        and faculty is not null and year_of_study is not null)
  );

drop function public.set_student_id(text);

-- Registers the caller once. A student ID set before this migration stays
-- locked: it must match. Duplicate student IDs surface as SQLSTATE 23505.
create function public.register_student(
  p_student_id    text,
  p_first_name    text,
  p_last_name     text,
  p_faculty       text,
  p_year_of_study integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id text := btrim(coalesce(p_student_id, ''));
  v_first_name text := btrim(coalesce(p_first_name, ''));
  v_last_name  text := btrim(coalesce(p_last_name, ''));
  v_faculty    text := btrim(coalesce(p_faculty, ''));
  v_profile    public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if v_student_id !~ '^[0-9]{8,10}$' then
    raise exception 'invalid_student_id';
  end if;

  if char_length(v_first_name) not between 1 and 100
     or char_length(v_last_name) not between 1 and 100
     or char_length(v_faculty) not between 1 and 100
     or p_year_of_study is null or p_year_of_study not between 1 and 8 then
    raise exception 'invalid_input';
  end if;

  select * into v_profile from public.profiles where id = auth.uid() for update;

  if v_profile.consent_at is null then
    raise exception 'consent_required';
  end if;

  if v_profile.registered_at is not null then
    raise exception 'already_registered';
  end if;

  if v_profile.student_id is not null and v_profile.student_id <> v_student_id then
    raise exception 'student_id_locked';
  end if;

  update public.profiles
  set student_id    = v_student_id,
      first_name    = v_first_name,
      last_name     = v_last_name,
      faculty       = v_faculty,
      year_of_study = p_year_of_study,
      registered_at = now()
  where id = auth.uid();
end;
$$;

revoke execute on function public.register_student(text, text, text, text, integer) from public, anon;
grant execute on function public.register_student(text, text, text, text, integer) to authenticated;
