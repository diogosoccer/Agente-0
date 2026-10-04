create table if not exists public.jarvis_missions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jarvis_tasks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jarvis_memories (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jarvis_executions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jarvis_approvals (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jarvis_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jarvis_opportunities (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jarvis_missions_user_updated_idx on public.jarvis_missions(user_id, updated_at desc);
create index if not exists jarvis_tasks_user_updated_idx on public.jarvis_tasks(user_id, updated_at desc);
create index if not exists jarvis_memories_user_updated_idx on public.jarvis_memories(user_id, updated_at desc);
create index if not exists jarvis_executions_user_updated_idx on public.jarvis_executions(user_id, updated_at desc);
create index if not exists jarvis_approvals_user_updated_idx on public.jarvis_approvals(user_id, updated_at desc);
create index if not exists jarvis_events_user_updated_idx on public.jarvis_events(user_id, updated_at desc);
create index if not exists jarvis_opportunities_user_updated_idx on public.jarvis_opportunities(user_id, updated_at desc);

do $$
declare
  t text;
begin
  foreach t in array array[
    'jarvis_missions','jarvis_tasks','jarvis_memories','jarvis_executions',
    'jarvis_approvals','jarvis_events','jarvis_opportunities'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "jarvis_owner_select" on public.%I', t);
    execute format('drop policy if exists "jarvis_owner_insert" on public.%I', t);
    execute format('drop policy if exists "jarvis_owner_update" on public.%I', t);
    execute format('drop policy if exists "jarvis_owner_delete" on public.%I', t);
    execute format('create policy "jarvis_owner_select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "jarvis_owner_insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "jarvis_owner_update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "jarvis_owner_delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
