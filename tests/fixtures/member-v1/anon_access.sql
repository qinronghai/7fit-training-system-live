-- Run after the Member V1 migration with a role able to inspect PostgreSQL catalogs.
-- This proves anon has no direct table or RPC grants and each table stays RLS-enabled.
do $assert_member_access$
declare
  v_table_name text;
  v_table regclass;
  v_short_name text;
  v_rls_enabled boolean;
begin
  foreach v_table_name in array array[
    'public.members',
    'public.training_sessions',
    'public.training_session_items'
  ] loop
    v_table := pg_catalog.to_regclass(v_table_name);
    if v_table is null then
      raise exception 'Member V1 table missing: %', v_table_name;
    end if;
    if pg_catalog.has_table_privilege('anon', v_table, 'SELECT')
      or pg_catalog.has_table_privilege('anon', v_table, 'INSERT')
      or pg_catalog.has_table_privilege('anon', v_table, 'UPDATE')
      or pg_catalog.has_table_privilege('anon', v_table, 'DELETE') then
      raise exception 'anon has direct table privilege: %', v_table_name;
    end if;
    if not (pg_catalog.has_table_privilege('service_role', v_table, 'SELECT')
      and pg_catalog.has_table_privilege('service_role', v_table, 'INSERT')
      and pg_catalog.has_table_privilege('service_role', v_table, 'UPDATE')) then
      raise exception 'service_role is missing required table grants: %', v_table_name;
    end if;

    select relrowsecurity into v_rls_enabled
      from pg_catalog.pg_class
     where oid = v_table;
    if v_rls_enabled is distinct from true then
      raise exception 'RLS is not enabled: %', v_table_name;
    end if;

    v_short_name := pg_catalog.split_part(v_table_name, '.', 2);
    if exists (
      select 1 from pg_catalog.pg_policies
       where schemaname = 'public'
         and tablename = v_short_name
    ) then
      raise exception 'Unexpected direct-access policy exists: %', v_table_name;
    end if;
  end loop;

  if pg_catalog.has_function_privilege('anon', 'public.member_save_planned_session(jsonb)', 'EXECUTE')
    or pg_catalog.has_function_privilege('anon', 'public.member_complete_training_session(uuid,integer,timestamptz,jsonb)', 'EXECUTE')
    or pg_catalog.has_function_privilege('anon', 'public.member_cancel_training_session(uuid,integer)', 'EXECUTE')
    or pg_catalog.has_function_privilege('anon', 'public.member_delete_planned_training_session(uuid,integer)', 'EXECUTE') then
    raise exception 'anon can execute a Member V1 RPC';
  end if;
  if not pg_catalog.has_function_privilege('service_role', 'public.member_delete_planned_training_session(uuid,integer)', 'EXECUTE') then
    raise exception 'service_role is missing the planned-session deletion RPC grant';
  end if;
  if not pg_catalog.has_table_privilege('service_role', 'public.training_sessions', 'DELETE') then
    raise exception 'service_role is missing the planned-session parent delete grant';
  end if;
end;
$assert_member_access$;
