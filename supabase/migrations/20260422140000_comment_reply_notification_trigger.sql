-- Reliable comment_reply notifications: DB trigger (bypasses client RLS/FK timing issues).

create or replace function public.notify_on_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_user_id uuid;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select c.user_id
  into v_parent_user_id
  from public.comments c
  where c.id = new.parent_comment_id;

  if v_parent_user_id is null or v_parent_user_id = new.user_id then
    return new;
  end if;

  begin
    insert into public.notifications (
      user_id,
      actor_user_id,
      type,
      entry_id,
      comment_id
    )
    values (
      v_parent_user_id,
      new.user_id,
      'comment_reply',
      new.entry_id,
      new.id
    );
  exception
    when foreign_key_violation then
      raise warning 'notify_on_comment_reply: fk violation (skipped), %', sqlerrm;
    when others then
      raise warning 'notify_on_comment_reply: skipped, %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists comment_reply_notify on public.comments;

create trigger comment_reply_notify
  after insert on public.comments
  for each row
  execute procedure public.notify_on_comment_reply();
