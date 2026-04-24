-- Data cleanup: remove all comments only. Entries and other domain tables unchanged.
-- Order: dependent rows first, then comments (self-FK uses ON DELETE SET NULL on parent).

DELETE FROM public.comment_reactions;

DELETE FROM public.notifications
WHERE comment_id IS NOT NULL;

DELETE FROM public.comments;
