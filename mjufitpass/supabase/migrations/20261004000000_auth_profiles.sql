-- Step 1: profiles, staff allowlist, onboarding RPCs.

-- ---------------------------------------------------------------------------
-- Staff allowlist. Roles live here (keyed by email), never on profiles, so a
-- user can't grant themselves a role and staff can be added before first login.
-- ---------------------------------------------------------------------------
create type public.staff_role as enum ('staff', 'super_admin');

create table public.staff_members (
  email      text primary key check (email = lower(email)),
  role       public.staff_role not null default 'staff',
  created_at timestamptz not null default now()
);

-- No policies: only security definer functions and the service role touch it.
alter table public.staff_members enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user, created by trigger.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  student_id text unique check (student_id ~ '^[0-9]{8,10}$'),
  consent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;

-- Read own row only. No insert/update/delete policies: writes go through RPCs.
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Role of the caller, or null for students.
create function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select s.role
  from public.staff_members s
  where s.email = lower(auth.jwt() ->> 'email');
$$;

-- Idempotent: keeps the first consent timestamp.
create function public.accept_consent()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.profiles
  set consent_at = coalesce(consent_at, now())
  where id = auth.uid();

  if not found then
    raise exception 'profile_not_found';
  end if;
end;
$$;

-- Sets the student ID once. Duplicates surface as SQLSTATE 23505.
create function public.set_student_id(p_student_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id text := btrim(coalesce(p_student_id, ''));
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if v_student_id !~ '^[0-9]{8,10}$' then
    raise exception 'invalid_format';
  end if;

  select * into v_profile from public.profiles where id = auth.uid() for update;

  if v_profile.consent_at is null then
    raise exception 'consent_required';
  end if;

  if v_profile.student_id is not null then
    raise exception 'already_set';
  end if;

  update public.profiles set student_id = v_student_id where id = auth.uid();
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.current_staff_role() from public, anon;
revoke execute on function public.accept_consent() from public, anon;
revoke execute on function public.set_student_id(text) from public, anon;
grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.accept_consent() to authenticated;
grant execute on function public.set_student_id(text) to authenticated;
