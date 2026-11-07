-- ============================================================
-- 弘识智教 AIMOOC · 数据库结构
-- 在 Supabase 控制台 → SQL Editor 中执行本脚本
-- 需要的权限：所有表开启 RLS；学习数据按 user_id 隔离
-- ============================================================

-- ---------- 用户画像（用于后台统计与管理员判定） ----------
create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "profiles are self readable" on public.user_profiles;
create policy "profiles are self readable" on public.user_profiles
  for select using (auth.uid() = id);

-- ---------- 学习历史（历史页 / 进度页数据源） ----------
create table if not exists public.user_courses (
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id text not null,
  title text not null default '',
  subject text,
  url text,
  progress int not null default 0,
  duration_sec int not null default 0,
  quiz_right int not null default 0,
  quiz_total int not null default 0,
  last_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

alter table public.user_courses enable row level security;

drop policy if exists "courses are self managed" on public.user_courses;
create policy "courses are self managed" on public.user_courses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists user_courses_user_last_at_idx
  on public.user_courses (user_id, last_at desc);

-- ---------- 笔记 ----------
create table if not exists public.study_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id text not null,
  title text not null default '',
  content text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.study_notes enable row level security;

drop policy if exists "notes are self managed" on public.study_notes;
create policy "notes are self managed" on public.study_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists study_notes_user_updated_idx
  on public.study_notes (user_id, updated_at desc);

-- ---------- 学习事件（后台看板数据源，由服务端 service role 写入） ----------
create table if not exists public.study_events (
  id bigserial primary key,
  user_id uuid references auth.users (id) on delete set null,
  email text,
  video_id text,
  title text,
  subject text,
  kind text not null default 'session',
  duration_sec int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.study_events enable row level security;

-- 客户端不允许直接写入（服务端 service role 绕过 RLS 写入）
drop policy if exists "events are readable by owner" on public.study_events;
create policy "events are readable by owner" on public.study_events
  for select using (auth.uid() = user_id);

create index if not exists study_events_created_at_idx
  on public.study_events (created_at desc);

create index if not exists study_events_video_idx
  on public.study_events (video_id);

-- ---------- 管理员 ----------
-- 方式一：把邮箱写进环境变量 SUPABASE_ADMIN_EMAILS（逗号分隔）
-- 方式二：执行下面的 SQL，把某个账号提升为管理员
--   update public.user_profiles set role = 'admin' where email = 'you@example.com';
