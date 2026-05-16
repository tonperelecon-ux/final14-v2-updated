create extension if not exists pgcrypto;

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null default 'Session',
  host_name text not null default 'Admin',
  duration_seconds int not null default 600,
  timer_started_at timestamptz,
  status text not null default 'waiting',
  created_at timestamptz default now()
);

create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  title text not null,
  position int not null default 0,
  list text not null default 'pool',
  added_by text not null default 'admin',
  created_at timestamptz default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  pseudo text not null,
  joined_at timestamptz default now()
);

alter table sessions disable row level security;
alter table tracks disable row level security;
alter table players disable row level security;

do $$ begin
  alter publication supabase_realtime add table sessions;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table tracks;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table players;
exception when duplicate_object then null; end $$;
