-- One calendar per optic, local test bookings only. No WhatsApp reminders yet.
create table public.appointment_slots (
  id uuid primary key default gen_random_uuid(),
  optic_id uuid not null references public.optics(id) on delete cascade,
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes in (15,30,60)),
  service text not null check (service in ('exam','adjustment','pickup')),
  is_cancelled boolean not null default false,
  is_demo boolean not null default true check (is_demo),
  unique(id,optic_id)
);
create index appointment_slots_optic_start_idx on public.appointment_slots(optic_id,starts_at);
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  optic_id uuid not null references public.optics(id) on delete cascade,
  slot_id uuid not null,
  request_id uuid not null,
  customer_name text not null check (char_length(btrim(customer_name)) between 2 and 80),
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  is_demo boolean not null default true check (is_demo),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_slot_optic_fk foreign key(slot_id,optic_id) references public.appointment_slots(id,optic_id) on delete cascade,
  unique(optic_id,request_id)
);
create unique index one_confirmed_appointment_per_slot on public.appointments(slot_id) where status='confirmed';
create index appointments_optic_created_idx on public.appointments(optic_id,created_at desc);
alter table public.appointment_slots enable row level security;
alter table public.appointments enable row level security;
revoke all on public.appointment_slots,public.appointments from anon,authenticated;
grant select on public.appointment_slots,public.appointments to authenticated;
grant all on public.appointment_slots,public.appointments to service_role;
create policy "members read own slots" on public.appointment_slots for select to authenticated using (
  exists(select 1 from public.optic_memberships m where m.optic_id=appointment_slots.optic_id and m.user_id=(select auth.uid()))
);
create policy "members read own appointments" on public.appointments for select to authenticated using (
  exists(select 1 from public.optic_memberships m where m.optic_id=appointments.optic_id and m.user_id=(select auth.uid()))
);

create function public.create_appointment_slot(p_optic_id uuid,p_starts_at timestamptz,p_duration_minutes integer,p_service text)
returns public.appointment_slots language plpgsql security definer set search_path='' as $$
declare result public.appointment_slots;
begin
  -- All calendar mutations serialize on this optic: overlapping slots cannot race.
  perform o.id from public.optics o join public.optic_memberships m on m.optic_id=o.id
    where o.id=p_optic_id and m.user_id=auth.uid() and m.role='owner' for update of o;
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_starts_at is null or p_starts_at<=clock_timestamp() or p_starts_at>clock_timestamp()+interval '365 days'
    or p_duration_minutes is null or p_duration_minutes not in (15,30,60)
    or p_service is null or p_service not in ('exam','adjustment','pickup') then
    raise exception 'Invalid slot' using errcode='22023';
  end if;
  if exists(select 1 from public.appointment_slots s where s.optic_id=p_optic_id and not s.is_cancelled
    and s.starts_at<p_starts_at+make_interval(mins=>p_duration_minutes)
    and s.starts_at+make_interval(mins=>s.duration_minutes)>p_starts_at) then
    raise exception 'Overlapping slot' using errcode='23505';
  end if;
  insert into public.appointment_slots(optic_id,starts_at,duration_minutes,service)
    values(p_optic_id,p_starts_at,p_duration_minutes,p_service) returning * into result;
  return result;
end;
$$;

create function public.cancel_appointment_slot(p_optic_id uuid,p_slot_id uuid)
returns public.appointment_slots language plpgsql security definer set search_path='' as $$
declare result public.appointment_slots;
begin
  perform o.id from public.optics o join public.optic_memberships m on m.optic_id=o.id
    where o.id=p_optic_id and m.user_id=auth.uid() and m.role='owner' for update of o;
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  if exists(select 1 from public.appointments where optic_id=p_optic_id and slot_id=p_slot_id and status='confirmed') then
    raise exception 'Cancel booking first' using errcode='22023';
  end if;
  update public.appointment_slots set is_cancelled=true where id=p_slot_id and optic_id=p_optic_id returning * into result;
  if not found then raise exception 'Slot not found' using errcode='22023'; end if;
  return result;
end;
$$;

create function public.book_appointment(p_optic_id uuid,p_slot_id uuid,p_customer_name text,p_request_id uuid)
returns public.appointments language plpgsql security definer set search_path='' as $$
declare result public.appointments;
begin
  perform o.id from public.optics o join public.optic_memberships m on m.optic_id=o.id
    where o.id=p_optic_id and m.user_id=auth.uid() for update of o;
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_request_id is null or p_customer_name is null or char_length(btrim(p_customer_name)) not between 2 and 80 then
    raise exception 'Invalid booking' using errcode='22023';
  end if;
  select * into result from public.appointments where optic_id=p_optic_id and request_id=p_request_id;
  if found then
    if result.slot_id<>p_slot_id or result.customer_name<>btrim(p_customer_name) then raise exception 'Request ID already used' using errcode='23505'; end if;
    return result;
  end if;
  perform id from public.appointment_slots where id=p_slot_id and optic_id=p_optic_id and not is_cancelled and starts_at>clock_timestamp();
  if not found then raise exception 'Slot unavailable' using errcode='22023'; end if;
  insert into public.appointments(optic_id,slot_id,request_id,customer_name)
    values(p_optic_id,p_slot_id,p_request_id,btrim(p_customer_name)) returning * into result;
  return result;
end;
$$;

create function public.cancel_appointment(p_optic_id uuid,p_appointment_id uuid)
returns public.appointments language plpgsql security definer set search_path='' as $$
declare result public.appointments;
begin
  perform o.id from public.optics o join public.optic_memberships m on m.optic_id=o.id
    where o.id=p_optic_id and m.user_id=auth.uid() for update of o;
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  update public.appointments set status='cancelled',updated_at=now()
    where id=p_appointment_id and optic_id=p_optic_id returning * into result;
  if not found then raise exception 'Appointment not found' using errcode='22023'; end if;
  return result;
end;
$$;

create function public.reschedule_appointment(p_optic_id uuid,p_appointment_id uuid,p_slot_id uuid)
returns public.appointments language plpgsql security definer set search_path='' as $$
declare result public.appointments;
begin
  perform o.id from public.optics o join public.optic_memberships m on m.optic_id=o.id
    where o.id=p_optic_id and m.user_id=auth.uid() for update of o;
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into result from public.appointments where id=p_appointment_id and optic_id=p_optic_id and status='confirmed';
  if not found then raise exception 'Confirmed appointment not found' using errcode='22023'; end if;
  if result.slot_id=p_slot_id then return result; end if;
  perform id from public.appointment_slots where id=p_slot_id and optic_id=p_optic_id and not is_cancelled and starts_at>clock_timestamp();
  if not found then raise exception 'Slot unavailable' using errcode='22023'; end if;
  update public.appointments set slot_id=p_slot_id,updated_at=now() where id=result.id returning * into result;
  return result;
end;
$$;

create function public.get_agenda(p_optic_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.optic_memberships where optic_id=p_optic_id and user_id=auth.uid();
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  -- One statement provides a coherent snapshot of slot occupancy and bookings.
  return jsonb_build_object(
    'slots',(select coalesce(jsonb_agg(row_data order by starts_at),'[]'::jsonb) from (
      select s.*,exists(select 1 from public.appointments a where a.slot_id=s.id and a.status='confirmed') as is_booked
      from public.appointment_slots s where s.optic_id=p_optic_id and s.starts_at>statement_timestamp()
      order by starts_at limit 100
    ) row_data),
    'appointments',(select coalesce(jsonb_agg(row_data order by created_at desc),'[]'::jsonb) from (
      select a.*,to_jsonb(s) as slot from public.appointments a join public.appointment_slots s on s.id=a.slot_id
      where a.optic_id=p_optic_id order by a.created_at desc limit 100
    ) row_data)
  );
end;
$$;

revoke all on function public.create_appointment_slot(uuid,timestamptz,integer,text) from public,anon;
revoke all on function public.cancel_appointment_slot(uuid,uuid) from public,anon;
revoke all on function public.book_appointment(uuid,uuid,text,uuid) from public,anon;
revoke all on function public.cancel_appointment(uuid,uuid) from public,anon;
revoke all on function public.reschedule_appointment(uuid,uuid,uuid) from public,anon;
revoke all on function public.get_agenda(uuid) from public,anon;
grant execute on function public.create_appointment_slot(uuid,timestamptz,integer,text) to authenticated;
grant execute on function public.cancel_appointment_slot(uuid,uuid) to authenticated;
grant execute on function public.book_appointment(uuid,uuid,text,uuid) to authenticated;
grant execute on function public.cancel_appointment(uuid,uuid) to authenticated;
grant execute on function public.reschedule_appointment(uuid,uuid,uuid) to authenticated;
grant execute on function public.get_agenda(uuid) to authenticated;
