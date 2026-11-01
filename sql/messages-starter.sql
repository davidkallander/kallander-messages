-- Messages starter for a new CRM (kallander-messages). Copy this into the CRM's own numbered SQL files and change
-- the names marked CHANGE. Ranger Ops (supabase/sql/110–115) and the Legacy CRM (supabase/040–042) are worked examples.
-- Safe to re-run.

-- Every text, email and call, in or out. conversation_key is who it's with: the customer or family it's matched to,
-- else something about the sender (their phone or email) so nothing is lost before it's matched.
create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_key text not null,
  record_id        uuid,                         -- CHANGE: references public.customers(id) on delete set null
  channel          text not null default 'sms',  -- sms, email, call, note…
  direction        text not null check (direction in ('in', 'out')),
  subject          text not null default '',
  body             text not null default '',
  status           text not null default 'sent', -- sending, sent, failed
  error            text not null default '',
  automatic        boolean not null default false,
  sent_by          text not null default '',
  sent_at          timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index if not exists messages_conversation on public.messages (conversation_key, sent_at desc);
create index if not exists messages_recent on public.messages (sent_at desc);
alter table public.messages enable row level security;
drop policy if exists messages_read on public.messages;
-- CHANGE: whoever may read messages in this CRM (staff only, never the public)
create policy messages_read on public.messages for select to authenticated using (public.is_member());

-- The marks on a conversation, shared by everyone: read, Done (no reply needed), Mark unread (a reminder).
create table if not exists public.message_states (
  conversation_key text primary key,
  read_at          timestamptz,
  done_at          timestamptz,
  unread_at        timestamptz,
  updated_by       text,
  updated_at       timestamptz not null default now()
);
alter table public.message_states enable row level security;
drop policy if exists message_states_read on public.message_states;
create policy message_states_read on public.message_states for select to authenticated using (public.is_member()); -- CHANGE

-- Read / unread / done / undone. Done marks it read; Mark unread takes Done off; Mark read clears Mark unread.
create or replace function public.mark_conversation(p_key text, p_what text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'not_allowed'; end if; -- CHANGE: who may mark (not viewers)
  if p_what not in ('read', 'done', 'unread', 'undone') then raise exception 'unknown'; end if;
  insert into public.message_states (conversation_key, read_at, done_at, unread_at, updated_by, updated_at)
  values (p_key, case when p_what in ('read', 'done') then now() end, case when p_what = 'done' then now() end,
          case when p_what = 'unread' then now() end, lower(auth.jwt() ->> 'email'), now())
  on conflict (conversation_key) do update set
    read_at = case when p_what in ('read', 'done') then now() else message_states.read_at end,
    done_at = case when p_what = 'done' then now() when p_what in ('undone', 'unread') then null else message_states.done_at end,
    unread_at = case when p_what = 'unread' then now() when p_what = 'undone' then message_states.unread_at else null end,
    updated_by = excluded.updated_by, updated_at = now();
end $$;
revoke all on function public.mark_conversation(text, text) from public, anon;
grant execute on function public.mark_conversation(text, text) to authenticated;

-- Live updates, so a new text shows without reloading
do $$ begin
  begin alter publication supabase_realtime add table public.messages; exception when others then null; end;
  begin alter publication supabase_realtime add table public.message_states; exception when others then null; end;
end $$;

notify pgrst, 'reload schema';
