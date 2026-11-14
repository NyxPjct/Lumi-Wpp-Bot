-- Prices are integer BRL cents for a pair of lenses. Treatments are additive.
create table public.lens_prices (
  optic_id uuid not null references public.optics(id) on delete cascade,
  kind text not null check (kind in ('single','multifocal','occupational')),
  minimum_cents integer not null check (minimum_cents between 0 and 100000000),
  maximum_cents integer not null check (maximum_cents between minimum_cents and 100000000),
  primary key (optic_id,kind)
);
create table public.treatment_prices (
  optic_id uuid not null references public.optics(id) on delete cascade,
  kind text not null check (kind in ('antireflective','blue_filter','photochromic')),
  minimum_cents integer not null check (minimum_cents between 0 and 100000000),
  maximum_cents integer not null check (maximum_cents between minimum_cents and 100000000),
  primary key (optic_id,kind)
);
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  optic_id uuid not null references public.optics(id) on delete cascade,
  request_id uuid not null,
  lens_type text not null check (lens_type in ('single','multifocal','occupational')),
  treatments text[] not null,
  minimum_cents integer not null check (minimum_cents >= 0),
  maximum_cents integer not null check (maximum_cents >= minimum_cents),
  status text not null default 'new' check (status in ('new','in_service','won','lost')),
  is_demo boolean not null default true check (is_demo),
  created_at timestamptz not null default now(),
  unique (optic_id,request_id)
);
create index quotes_optic_created_idx on public.quotes(optic_id,created_at desc);
alter table public.lens_prices enable row level security;
alter table public.treatment_prices enable row level security;
alter table public.quotes enable row level security;
revoke all on public.lens_prices, public.treatment_prices, public.quotes from anon, authenticated;
grant select on public.lens_prices, public.treatment_prices, public.quotes to authenticated;
grant update (status) on public.quotes to authenticated;
grant all on public.lens_prices, public.treatment_prices, public.quotes to service_role;
create policy "members read lens prices" on public.lens_prices for select to authenticated using (
  exists (select 1 from public.optic_memberships m where m.optic_id = lens_prices.optic_id and m.user_id = (select auth.uid()))
);
create policy "members read treatment prices" on public.treatment_prices for select to authenticated using (
  exists (select 1 from public.optic_memberships m where m.optic_id = treatment_prices.optic_id and m.user_id = (select auth.uid()))
);
create policy "members read quotes" on public.quotes for select to authenticated using (
  exists (select 1 from public.optic_memberships m where m.optic_id = quotes.optic_id and m.user_id = (select auth.uid()))
);
create policy "members update quote status" on public.quotes for update to authenticated using (
  exists (select 1 from public.optic_memberships m where m.optic_id = quotes.optic_id and m.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.optic_memberships m where m.optic_id = quotes.optic_id and m.user_id = (select auth.uid()))
);

create function public.set_price_table(p_optic_id uuid, p_lenses jsonb, p_treatments jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare row_data jsonb;
begin
  -- Serialize a complete price-table update with quote creation for this optic.
  perform o.id from public.optics o join public.optic_memberships m on m.optic_id=o.id
    where o.id=p_optic_id and m.user_id=auth.uid() and m.role='owner' for update of o;
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  if jsonb_typeof(p_lenses) is distinct from 'array' or jsonb_typeof(p_treatments) is distinct from 'array' then
    raise exception 'Invalid price table' using errcode='22023';
  end if;
  if jsonb_array_length(p_lenses)<>3 or jsonb_array_length(p_treatments)<>3
    or (select count(distinct x->>'kind') from jsonb_array_elements(p_lenses) x)<>3
    or (select count(distinct x->>'kind') from jsonb_array_elements(p_treatments) x)<>3 then
    raise exception 'Complete price table required' using errcode='22023';
  end if;
  for row_data in select value from jsonb_array_elements(p_lenses) loop
    insert into public.lens_prices(optic_id,kind,minimum_cents,maximum_cents)
      values (p_optic_id,row_data->>'kind',(row_data->>'minimum_cents')::integer,(row_data->>'maximum_cents')::integer)
      on conflict (optic_id,kind) do update set minimum_cents=excluded.minimum_cents, maximum_cents=excluded.maximum_cents;
  end loop;
  for row_data in select value from jsonb_array_elements(p_treatments) loop
    insert into public.treatment_prices(optic_id,kind,minimum_cents,maximum_cents)
      values (p_optic_id,row_data->>'kind',(row_data->>'minimum_cents')::integer,(row_data->>'maximum_cents')::integer)
      on conflict (optic_id,kind) do update set minimum_cents=excluded.minimum_cents, maximum_cents=excluded.maximum_cents;
  end loop;
end;
$$;
revoke all on function public.set_price_table(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.set_price_table(uuid,jsonb,jsonb) to authenticated;

create function public.create_quote(p_optic_id uuid, p_request_id uuid, p_lens_type text, p_treatments text[])
returns public.quotes language plpgsql security definer set search_path = '' as $$
declare result public.quotes;
  canonical text[];
  amount_min integer;
  amount_max integer;
  addon_min integer;
  addon_max integer;
  addon_count integer;
begin
  perform o.id from public.optics o join public.optic_memberships m on m.optic_id=o.id
    where o.id=p_optic_id and m.user_id=auth.uid() for share of o;
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_request_id is null or p_lens_type is null or p_lens_type not in ('single','multifocal','occupational')
    or p_treatments is null or cardinality(p_treatments)>3 then
    raise exception 'Invalid preferences' using errcode='22023';
  end if;
  if exists (select 1 from unnest(p_treatments) t where t is null or t not in ('antireflective','blue_filter','photochromic')) then
    raise exception 'Invalid treatment' using errcode='22023';
  end if;
  canonical := array(select distinct t from unnest(p_treatments) t order by t);
  if cardinality(canonical)<>cardinality(p_treatments) then raise exception 'Duplicate treatment' using errcode='22023'; end if;
  select * into result from public.quotes where optic_id=p_optic_id and request_id=p_request_id;
  if found then
    if result.lens_type<>p_lens_type or result.treatments<>canonical then raise exception 'Request ID already used' using errcode='23505'; end if;
    return result;
  end if;
  select minimum_cents, maximum_cents into amount_min,amount_max from public.lens_prices where optic_id=p_optic_id and kind=p_lens_type;
  if not found then raise exception 'Lens price not configured' using errcode='22023'; end if;
  select count(*),coalesce(sum(minimum_cents),0),coalesce(sum(maximum_cents),0)
    into addon_count,addon_min,addon_max from public.treatment_prices where optic_id=p_optic_id and kind=any(canonical);
  if addon_count<>cardinality(canonical) then raise exception 'Treatment price not configured' using errcode='22023'; end if;
  insert into public.quotes(optic_id,request_id,lens_type,treatments,minimum_cents,maximum_cents)
    values(p_optic_id,p_request_id,p_lens_type,canonical,amount_min+addon_min,amount_max+addon_max)
    on conflict (optic_id,request_id) do nothing returning * into result;
  if not found then
    select * into result from public.quotes where optic_id=p_optic_id and request_id=p_request_id;
    if result.lens_type<>p_lens_type or result.treatments<>canonical then raise exception 'Request ID already used' using errcode='23505'; end if;
  end if;
  return result;
end;
$$;
revoke all on function public.create_quote(uuid,uuid,text,text[]) from public,anon;
grant execute on function public.create_quote(uuid,uuid,text,text[]) to authenticated;
