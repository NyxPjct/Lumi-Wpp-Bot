-- One optic per authenticated account in this first version.
-- No client may create memberships or choose its own tenant binding.
create table public.optics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  address text not null check (char_length(btrim(address)) between 2 and 300),
  hours text not null check (char_length(btrim(hours)) between 2 and 300),
  payments text not null check (char_length(btrim(payments)) between 2 and 300),
  delivery text not null check (char_length(btrim(delivery)) between 2 and 300),
  created_at timestamptz not null default now()
);

create table public.optic_memberships (
  user_id uuid primary key references auth.users(id),
  optic_id uuid not null references public.optics(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'attendant'))
);
create index optic_memberships_optic_id_idx on public.optic_memberships(optic_id);

alter table public.optics enable row level security;
alter table public.optic_memberships enable row level security;

revoke all on public.optics from anon, authenticated;
revoke all on public.optic_memberships from anon, authenticated;
grant select on public.optics, public.optic_memberships to authenticated;
grant update (name, address, hours, payments, delivery) on public.optics to authenticated;

create policy "read own membership" on public.optic_memberships
  for select to authenticated using (user_id = (select auth.uid()));
create policy "read own optic" on public.optics
  for select to authenticated using (
    exists (select 1 from public.optic_memberships m where m.optic_id = optics.id and m.user_id = (select auth.uid()))
  );
create policy "owner edits own optic" on public.optics
  for update to authenticated using (
    exists (select 1 from public.optic_memberships m where m.optic_id = optics.id and m.user_id = (select auth.uid()) and m.role = 'owner')
  ) with check (
    exists (select 1 from public.optic_memberships m where m.optic_id = optics.id and m.user_id = (select auth.uid()) and m.role = 'owner')
  );

create function public.create_optic(p_name text, p_address text, p_hours text, p_payments text, p_delivery text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  new_id uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if exists (select 1 from public.optic_memberships where user_id = actor) then
    raise exception 'Account already has an optic' using errcode = '23505';
  end if;
  insert into public.optics (name, address, hours, payments, delivery)
    values (btrim(p_name), btrim(p_address), btrim(p_hours), btrim(p_payments), btrim(p_delivery)) returning id into new_id;
  insert into public.optic_memberships (user_id, optic_id, role) values (actor, new_id, 'owner');
  return new_id;
end;
$$;
revoke all on function public.create_optic(text, text, text, text, text) from public, anon;
grant execute on function public.create_optic(text, text, text, text, text) to authenticated;
