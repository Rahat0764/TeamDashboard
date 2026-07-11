-- filepath: supabase-schema.sql
create extension if not exists "pgcrypto";

create table app_settings (
  id int primary key default 1,
  title text not null default 'QE SCRIM Dashboard',
  description text not null default 'Manage teams, standings, and payments all in one place.'
);
insert into app_settings (id) values (1) on conflict (id) do nothing;

create table teams (
  id uuid primary key default gen_random_uuid(),
  team_name text not null,
  manager_name text,
  manager_ign text,
  manager_contact text,
  main_players jsonb not null default '[]',
  reserve_players jsonb not null default '[]',
  slot_no int,
  created_at timestamptz default now()
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  match_no int not null,
  match_label text,
  created_at timestamptz default now()
);

create table match_results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  position int,
  kills int default 0,
  position_points int default 0,
  kill_points int default 0,
  total_points int generated always as (coalesce(position_points,0) + coalesce(kill_points,0)) stored,
  updated_at timestamptz default now(),
  unique(match_id, team_id)
);

create table point_settings (
  id int primary key default 1,
  kill_point_value numeric default 1,
  position_table jsonb not null default '{"1":10,"2":6,"3":5,"4":4,"5":3,"6":2,"7":1,"8":1}'
);
insert into point_settings (id) values (1) on conflict (id) do nothing;

create table payments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete set null,
  payer_name text,
  amount numeric not null,
  method text default 'bkash',
  trx_id text,
  sender_number text,
  screenshot_url text,
  status text default 'pending',
  verification_type text default 'manual',
  admin_note text,
  created_at timestamptz default now()
);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  ref_id text,
  action text,
  details text,
  created_at timestamptz default now()
);

create table bkash_numbers (
  id int primary key default 1,
  numbers jsonb not null default '[]'
);
insert into bkash_numbers (id) values (1) on conflict (id) do nothing;

alter table app_settings enable row level security;
alter table teams enable row level security;
alter table matches enable row level security;
alter table match_results enable row level security;
alter table point_settings enable row level security;
alter table payments enable row level security;
alter table activity_logs enable row level security;
alter table bkash_numbers enable row level security;

create policy "public read app_settings" on app_settings for select using (true);
create policy "public read teams" on teams for select using (true);
create policy "public read matches" on matches for select using (true);
create policy "public read match_results" on match_results for select using (true);
create policy "public read point_settings" on point_settings for select using (true);
create policy "public read payments" on payments for select using (true);
create policy "public read activity_logs" on activity_logs for select using (true);
create policy "public read bkash_numbers" on bkash_numbers for select using (true);