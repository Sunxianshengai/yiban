import { sql } from './db'

/**
 * 幂等建表：第一次访问时创建，之后 no-op。
 * 表名统一加 yiban_ 前缀，避免和同一 Neon 库里其他集成的表冲突。
 */
let ready: Promise<void> | null = null

export function ensureSchema(): Promise<void> {
  if (!ready) ready = createTables()
  return ready
}

async function createTables() {
  const q = sql()
  await q`
    create table if not exists yiban_users (
      id            uuid primary key default gen_random_uuid(),
      email         text not null,
      email_lower   text not null unique,
      password_hash text not null,
      password_salt text not null,
      created_at    timestamptz not null default now()
    )
  `
  await q`
    create table if not exists yiban_sessions (
      token_hash text primary key,
      user_id    uuid not null references yiban_users(id) on delete cascade,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  `
  await q`create index if not exists yiban_sessions_user on yiban_sessions (user_id)`
  await q`
    create table if not exists yiban_entries (
      id              uuid primary key default gen_random_uuid(),
      user_id         uuid not null references yiban_users(id) on delete cascade,
      client_id       text not null,
      text            text not null default '',
      preview_text    text not null default '',
      timezone        text not null default 'UTC',
      date_of_journal timestamptz not null,
      date_modified   timestamptz not null,
      fields          jsonb not null default '{}'::jsonb,
      tags            jsonb not null default '[]'::jsonb,
      deleted_at      timestamptz,
      updated_at      timestamptz not null default now(),
      unique (user_id, client_id)
    )
  `
  await q`create index if not exists yiban_entries_user_updated on yiban_entries (user_id, updated_at)`
  await q`
    create table if not exists yiban_media (
      id              uuid primary key default gen_random_uuid(),
      user_id         uuid not null references yiban_users(id) on delete cascade,
      client_id       text not null,
      entry_client_id text not null,
      pathname        text not null,
      file_name       text not null,
      mime_type       text not null,
      size_bytes      bigint not null default 0,
      position        integer not null default 0,
      deleted_at      timestamptz,
      updated_at      timestamptz not null default now(),
      unique (user_id, client_id)
    )
  `
  await q`create index if not exists yiban_media_user_entry on yiban_media (user_id, entry_client_id)`
  await q`create index if not exists yiban_media_user_updated on yiban_media (user_id, updated_at)`
}
