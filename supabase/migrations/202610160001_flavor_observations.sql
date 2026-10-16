-- Optional customer-facing preparation notes per flavor; existing recipes are unchanged.
alter table public.yp_flavors add column if not exists observation text not null default '';
alter table public.yp_flavors add constraint yp_flavors_observation_length check (char_length(observation) <= 1000);
comment on column public.yp_flavors.observation is 'Optional customer-facing note for this flavor only. Empty means no note.';
