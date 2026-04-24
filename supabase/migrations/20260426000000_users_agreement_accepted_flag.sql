-- Topluluk sözleşmesi: boolean bayrak (agreement_accepted_at ile birlikte güncellenir).

alter table public.users
  add column if not exists agreement_accepted boolean not null default false;

update public.users
set agreement_accepted = true
where agreement_accepted_at is not null;

comment on column public.users.agreement_accepted is
  'Topluluk sözleşmesi kabul edildi; agreement_accepted_at zaman damgasıyla eşlenik.';
