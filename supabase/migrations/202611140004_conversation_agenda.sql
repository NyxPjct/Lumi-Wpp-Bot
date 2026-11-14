alter table public.appointments add column simulation_id uuid;
comment on column public.appointments.simulation_id is 'Local simulator grouping; not customer authentication. Real WhatsApp identity must be bound server-side.';
create index appointments_simulation_idx on public.appointments(optic_id,simulation_id,created_at desc) where simulation_id is not null;

create function public.get_conversation_agenda(p_optic_id uuid,p_simulation_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  if p_simulation_id is null then raise exception 'Simulation required' using errcode='22023'; end if;
  perform 1 from public.optic_memberships where optic_id=p_optic_id and user_id=auth.uid();
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  return jsonb_build_object(
    'slots',(select coalesce(jsonb_agg(row_data order by starts_at),'[]'::jsonb) from (
      select s.*,false as is_booked from public.appointment_slots s
      where s.optic_id=p_optic_id and not s.is_cancelled and s.starts_at>statement_timestamp()
        and not exists(select 1 from public.appointments a where a.slot_id=s.id and a.status='confirmed')
      order by starts_at limit 100
    ) row_data),
    'appointments',(select coalesce(jsonb_agg(row_data order by created_at desc),'[]'::jsonb) from (
      select a.*,to_jsonb(s) as slot from public.appointments a join public.appointment_slots s on s.id=a.slot_id
      where a.optic_id=p_optic_id and a.simulation_id=p_simulation_id order by a.created_at desc limit 50
    ) row_data)
  );
end;
$$;

create function public.book_conversation_appointment(p_optic_id uuid,p_simulation_id uuid,p_slot_id uuid,p_customer_name text,p_request_id uuid)
returns public.appointments language plpgsql security definer set search_path='' as $$
declare result public.appointments; existing_simulation uuid;
begin
  if p_simulation_id is null then raise exception 'Simulation required' using errcode='22023'; end if;
  perform o.id from public.optics o join public.optic_memberships m on m.optic_id=o.id
    where o.id=p_optic_id and m.user_id=auth.uid() for update of o;
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  select simulation_id into existing_simulation from public.appointments where optic_id=p_optic_id and request_id=p_request_id;
  if found and existing_simulation is distinct from p_simulation_id then
    raise exception 'Request ID belongs to another context' using errcode='23505';
  end if;
  result:=public.book_appointment(p_optic_id,p_slot_id,p_customer_name,p_request_id);
  if result.status<>'confirmed' then raise exception 'Booking already cancelled' using errcode='22023'; end if;
  update public.appointments set simulation_id=p_simulation_id where id=result.id returning * into result;
  return result;
end;
$$;

create function public.cancel_conversation_appointment(p_optic_id uuid,p_simulation_id uuid,p_appointment_id uuid)
returns public.appointments language plpgsql security definer set search_path='' as $$
begin
  perform o.id from public.optics o join public.optic_memberships m on m.optic_id=o.id
    where o.id=p_optic_id and m.user_id=auth.uid() for update of o;
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  perform id from public.appointments where id=p_appointment_id and optic_id=p_optic_id and simulation_id=p_simulation_id;
  if not found then raise exception 'Booking not in this simulation' using errcode='22023'; end if;
  return public.cancel_appointment(p_optic_id,p_appointment_id);
end;
$$;

create function public.reschedule_conversation_appointment(p_optic_id uuid,p_simulation_id uuid,p_appointment_id uuid,p_slot_id uuid)
returns public.appointments language plpgsql security definer set search_path='' as $$
declare current_service text;
begin
  perform o.id from public.optics o join public.optic_memberships m on m.optic_id=o.id
    where o.id=p_optic_id and m.user_id=auth.uid() for update of o;
  if not found then raise exception 'Forbidden' using errcode='42501'; end if;
  select s.service into current_service from public.appointments a join public.appointment_slots s on s.id=a.slot_id
    where a.id=p_appointment_id and a.optic_id=p_optic_id and a.simulation_id=p_simulation_id and a.status='confirmed';
  if not found then raise exception 'Booking not in this simulation' using errcode='22023'; end if;
  perform id from public.appointment_slots where id=p_slot_id and optic_id=p_optic_id and service=current_service;
  if not found then raise exception 'Matching service slot required' using errcode='22023'; end if;
  return public.reschedule_appointment(p_optic_id,p_appointment_id,p_slot_id);
end;
$$;

revoke all on function public.get_conversation_agenda(uuid,uuid) from public,anon;
revoke all on function public.book_conversation_appointment(uuid,uuid,uuid,text,uuid) from public,anon;
revoke all on function public.cancel_conversation_appointment(uuid,uuid,uuid) from public,anon;
revoke all on function public.reschedule_conversation_appointment(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.get_conversation_agenda(uuid,uuid) to authenticated;
grant execute on function public.book_conversation_appointment(uuid,uuid,uuid,text,uuid) to authenticated;
grant execute on function public.cancel_conversation_appointment(uuid,uuid,uuid) to authenticated;
grant execute on function public.reschedule_conversation_appointment(uuid,uuid,uuid,uuid) to authenticated;
