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

-- 仅允许本人插入自己的画像，且 role 固定为 'user'：注册时无法把自己写成 admin。
-- 刻意不提供 UPDATE policy，客户端无法自行提权。
drop policy if exists "profiles are self insertable" on public.user_profiles;
create policy "profiles are self insertable" on public.user_profiles
  for insert with check (auth.uid() = id and role = 'user');

-- 邮箱大小写无关唯一，避免同一邮箱产生多条画像；NULL 邮箱互不冲突
create unique index if not exists user_profiles_email_unique_idx
  on public.user_profiles (lower(email));

-- 最近活跃时间索引，便于按 last_seen_at 统计活跃用户
create index if not exists user_profiles_last_seen_at_idx
  on public.user_profiles (last_seen_at desc);

-- 新用户注册后自动写入画像，避免「有登录态但无 user_profiles 行」导致
-- 管理员判定与统计落空。SECURITY DEFINER 绕过 RLS 写入，role 固定 'user'。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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
-- 方式二：在 Supabase SQL Editor（service role 权限）执行下面的 SQL 提升管理员：
--   update public.user_profiles set role = 'admin' where email = 'you@example.com';
-- 注意：user_profiles 没有给客户端 UPDATE policy，浏览器端无法自行把 role 改成 admin；
--       提升管理员只能由 service role 或数据库 SQL 执行，避免越权提权。

-- ---------- 后台看板聚合函数 ----------
-- 由 /api/admin/stats 通过 service role 调用，在数据库端完成聚合，返回统计 JSON，
-- 避免把最多 5000 行 study_events 拉进应用层内存。
-- SECURITY DEFINER：以函数属主权限读取全表（绕过 RLS）；固定 search_path 防劫持。
-- 仅授权 service_role；anon / authenticated 一律不可执行，避免越权读取全站数据。
create or replace function public.admin_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  days int := 14;
  result jsonb;
begin
  with events as (
    select user_id, video_id, title, subject, duration_sec, created_at
    from public.study_events
    where created_at >= (now() - make_interval(days => days))
  ),
  totals as (
    select
      count(*)::int as sessions,
      coalesce(sum(duration_sec), 0)::bigint as total_sec,
      count(distinct user_id) filter (
        where (created_at at time zone 'utc')::date = (now() at time zone 'utc')::date
      )::int as today_active
    from events
  ),
  day_series as (
    select g.day::date as day
    from generate_series(
      (now() at time zone 'utc')::date - (days - 1),
      (now() at time zone 'utc')::date,
      interval '1 day'
    ) as g(day)
  ),
  daily as (
    select d.day, coalesce(sum(e.duration_sec), 0)::bigint as sec
    from day_series d
    left join events e on (e.created_at at time zone 'utc')::date = d.day
    group by d.day
  ),
  dau as (
    select d.day, count(distinct e.user_id)::int as users
    from day_series d
    left join events e on (e.created_at at time zone 'utc')::date = d.day
    group by d.day
  ),
  top_content as (
    select
      coalesce(nullif(max(title), ''), max(video_id), '未知课程') as label,
      round(sum(duration_sec) / 60.0)::int as value,
      count(*)::int as cnt,
      coalesce(nullif(max(subject), ''), '') as subject
    from events
    where video_id is not null
    group by video_id
  ),
  subjects as (
    select
      coalesce(nullif(subject, ''), '未分类') as label,
      round(sum(duration_sec) / 60.0)::int as value
    from events
    group by coalesce(nullif(subject, ''), '未分类')
  ),
  user_count as (
    select count(*)::int as n from public.user_profiles
  )
  select jsonb_build_object(
    'users', (select n from user_count),
    'sessions', (select sessions from totals),
    'total_sec', (select total_sec from totals),
    'total_hours', round((select total_sec from totals) / 3600.0, 1),
    'avg_session_min', case
      when (select sessions from totals) > 0
      then round(((select total_sec from totals) / 60.0) / (select sessions from totals), 1)
      else 0 end,
    'today_active', (select today_active from totals),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', to_char(d.day, 'FMMM/FMDD'),
        'value', round(d.sec / 60.0)::int
      ) order by d.day)
      from daily d
    ), '[]'::jsonb),
    'dau', coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', to_char(d.day, 'FMMM/FMDD'),
        'value', d.users
      ) order by d.day)
      from dau d
    ), '[]'::jsonb),
    'top_content', coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', t.label,
        'value', t.value,
        'sub', case when t.subject <> ''
          then t.subject || ' · ' || t.cnt || ' 次学习'
          else t.cnt || ' 次学习' end
      ) order by t.value desc)
      from (select * from top_content order by value desc limit 10) t
    ), '[]'::jsonb),
    'subjects', coalesce((
      select jsonb_agg(jsonb_build_object('label', s.label, 'value', s.value) order by s.value desc)
      from subjects s
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_stats() from public, anon, authenticated;
grant execute on function public.admin_stats() to service_role;
