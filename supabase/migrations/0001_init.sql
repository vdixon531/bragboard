-- Bragboard schema. Run in the Supabase SQL editor, or `supabase db push`.

-- ---------- tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default 'New player' check (char_length(display_name) between 1 and 32),
  avatar text not null default '🦊' check (char_length(avatar) <= 16),
  color text not null default '#FF6B2C' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- Personal token the iOS Shortcut uses to post scores. Kept apart from profiles so
-- league-mates can read your profile without seeing your token.
create table if not exists public.share_tokens (
  user_id uuid primary key references public.profiles on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  invite_code text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  theme text not null default 'maptap',
  games text[] not null default array['maptap','krillion','wordle'],
  created_by uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.league_members (
  league_id uuid not null references public.leagues on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index if not exists league_members_user_idx on public.league_members (user_id);

-- One score per person, per game, per day. Scores belong to the person, not the league,
-- so one share counts in every league that plays that game.
create table if not exists public.scores (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  game_id text not null check (char_length(game_id) <= 32),
  day date not null,
  score numeric not null,
  points numeric not null check (points between 0 and 100),
  display text not null check (char_length(display) <= 40),
  failed boolean not null default false,
  puzzle text check (char_length(puzzle) <= 40),
  meta jsonb not null default '{}'::jsonb,
  raw text check (char_length(raw) <= 2000),
  source text not null default 'app' check (source in ('app','shortcut','manual')),
  created_at timestamptz not null default now(),
  unique (user_id, game_id, day)
);
create index if not exists scores_day_idx on public.scores (day, game_id);

-- ---------- helpers (security definer so policies don't recurse) ----------
create or replace function public.is_member(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from league_members where league_id = lid and user_id = auth.uid());
$$;

create or replace function public.shares_league(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from league_members a join league_members b on a.league_id = b.league_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- New auth user -> profile + share token
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id) values (new.id) on conflict do nothing;
  insert into share_tokens (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RPCs ----------
create or replace function public.create_league(p_name text, p_games text[], p_theme text)
returns public.leagues language plpgsql security definer set search_path = public as $$
declare l leagues;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if coalesce(array_length(p_games, 1), 0) = 0 then raise exception 'pick at least one game'; end if;
  insert into leagues (name, games, theme, created_by) values (trim(p_name), p_games, p_theme, auth.uid()) returning * into l;
  insert into league_members (league_id, user_id, role) values (l.id, auth.uid(), 'owner');
  return l;
end $$;

create or replace function public.join_league(p_code text)
returns public.leagues language plpgsql security definer set search_path = public as $$
declare l leagues;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into l from leagues where invite_code = upper(trim(p_code));
  if not found then raise exception 'No league with that code'; end if;
  insert into league_members (league_id, user_id) values (l.id, auth.uid()) on conflict do nothing;
  return l;
end $$;

-- Name + member count for an invite preview, without joining.
create or replace function public.peek_league(p_code text)
returns table (id uuid, name text, theme text, games text[], members bigint)
language sql stable security definer set search_path = public as $$
  select l.id, l.name, l.theme, l.games, (select count(*) from league_members m where m.league_id = l.id)
  from leagues l where l.invite_code = upper(trim(p_code));
$$;

create or replace function public.rotate_share_token() returns text
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  update share_tokens set token = replace(gen_random_uuid()::text, '-', ''), created_at = now()
  where user_id = auth.uid() returning token into t;
  return t;
end $$;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.share_tokens enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.scores enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_league(id));
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "token read own" on public.share_tokens;
create policy "token read own" on public.share_tokens for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "leagues read" on public.leagues;
create policy "leagues read" on public.leagues for select to authenticated using (public.is_member(id));
drop policy if exists "leagues owner update" on public.leagues;
create policy "leagues owner update" on public.leagues for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists "leagues owner delete" on public.leagues;
create policy "leagues owner delete" on public.leagues for delete to authenticated using (created_by = auth.uid());

drop policy if exists "members read" on public.league_members;
create policy "members read" on public.league_members for select to authenticated using (public.is_member(league_id));
drop policy if exists "members leave or kick" on public.league_members;
create policy "members leave or kick" on public.league_members for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.leagues l where l.id = league_id and l.created_by = auth.uid()));

drop policy if exists "scores read" on public.scores;
create policy "scores read" on public.scores for select to authenticated
  using (user_id = auth.uid() or public.shares_league(user_id));
drop policy if exists "scores insert own" on public.scores;
create policy "scores insert own" on public.scores for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "scores update own" on public.scores;
create policy "scores update own" on public.scores for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "scores delete own" on public.scores;
create policy "scores delete own" on public.scores for delete to authenticated using (user_id = auth.uid());

-- ---------- realtime ----------
do $$ begin
  alter publication supabase_realtime add table public.scores;
exception when duplicate_object then null; end $$;
