-- Admin üye yönetimi: PATCH /api/admin/members/[id] public.users satırı günceller.
-- Önceki migrasyon yalnızca SELECT vermişti; UPDATE olmadan 42501 permission denied oluşur.

grant update on table public.users to service_role;
