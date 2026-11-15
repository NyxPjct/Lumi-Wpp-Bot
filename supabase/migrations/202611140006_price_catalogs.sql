-- Imported selling prices belong to each optic, never to a global brand feed.
create table public.price_catalogs (
  id uuid primary key,
  optic_id uuid not null references public.optics(id) on delete cascade,
  revision uuid not null,
  name text not null check (char_length(btrim(name)) between 2 and 100),
  brand text not null check (char_length(btrim(brand)) between 2 and 80),
  valid_from date not null check (valid_from between '2000-01-01' and '2099-12-31'),
  valid_until date check (valid_until between valid_from and '2099-12-31'),
  source_file text not null check (char_length(source_file) between 1 and 180),
  products jsonb not null check (jsonb_typeof(products)='array' and jsonb_array_length(products) between 1 and 1000),
  updated_at timestamptz not null default now()
);
create index price_catalogs_optic_idx on public.price_catalogs(optic_id,updated_at desc);
alter table public.price_catalogs enable row level security;
revoke all on public.price_catalogs from public, anon, authenticated;
grant select on public.price_catalogs to authenticated;
grant all on public.price_catalogs to service_role;
create policy "members read own price catalogs" on public.price_catalogs for select to authenticated using (
  exists (select 1 from public.optic_memberships m where m.optic_id=price_catalogs.optic_id and m.user_id=(select auth.uid()))
);
alter table public.quotes add column catalog_source jsonb;

create function public.set_price_catalog(
  p_optic_id uuid,p_catalog_id uuid,p_expected_revision uuid,p_revision uuid,
  p_name text,p_brand text,p_valid_from date,p_valid_until date,p_source_file text,p_products jsonb
) returns public.price_catalogs language plpgsql security definer set search_path='' as $$
declare previous public.price_catalogs; result public.price_catalogs; item jsonb;
begin
  perform o.id from public.optics o join public.optic_memberships m on m.optic_id=o.id
    where o.id=p_optic_id and m.user_id=auth.uid() and m.role='owner' for update of o;
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_catalog_id is null or p_revision is null or p_valid_from is null or p_name is null or p_brand is null or p_source_file is null
    or char_length(btrim(p_name)) not between 2 and 100 or char_length(btrim(p_brand)) not between 2 and 80
    or char_length(p_source_file) not between 1 and 180 or jsonb_typeof(p_products) is distinct from 'array' then
    raise exception 'Invalid catalog' using errcode='22023';
  end if;
  if jsonb_array_length(p_products) not between 1 and 1000 or octet_length(p_products::text)>2000000 then raise exception 'Invalid catalog size' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_products) loop
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'code') is distinct from 'string' or char_length(btrim(item->>'code')) not between 1 and 80
      or item->>'code'<>btrim(item->>'code')
      or jsonb_typeof(item->'name') is distinct from 'string' or char_length(btrim(item->>'name')) not between 1 and 160
      or item->>'name'<>btrim(item->>'name')
      or coalesce(item->>'lensType','') not in ('single','multifocal','occupational')
      or jsonb_typeof(item->'minimumCents') is distinct from 'number' or jsonb_typeof(item->'maximumCents') is distinct from 'number'
      or jsonb_typeof(item->'treatments') is distinct from 'string' or char_length(item->>'treatments')>300
      or jsonb_typeof(item->'refractiveIndex') is distinct from 'string' or char_length(item->>'refractiveIndex')>30
      or jsonb_typeof(item->'notes') is distinct from 'string' or char_length(item->>'notes')>500 then
      raise exception 'Invalid catalog product' using errcode='22023';
    end if;
    if (item->>'minimumCents')::numeric<>trunc((item->>'minimumCents')::numeric)
      or (item->>'maximumCents')::numeric<>trunc((item->>'maximumCents')::numeric)
      or (item->>'minimumCents')::numeric not between 1 and 100000000
      or (item->>'maximumCents')::numeric not between (item->>'minimumCents')::numeric and 100000000 then
      raise exception 'Invalid catalog price' using errcode='22023';
    end if;
  end loop;
  if (select count(distinct x->>'code') from jsonb_array_elements(p_products) x)<>jsonb_array_length(p_products) then raise exception 'Duplicate product code' using errcode='22023'; end if;
  select * into previous from public.price_catalogs where id=p_catalog_id;
  if found then
    if previous.optic_id<>p_optic_id then raise exception 'Forbidden' using errcode='42501'; end if;
    -- Repeating an identical publication after a lost response is harmless.
    if previous.revision=p_revision and previous.name=btrim(p_name) and previous.brand=btrim(p_brand)
      and previous.valid_from=p_valid_from and previous.valid_until is not distinct from p_valid_until
      and previous.source_file=p_source_file and previous.products=p_products then return previous; end if;
    if previous.revision is distinct from p_expected_revision or p_revision=previous.revision then raise exception 'Catalog changed: reload before replacing' using errcode='40001'; end if;
  else
    if p_expected_revision is not null then raise exception 'Catalog not found' using errcode='40001'; end if;
    if (select count(*) from public.price_catalogs where optic_id=p_optic_id)>=30 then raise exception 'Catalog limit reached' using errcode='22023'; end if;
  end if;
  insert into public.price_catalogs(id,optic_id,revision,name,brand,valid_from,valid_until,source_file,products)
    values(p_catalog_id,p_optic_id,p_revision,btrim(p_name),btrim(p_brand),p_valid_from,p_valid_until,p_source_file,p_products)
    on conflict(id) do update set revision=excluded.revision,name=excluded.name,brand=excluded.brand,valid_from=excluded.valid_from,
      valid_until=excluded.valid_until,source_file=excluded.source_file,products=excluded.products,updated_at=clock_timestamp()
    returning * into result;
  return result;
end;
$$;
revoke all on function public.set_price_catalog(uuid,uuid,uuid,uuid,text,text,date,date,text,jsonb) from public,anon;
grant execute on function public.set_price_catalog(uuid,uuid,uuid,uuid,text,text,date,date,text,jsonb) to authenticated;

create function public.create_catalog_quote(p_optic_id uuid,p_request_id uuid,p_catalog_id uuid,p_revision uuid,p_product_code text)
returns public.quotes language plpgsql security definer set search_path='' as $$
declare result public.quotes; price_table public.price_catalogs; item jsonb; today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  perform o.id from public.optics o join public.optic_memberships m on m.optic_id=o.id
    where o.id=p_optic_id and m.user_id=auth.uid() for share of o;
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_request_id is null or p_catalog_id is null or p_revision is null or p_product_code is null then raise exception 'Invalid request' using errcode='22023'; end if;
  select * into result from public.quotes where optic_id=p_optic_id and request_id=p_request_id;
  if found then
    if result.catalog_source is null or result.catalog_source->>'catalogId'<>p_catalog_id::text or result.catalog_source->>'revision'<>p_revision::text or result.catalog_source->>'productCode'<>p_product_code then
      raise exception 'Request ID already used' using errcode='23505';
    end if;
    return result;
  end if;
  select * into price_table from public.price_catalogs where id=p_catalog_id and optic_id=p_optic_id;
  if not found or price_table.revision<>p_revision then raise exception 'Catalog changed: estimate again' using errcode='40001'; end if;
  if price_table.valid_from>today or (price_table.valid_until is not null and price_table.valid_until<today) then raise exception 'Catalog outside validity' using errcode='22023'; end if;
  select x into item from jsonb_array_elements(price_table.products) x where x->>'code'=p_product_code;
  if not found then raise exception 'Product not found' using errcode='22023'; end if;
  insert into public.quotes(optic_id,request_id,lens_type,treatments,minimum_cents,maximum_cents,catalog_source)
    values(p_optic_id,p_request_id,item->>'lensType','{}',(item->>'minimumCents')::integer,(item->>'maximumCents')::integer,
      jsonb_build_object('catalogId',price_table.id,'revision',price_table.revision,'tableName',price_table.name,'brand',price_table.brand,
        'productCode',item->>'code','productName',item->>'name','treatments',item->>'treatments','refractiveIndex',item->>'refractiveIndex','notes',item->>'notes'))
    on conflict(optic_id,request_id) do nothing returning * into result;
  if not found then
    select * into result from public.quotes where optic_id=p_optic_id and request_id=p_request_id;
    if result.catalog_source is null or result.catalog_source->>'catalogId'<>p_catalog_id::text or result.catalog_source->>'revision'<>p_revision::text or result.catalog_source->>'productCode'<>p_product_code then
      raise exception 'Request ID already used' using errcode='23505';
    end if;
  end if;
  return result;
end;
$$;
revoke all on function public.create_catalog_quote(uuid,uuid,uuid,uuid,text) from public,anon;
grant execute on function public.create_catalog_quote(uuid,uuid,uuid,uuid,text) to authenticated;

-- After a catalog is imported, new quotes must use its actual products.
alter function public.create_quote(uuid,uuid,text,text[]) rename to create_legacy_quote;
revoke all on function public.create_legacy_quote(uuid,uuid,text,text[]) from public,anon,authenticated;
create function public.create_quote(p_optic_id uuid,p_request_id uuid,p_lens_type text,p_treatments text[])
returns public.quotes language plpgsql security definer set search_path='' as $$
declare existing public.quotes;
begin
  perform o.id from public.optics o join public.optic_memberships m on m.optic_id=o.id
    where o.id=p_optic_id and m.user_id=auth.uid() for share of o;
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into existing from public.quotes where optic_id=p_optic_id and request_id=p_request_id;
  if found then
    if existing.catalog_source is not null then raise exception 'Request ID already used' using errcode='23505'; end if;
  elsif exists(select 1 from public.price_catalogs where optic_id=p_optic_id) then
    raise exception 'Select an imported catalog product' using errcode='22023';
  end if;
  return public.create_legacy_quote(p_optic_id,p_request_id,p_lens_type,p_treatments);
end;
$$;
revoke all on function public.create_quote(uuid,uuid,text,text[]) from public,anon;
grant execute on function public.create_quote(uuid,uuid,text,text[]) to authenticated;
