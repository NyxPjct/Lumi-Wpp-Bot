-- Local test orders. A ready-order notice is only a blocked draft, never a send.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  optic_id uuid not null references public.optics(id) on delete cascade,
  request_id uuid not null,
  code text not null check (
    char_length(code) between 3 and 30 and code=upper(btrim(code)) and code ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'
    and code not in ('MENU','VOLTAR') and code !~ '\m(ATENDENTE|HUMANO|PESSOA)\M'
  ),
  customer_name text not null check (char_length(btrim(customer_name)) between 2 and 80),
  status text not null default 'in_production' check (status in ('in_production','ready','collected')),
  is_demo boolean not null default true check (is_demo),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ready_at timestamptz,
  collected_at timestamptz,
  unique(optic_id,code),
  unique(optic_id,request_id),
  unique(id,optic_id)
);
create index orders_optic_created_idx on public.orders(optic_id,created_at desc);
create table public.order_notifications (
  id uuid primary key default gen_random_uuid(),
  optic_id uuid not null references public.optics(id) on delete cascade,
  order_id uuid not null,
  template_name text not null default 'oculos_prontos' check (template_name='oculos_prontos'),
  state text not null default 'blocked' check (state in ('blocked','cancelled')),
  is_demo boolean not null default true check (is_demo),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint notification_order_optic_fk foreign key(order_id,optic_id) references public.orders(id,optic_id) on delete cascade,
  unique(order_id,template_name)
);
alter table public.orders enable row level security;
alter table public.order_notifications enable row level security;
revoke all on public.orders,public.order_notifications from anon,authenticated;
grant select on public.orders,public.order_notifications to authenticated;
grant all on public.orders,public.order_notifications to service_role;
create policy "members read own orders" on public.orders for select to authenticated using (
  exists(select 1 from public.optic_memberships m where m.optic_id=orders.optic_id and m.user_id=(select auth.uid()))
);
create policy "members read own order notices" on public.order_notifications for select to authenticated using (
  exists(select 1 from public.optic_memberships m where m.optic_id=order_notifications.optic_id and m.user_id=(select auth.uid()))
);

create function public.create_order(p_optic_id uuid,p_request_id uuid,p_code text,p_customer_name text)
returns public.orders language plpgsql security definer set search_path='' as $$
declare result public.orders;
begin
  perform o.id from public.optics o join public.optic_memberships m on m.optic_id=o.id
    where o.id=p_optic_id and m.user_id=auth.uid() for update of o;
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_request_id is null then raise exception 'Request ID required' using errcode='22023'; end if;
  select * into result from public.orders where optic_id=p_optic_id and request_id=p_request_id;
  if found then
    if result.code is distinct from upper(btrim(p_code)) or result.customer_name is distinct from btrim(p_customer_name) then
      raise exception 'Request ID already used' using errcode='23505';
    end if;
    return result;
  end if;
  insert into public.orders(optic_id,request_id,code,customer_name)
    values(p_optic_id,p_request_id,upper(btrim(p_code)),btrim(p_customer_name)) returning * into result;
  return result;
end;
$$;

create function public.advance_order(p_optic_id uuid,p_order_id uuid,p_expected_status text,p_status text)
returns public.orders language plpgsql security definer set search_path='' as $$
declare result public.orders;
begin
  perform 1 from public.optic_memberships where optic_id=p_optic_id and user_id=auth.uid();
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into result from public.orders where id=p_order_id and optic_id=p_optic_id for update;
  if not found then raise exception 'Order not found' using errcode='22023'; end if;
  if p_status is null or p_status not in ('ready','collected') then raise exception 'Invalid target status' using errcode='22023'; end if;
  if result.status=p_status then return result; end if;
  if result.status is distinct from p_expected_status then raise exception 'Order changed; reload' using errcode='40001'; end if;
  if not ((result.status='in_production' and p_status='ready') or (result.status='ready' and p_status='collected')) then
    raise exception 'Invalid order transition' using errcode='22023';
  end if;
  update public.orders set status=p_status,updated_at=now(),
    ready_at=case when p_status='ready' then now() else ready_at end,
    collected_at=case when p_status='collected' then now() else collected_at end
    where id=result.id returning * into result;
  if p_status='ready' then
    insert into public.order_notifications(optic_id,order_id) values(p_optic_id,result.id)
      on conflict(order_id,template_name) do nothing;
  else
    update public.order_notifications set state='cancelled',cancelled_at=now() where order_id=result.id and state='blocked';
  end if;
  return result;
end;
$$;

create function public.list_orders(p_optic_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.optic_memberships where optic_id=p_optic_id and user_id=auth.uid();
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(row_data order by created_at desc),'[]'::jsonb) from (
    select o.*,n.state as notice_state from public.orders o left join public.order_notifications n
      on n.order_id=o.id and n.template_name='oculos_prontos'
      where o.optic_id=p_optic_id order by o.created_at desc limit 100
  ) row_data);
end;
$$;

create function public.lookup_order_status(p_optic_id uuid,p_code text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  perform 1 from public.optic_memberships where optic_id=p_optic_id and user_id=auth.uid();
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  select jsonb_build_object('code',code,'status',status) into result from public.orders where optic_id=p_optic_id and code=upper(btrim(p_code));
  return result;
end;
$$;
revoke all on function public.create_order(uuid,uuid,text,text) from public,anon;
revoke all on function public.advance_order(uuid,uuid,text,text) from public,anon;
revoke all on function public.list_orders(uuid) from public,anon;
revoke all on function public.lookup_order_status(uuid,text) from public,anon;
grant execute on function public.create_order(uuid,uuid,text,text) to authenticated;
grant execute on function public.advance_order(uuid,uuid,text,text) to authenticated;
grant execute on function public.list_orders(uuid) to authenticated;
grant execute on function public.lookup_order_status(uuid,text) to authenticated;
