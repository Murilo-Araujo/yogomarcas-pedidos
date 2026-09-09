-- Five packages per bundle. Prices remain derived from the package price.
begin;
alter table public.yp_flavors add column sku text;
with numbered as (
 select f.id,p.sku||'-'||lpad(row_number() over(partition by f.product_id order by f.position,f.name,f.id)::text,3,'0') as code
 from public.yp_flavors f join public.yp_products p on p.id=f.product_id
) update public.yp_flavors f set sku=n.code from numbered n where n.id=f.id;
alter table public.yp_flavors alter column sku set not null;
alter table public.yp_flavors add constraint yp_flavor_code_format check(sku ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,59}$');
create unique index yp_flavor_code_unique on public.yp_flavors(lower(sku));
create function public.yp_derive_bundle() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='yp_products' then new.bundle_units=5; end if;
 new.bundle_price=new.package_price*5;
 return new;
end $$;
create trigger yp_product_bundle before insert or update on public.yp_products for each row execute function public.yp_derive_bundle();
create trigger yp_flavor_bundle before insert or update on public.yp_flavors for each row execute function public.yp_derive_bundle();
update public.yp_products set bundle_units=5,bundle_price=package_price*5;
update public.yp_flavors set bundle_price=package_price*5;
revoke all on function public.yp_derive_bundle() from public,anon,authenticated;

alter table public.yp_admins add column username text;
alter table public.yp_admins add column active boolean not null default true;
alter table public.yp_admins add column must_change_password boolean not null default false;
alter table public.yp_admins add column sessions_valid_after timestamptz not null default '-infinity';
update public.yp_admins set username=case when role='owner' then 'admin' else 'equipe_'||replace(user_id::text,'-','') end;
alter table public.yp_admins alter column username set not null;
alter table public.yp_admins add constraint yp_admin_username_format check(username ~ '^[a-z0-9][a-z0-9._-]{2,39}$');
create unique index yp_admin_username_unique on public.yp_admins(username);
-- Check the actual session, not JWT issue time (which changes on refresh).
create function public.yp_admin_session_valid(p_user uuid,p_session uuid) returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s join public.yp_admins a on a.user_id=s.user_id
 where s.id=p_session and s.user_id=p_user and a.active and s.created_at>a.sessions_valid_after
 and (s.not_after is null or s.not_after>now()));
$$;
create or replace function public.yp_claim_owner(p_hash text,p_user uuid,p_email text) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.yp_setup where id=1 and token_hash=p_hash and used_at is null and expires_at>now() for update;
 if not found or exists(select 1 from public.yp_admins) then return false; end if;
 insert into public.yp_admins(user_id,email,role,username,must_change_password) values(p_user,p_email,'owner','admin',true);
 update public.yp_setup set used_at=now() where id=1;
 return true;
end $$;
revoke all on function public.yp_admin_session_valid(uuid,uuid) from public,anon,authenticated;
grant execute on function public.yp_admin_session_valid(uuid,uuid) to service_role;
commit;
