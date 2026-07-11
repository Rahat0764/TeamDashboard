create table tournaments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  entry_fee numeric not null default 0,
  prize_pool jsonb default '[]',
  deadline timestamptz,
  status text default 'active',
  created_at timestamptz default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  name text not null,
  uid text not null,
  role text default 'main',
  avatar_url text,
  status text default 'pending',
  created_at timestamptz default now()
);

create table player_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  kills int default 0,
  assists int default 0,
  damage numeric default 0,
  survived_minutes numeric default 0,
  screenshot_url text,
  status text default 'pending',
  created_at timestamptz default now()
);

alter table payments add column if not exists tournament_id uuid references tournaments(id) on delete set null;
alter table payments add column if not exists calculated_fee numeric default 0;
alter table payments add column if not exists total_paid numeric default 0;

alter table tournaments enable row level security;
alter table players enable row level security;
alter table player_stats enable row level security;

create policy "public read tournaments" on tournaments for select using (true);
create policy "public read players" on players for select using (status = 'approved');
create policy "public read player_stats" on player_stats for select using (status = 'approved');
