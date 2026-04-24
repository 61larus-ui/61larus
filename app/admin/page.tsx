"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  FEED_CATEGORY_OPTIONS,
  normalizeEntryCategory,
  type EntryCategory,
} from "@/lib/entry-category";
import {
  SUPER_ADMIN_USERNAME,
  isSuperAdminRole,
  type AdminRole,
} from "@/lib/admin-role";
import { SILINMIS_KULLANICI_LABEL } from "@/lib/deleted-user-label";

type EntryRow = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  category: string | null;
};

type AdminUserRow = {
  id: string;
  username: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
};

const CEYHUN_ALEMDAG_DEBUG_LABEL = "Ceyhun Alemdağ";

/** Teşhis (yalnızca dev, belirli satır): /api/admin/members JSON’undaki ham alanlar. */
type MemberListDebugSnapshot = {
  id: unknown;
  email: unknown;
  full_name: unknown;
  agreement_accepted: unknown;
  suspend: unknown;
  reason: unknown;
  at: unknown;
};

type PlatformMemberRow = {
  id: string;
  display_label: string;
  email: string | null;
  /** public.users; API yanıtında yoksa undefined. */
  full_name?: string | null;
  nickname: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name_mode: string | null;
  agreement_accepted: boolean | null;
  agreement_accepted_at: string | null;
  onboarding_completed_at: string | null;
  updated_at: string | null;
  /** public.users.is_platform_access_suspended — yalnızca bu bayrak askı/Aktif ayrımı için kullanılır. */
  is_platform_access_suspended: boolean;
  platform_access_suspended_at: string | null;
  platform_access_suspended_reason: string | null;
  admin_profile_anonymized_at: string | null;
  /** Geliştirme teşhisi: GET /api/admin/members satırındaki ham JSON anahtarları. */
  __debugMemberListRaw?: MemberListDebugSnapshot;
};

function isCeyhunAlemdagDebugRow(displayLabel: string): boolean {
  return (
    displayLabel.trim().toLocaleLowerCase("tr-TR") ===
    CEYHUN_ALEMDAG_DEBUG_LABEL.toLocaleLowerCase("tr-TR")
  );
}

function formatDebugUnknown(v: unknown): string {
  if (v === undefined) return "undefined";
  if (v === true) return "true";
  if (v === false) return "false";
  if (v === null) return "null";
  return String(v);
}

/** JSON bazen string boolean döndürebilir; yine de yalnızca DB bayrağı (tarih/ fallbacksiz). */
function coerceSuspendedFlagFromApi(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value == null) return false;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "true" || s === "t" || s === "1";
  }
  return false;
}

function normalizePlatformMemberRow(raw: PlatformMemberRow): PlatformMemberRow {
  return {
    ...raw,
    is_platform_access_suspended: coerceSuspendedFlagFromApi(
      raw.is_platform_access_suspended
    ),
  };
}

/** Anonimleştirilmiş kayıt (DB bayrağı). */
function memberIsAnonymized(m: PlatformMemberRow): boolean {
  return !!m.admin_profile_anonymized_at;
}

/** Eski veri: yalnızca placeholder ad, anonim zaman damgası yok. */
function memberIsLegacyDeletedPlaceholder(m: PlatformMemberRow): boolean {
  if (memberIsAnonymized(m)) return false;
  const fn = m.first_name;
  if (typeof fn !== "string" || !fn.trim()) return false;
  return (
    fn.localeCompare(SILINMIS_KULLANICI_LABEL, "tr", {
      sensitivity: "base",
    }) === 0
  );
}

/** Askı / anonimleştir uygulanamaz; yalnızca bilgilendirme. */
function memberIsNonManageable(m: PlatformMemberRow): boolean {
  return memberIsAnonymized(m) || memberIsLegacyDeletedPlaceholder(m);
}

function platformMemberStatusLabel(m: PlatformMemberRow): string {
  if (m.is_platform_access_suspended === true) return "Askıda";
  if (memberIsAnonymized(m)) return "Anonimleştirildi";
  if (memberIsLegacyDeletedPlaceholder(m)) return "Silinmiş kullanıcı";
  return "Aktif";
}

function memberManagementPassiveLabel(m: PlatformMemberRow): string {
  if (memberIsAnonymized(m)) return "Anonimleştirildi";
  return "Silinmiş kullanıcı";
}

function platformSuspendReasonLine(m: PlatformMemberRow): string | null {
  const r = m.platform_access_suspended_reason?.trim();
  return r && r.length > 0 ? r : null;
}

/** dd.MM.yyyy HH:mm (saniyesiz), admin tablo görünümü için. */
function formatAdminSuspendTimestamp(iso: string | null | undefined): string | null {
  if (typeof iso !== "string" || iso.length === 0) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function platformSuspendDateLine(m: PlatformMemberRow): string | null {
  return formatAdminSuspendTimestamp(m.platform_access_suspended_at);
}

function platformMemberAgreementLabel(m: PlatformMemberRow): string {
  if (m.agreement_accepted === true || m.agreement_accepted_at) return "Kabul";
  if (m.agreement_accepted === false) return "Hayır";
  return "—";
}

const categoryLabel = (id: string | null): string => {
  if (!id) return "—";
  const n = normalizeEntryCategory(id);
  if (n) {
    const o = FEED_CATEGORY_OPTIONS.find((x) => x.id === n);
    return o?.label ?? id;
  }
  const o = FEED_CATEGORY_OPTIONS.find((x) => x.id === id);
  return o?.label ?? id;
};

export default function AdminPage() {
  const [sessionOk, setSessionOk] = useState<boolean | null>(null);
  const [loginUser, setLoginUser] = useState(SUPER_ADMIN_USERNAME);
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [adminUsername, setAdminUsername] = useState<string | null>(null);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);

  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [authorByEntryId, setAuthorByEntryId] = useState<Record<string, string>>(
    {}
  );
  const [listLoading, setListLoading] = useState(false);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editRow, setEditRow] = useState<EntryRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwAgain, setPwAgain] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);
  const [showPwFields, setShowPwFields] = useState(true);

  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState<string | null>(null);
  const [newAdminUser, setNewAdminUser] = useState("");
  const [newAdminPass, setNewAdminPass] = useState("");
  const [newAdminRole, setNewAdminRole] = useState<AdminRole>("editor_admin");
  const [newAdminMsg, setNewAdminMsg] = useState<string | null>(null);
  const [newAdminErr, setNewAdminErr] = useState<string | null>(null);
  const [newAdminSaving, setNewAdminSaving] = useState(false);
  const [userActionId, setUserActionId] = useState<string | null>(null);
  const [listBanner, setListBanner] = useState<string | null>(null);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftCategory, setDraftCategory] = useState<EntryCategory | "">("");

  const [platformMembers, setPlatformMembers] = useState<PlatformMemberRow[]>(
    []
  );
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);
  const [devLastMemberPatchTargetId, setDevLastMemberPatchTargetId] = useState<
    string | null
  >(null);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/session", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        username?: string;
        role?: AdminRole;
      };
      if (!res.ok || !data.ok) {
        setSessionOk(false);
        setAdminUsername(null);
        setAdminRole(null);
        return;
      }
      if (data.role !== "super_admin" && data.role !== "editor_admin") {
        setSessionOk(false);
        setAdminUsername(null);
        setAdminRole(null);
        return;
      }
      setAdminUsername(
        typeof data.username === "string" ? data.username : null
      );
      setAdminRole(data.role);
      setSessionOk(true);
    } catch {
      setSessionOk(false);
      setAdminUsername(null);
      setAdminRole(null);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const loadEntries = useCallback(async () => {
    setListLoading(true);
    setListBanner(null);
    try {
      const res = await fetch("/api/admin/entries", {
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        entries?: EntryRow[];
        authorByEntryId?: Record<string, string>;
      };
      if (!res.ok) {
        setEntries([]);
        setAuthorByEntryId({});
        setListBanner(data.error ?? "Entry listesi alınamadı.");
        return;
      }
      setEntries(data.entries ?? []);
      setAuthorByEntryId(data.authorByEntryId ?? {});
    } catch {
      setEntries([]);
      setAuthorByEntryId({});
      setListBanner("Ağ hatası.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionOk !== true) return;
    void loadEntries();
  }, [sessionOk, loadEntries]);

  const loadPlatformMembers = useCallback(async () => {
    setMembersLoading(true);
    setMembersError(null);
    try {
      const res = await fetch("/api/admin/members", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        members?: PlatformMemberRow[];
      };
      if (!res.ok) {
        setPlatformMembers([]);
        setMembersError(data.error ?? "Üye listesi alınamadı.");
        return;
      }
      setPlatformMembers(
        (data.members ?? []).map((row) => {
          const r = row as Record<string, unknown>;
          const normalized = normalizePlatformMemberRow(
            row as PlatformMemberRow
          );
          if (
            process.env.NODE_ENV !== "development" ||
            !isCeyhunAlemdagDebugRow(normalized.display_label)
          ) {
            return normalized;
          }
          return {
            ...normalized,
            __debugMemberListRaw: {
              id: r["id"],
              email: r["email"],
              full_name: r["full_name"],
              agreement_accepted: r["agreement_accepted"],
              suspend: r["is_platform_access_suspended"],
              reason: r["platform_access_suspended_reason"],
              at: r["platform_access_suspended_at"],
            },
          };
        })
      );
    } catch {
      setPlatformMembers([]);
      setMembersError("Ağ hatası.");
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const applyMemberAction = useCallback(
    async (
      m: PlatformMemberRow,
      action: "suspend" | "reactivate" | "anonymize"
    ) => {
      if (action === "anonymize") {
        if (
          !window.confirm(
            "Bu üyenin profil ve iletişim bilgileri anonimleştirilecek; görünen ad ve e-posta kayıtları güvenli biçimde kaldırılır. Yazı ve yorum içerikleri aynı kalır. Devam edilsin mi?"
          )
        ) {
          return;
        }
      }
      if (action === "suspend") {
        const gerekce = window.prompt(
          "Askı gerekçesi (isteğe bağlı; boş bırakılabilir):"
        );
        if (gerekce === null) {
          return;
        }
        setMemberActionId(m.id);
        setMembersError(null);
        try {
          const payload: { action: "suspend"; reason?: string } = {
            action: "suspend",
          };
          const t = gerekce.trim();
          if (t.length > 0) {
            payload.reason = t;
          }
          const res = await fetch(
            `/api/admin/members/${encodeURIComponent(m.id)}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(payload),
            }
          );
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          if (!res.ok) {
            console.error("[admin UI] suspend failed", {
              status: res.status,
              error: data.error ?? null,
              memberId: m.id,
            });
            setMembersError(
              data.error ?? "İşlem şu an tamamlanamadı. Biraz sonra tekrar deneyin."
            );
            return;
          }
          if (process.env.NODE_ENV === "development") {
            setDevLastMemberPatchTargetId(m.id);
          }
          await loadPlatformMembers();
        } catch (e) {
          console.error("[admin UI] suspend fetch error", e);
          setMembersError("Ağ hatası.");
        } finally {
          setMemberActionId(null);
        }
        return;
      }
      setMemberActionId(m.id);
      setMembersError(null);
      try {
        const res = await fetch(`/api/admin/members/${encodeURIComponent(m.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!res.ok) {
          console.error("[admin UI] member PATCH failed", {
            status: res.status,
            action,
            error: data.error ?? null,
            memberId: m.id,
          });
          setMembersError(
            data.error ?? "İşlem şu an tamamlanamadı. Biraz sonra tekrar deneyin."
          );
          return;
        }
        if (process.env.NODE_ENV === "development") {
          setDevLastMemberPatchTargetId(m.id);
        }
        await loadPlatformMembers();
      } catch (e) {
        console.error("[admin UI] member PATCH fetch error", e);
        setMembersError("Ağ hatası.");
      } finally {
        setMemberActionId(null);
      }
    },
    [loadPlatformMembers]
  );

  useEffect(() => {
    if (sessionOk !== true) return;
    void loadPlatformMembers();
  }, [sessionOk, loadPlatformMembers]);

  const loadAdminUsers = useCallback(async () => {
    setAdminUsersLoading(true);
    setAdminUsersError(null);
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        users?: AdminUserRow[];
      };
      if (!res.ok) {
        setAdminUsersError(data.error ?? "Yönetici listesi alınamadı.");
        setAdminUsers([]);
        return;
      }
      setAdminUsers(data.users ?? []);
    } catch {
      setAdminUsersError("Ağ hatası.");
      setAdminUsers([]);
    } finally {
      setAdminUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionOk !== true || !isSuperAdminRole(adminRole ?? "editor_admin")) {
      return;
    }
    void loadAdminUsers();
  }, [sessionOk, adminRole, loadAdminUsers]);

  const canManageEntriesFully = isSuperAdminRole(adminRole ?? "editor_admin");

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        username?: string;
        role?: AdminRole;
      };
      if (!res.ok) {
        setLoginError(data.error ?? "Giriş başarısız.");
        return;
      }
      if (data.role !== "super_admin" && data.role !== "editor_admin") {
        setLoginError("Oturum rolü geçersiz.");
        return;
      }
      setLoginPass("");
      setAdminUsername(
        typeof data.username === "string" ? data.username : null
      );
      setAdminRole(data.role);
      setSessionOk(true);
    } catch {
      setLoginError("Ağ hatası.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function onLogout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    setSessionOk(false);
    setEntries([]);
    setPlatformMembers([]);
    setMembersError(null);
    setAdminUsername(null);
    setAdminRole(null);
    setAdminUsers([]);
  }

  async function onSubmitNew(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setShowSuccess(false);

    const title = draftTitle.trim();
    const content = draftContent.trim();
    const category =
      draftCategory && draftCategory.length > 0 ? draftCategory : null;

    if (!title) {
      setSubmitError("Başlık gerekli.");
      return;
    }
    if (!content) {
      setSubmitError("İçerik gerekli.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          content,
          category,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setSubmitting(false);
      if (!res.ok) {
        setSubmitError(data.error ?? "Kayıt oluşturulamadı.");
        return;
      }
    } catch {
      setSubmitting(false);
      setSubmitError("Ağ hatası.");
      return;
    }

    setDraftTitle("");
    setDraftContent("");
    setDraftCategory("");
    setShowSuccess(true);
    void loadEntries();
  }

  async function handleDeleteEntry(entryId: string) {
    if (!canManageEntriesFully) {
      setListBanner(
        "Entry silmek yalnızca tam yetkili yönetici (super_admin) içindir."
      );
      return;
    }
    if (!window.confirm("Bu entry silinsin mi?")) return;
    setDeleteError(null);
    setDeletingId(entryId);
    try {
      const res = await fetch(`/api/admin/entries/${entryId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setDeletingId(null);
      if (!res.ok) {
        setDeleteError(data.error ?? "Silinemedi.");
        return;
      }
      setEntries((prev) => prev.filter((r) => r.id !== entryId));
      void loadEntries();
    } catch {
      setDeletingId(null);
      setDeleteError("Ağ hatası.");
    }
  }

  function openEdit(row: EntryRow) {
    setEditRow(row);
    setEditTitle(row.title);
    setEditContent(row.content);
    setEditCategory(
      normalizeEntryCategory(row.category) ?? row.category ?? ""
    );
    setEditError(null);
  }

  async function saveEdit() {
    if (!editRow) return;
    if (!canManageEntriesFully) {
      setEditError(
        "Entry düzenlemek yalnızca tam yetkili yönetici (super_admin) içindir."
      );
      return;
    }
    setEditError(null);
    setEditSaving(true);
    const title = editTitle.trim();
    const content = editContent.trim();
    const category = editCategory.trim() || null;
    if (!title || !content) {
      setEditError("Başlık ve içerik zorunlu.");
      setEditSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/entries/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, content, category }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setEditSaving(false);
      if (!res.ok) {
        setEditError(data.error ?? "Kaydedilemedi.");
        return;
      }
      setEditRow(null);
      void loadEntries();
    } catch {
      setEditSaving(false);
      setEditError("Ağ hatası.");
    }
  }

  function openEditGuarded(row: EntryRow) {
    if (!canManageEntriesFully) {
      setListBanner(
        "Entry düzenlemek yalnızca tam yetkili yönetici (super_admin) içindir."
      );
      return;
    }
    setListBanner(null);
    openEdit(row);
  }

  async function onCreateAdmin(e: FormEvent) {
    e.preventDefault();
    setNewAdminErr(null);
    setNewAdminMsg(null);
    setNewAdminSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: newAdminUser,
          password: newAdminPass,
          role: newAdminRole,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setNewAdminErr(data.error ?? "Yönetici oluşturulamadı.");
        return;
      }
      setNewAdminMsg("Yönetici oluşturuldu.");
      setNewAdminUser("");
      setNewAdminPass("");
      setNewAdminRole("editor_admin");
      void loadAdminUsers();
    } catch {
      setNewAdminErr("Ağ hatası.");
    } finally {
      setNewAdminSaving(false);
    }
  }

  async function toggleUserActive(u: AdminUserRow) {
    if (u.username === SUPER_ADMIN_USERNAME) return;
    setUserActionId(u.id);
    setAdminUsersError(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: !u.is_active }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setAdminUsersError(data.error ?? "Durum güncellenemedi.");
        return;
      }
      void loadAdminUsers();
    } catch {
      setAdminUsersError("Ağ hatası.");
    } finally {
      setUserActionId(null);
    }
  }

  async function deleteAdminUser(u: AdminUserRow) {
    if (u.username === SUPER_ADMIN_USERNAME) return;
    if (
      !window.confirm(
        `${u.username} kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`
      )
    ) {
      return;
    }
    setUserActionId(u.id);
    setAdminUsersError(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setAdminUsersError(data.error ?? "Silinemedi.");
        return;
      }
      void loadAdminUsers();
    } catch {
      setAdminUsersError("Ağ hatası.");
    } finally {
      setUserActionId(null);
    }
  }

  async function changeUserRole(u: AdminUserRow, role: AdminRole) {
    if (u.username === SUPER_ADMIN_USERNAME) return;
    if (u.role === role) return;
    setUserActionId(u.id);
    setAdminUsersError(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setAdminUsersError(data.error ?? "Rol güncellenemedi.");
        return;
      }
      void loadAdminUsers();
    } catch {
      setAdminUsersError("Ağ hatası.");
    } finally {
      setUserActionId(null);
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwErr(null);
    setPwMsg(null);
    setPwLoading(true);
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: pwCurrent,
          newPassword: pwNew,
          newPasswordAgain: pwAgain,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setPwErr(data.error ?? "İşlem başarısız.");
        return;
      }
      setPwMsg(data.message ?? "Şifre güncellendi.");
      setPwCurrent("");
      setPwNew("");
      setPwAgain("");
    } catch {
      setPwErr("Ağ hatası.");
    } finally {
      setPwLoading(false);
    }
  }

  const stats = useMemo(() => {
    const n = entries.length;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = entries.filter(
      (e) => new Date(e.created_at).getTime() >= weekAgo
    ).length;
    return { n, recent };
  }, [entries]);

  const applyTemplate = (text: string) => {
    setDraftContent((prev) => (prev.trim() ? `${prev}\n\n${text}` : text));
  };

  if (sessionOk === null) {
    return (
      <main className="admin-page flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <p className="admin-loading-text">Oturum kontrol ediliyor…</p>
      </main>
    );
  }

  if (!sessionOk) {
    return (
      <main className="admin-page flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-200">
        <div className="w-full max-w-[400px] rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-xl">
          <div className="mb-8 text-center">
            <p className="admin-eyebrow">61Larus</p>
            <h1 className="admin-title-gate">Yönetim girişi</h1>
            <p className="admin-lede-gate">
              Bu alan yalnızca yetkili kullanıcılar içindir.
            </p>
          </div>
          <form onSubmit={(e) => void onLogin(e)} className="space-y-4">
            {loginError ? (
              <p className="admin-msg-error rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200">
                {loginError}
              </p>
            ) : null}
            <label className="block">
              <span className="admin-label">Kullanıcı adı</span>
              <input
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                autoComplete="username"
                className="admin-field w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none ring-emerald-500/0 transition focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="admin-label">Şifre</span>
              <input
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                autoComplete="current-password"
                className="admin-field w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none ring-emerald-500/0 transition focus:ring-2"
              />
            </label>
            <button
              type="submit"
              disabled={loginLoading}
              className="admin-btn-text admin-btn-text--emph w-full rounded-lg bg-emerald-600 py-2.5 text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {loginLoading ? "Giriş…" : "Giriş yap"}
            </button>
          </form>
          <p className="admin-footnote-gate text-center">
            <Link href="/" className="text-slate-400 hover:text-white">
              Ana siteye dön
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="admin-eyebrow">Yönetim paneli</p>
            <h1 className="admin-title-page">İçerik ve yönetim</h1>
            <p className="admin-session-line">
              Oturum:{" "}
              <span className="admin-session-val">{adminUsername ?? "—"}</span>
              {" · "}Rol:{" "}
              <span className="admin-session-val">
                {adminRole === "super_admin"
                  ? "Tam yetki (super_admin)"
                  : adminRole === "editor_admin"
                    ? "Editör (editor_admin)"
                    : "—"}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`admin-badge-role rounded-full px-2.5 py-1 ${
                canManageEntriesFully
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-amber-500/15 text-amber-200"
              }`}
            >
              {canManageEntriesFully ? "Tam içerik yetkisi" : "Yalnızca yeni entry"}
            </span>
            <Link
              href="/"
              className="admin-btn-text rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800"
            >
              Ana sayfa
            </Link>
            <button
              type="button"
              onClick={() => void onLogout()}
              className="admin-btn-text rounded-lg border border-slate-600 px-3 py-2 text-slate-300 hover:bg-slate-800"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {!canManageEntriesFully ? (
          <div className="admin-callout rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-amber-100/95">
            Bu hesap <strong className="font-semibold">editör</strong> rolünde:
            yalnızca yeni entry oluşturabilirsiniz. Mevcut kayıtları düzenleme,
            silme, yayın durumu veya yönetici işlemleri kapalıdır; ilgili
            düğmeler gösterilmez.
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="admin-stat-label">Toplam başlık</p>
            <p className="admin-stat-value">{stats.n}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="admin-stat-label">Son 7 gün</p>
            <p className="admin-stat-value">{stats.recent}</p>
          </div>
        </div>

        <section className="admin-card-section rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="admin-section-title">Üyeler</h2>
          <p className="admin-helper">
            Kaynak: <code className="admin-code">public.users</code>; e-posta
            boşsa <code className="admin-code">auth.users</code> eşleşmesi
            kullanılır. Sıra:{" "}
            <strong className="font-medium text-slate-300">son güncelleme</strong>{" "}
            (yeniler üstte). Tam yetkili yönetici üyelik askıya alma, anonimleştirme
            ve yeniden etkinleştirme yapabilir; kalıcı silme bu aşamada yoktur.
          </p>
          {membersError ? (
            <p className="admin-msg-error mt-3 text-red-300">{membersError}</p>
          ) : null}
          <div className="admin-members-table-wrap mt-4 min-w-0 max-w-full rounded-xl border border-slate-800">
            <table className="admin-members-table w-full table-fixed border-collapse text-left text-sm">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[30%]" />
                <col className="w-[22%]" />
                <col className="w-[10%]" />
                {canManageEntriesFully ? <col className="w-[16%]" /> : null}
              </colgroup>
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="admin-th px-2.5 py-2.5">Görünen ad</th>
                  <th className="admin-th px-2.5 py-2.5">E-posta</th>
                  <th className="admin-th px-2.5 py-2.5">Durum</th>
                  <th className="admin-th px-2.5 py-2.5">Sözleşme</th>
                  {canManageEntriesFully ? (
                    <th className="admin-th px-2.5 py-2.5 text-right sm:text-left">
                      Yönetim
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {membersLoading ? (
                  <tr>
                    <td
                      colSpan={canManageEntriesFully ? 5 : 4}
                      className="admin-td px-3 py-8 text-center"
                    >
                      Yükleniyor…
                    </td>
                  </tr>
                ) : platformMembers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canManageEntriesFully ? 5 : 4}
                      className="admin-td px-3 py-8 text-center"
                    >
                      Kayıt yok.
                    </td>
                  </tr>
                ) : (
                  platformMembers.map((m) => {
                    const reasonLine = platformSuspendReasonLine(m);
                    const dateLine = platformSuspendDateLine(m);
                    const showSuspendDetails = m.is_platform_access_suspended === true;
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-slate-800/80 hover:bg-slate-900/50 align-top"
                      >
                        <td className="admin-td-strong px-2.5 py-2">
                          <span className="line-clamp-2 break-words">
                            {m.display_label}
                          </span>
                        </td>
                        <td
                          className="admin-td max-w-0 truncate px-2.5 py-2 text-slate-300/95"
                          title={m.email ?? undefined}
                        >
                          {m.email ?? "—"}
                        </td>
                        <td className="admin-td px-2.5 py-2">
                          <div className="min-w-0">
                            <span
                              className={
                                m.is_platform_access_suspended === true
                                  ? "inline-block rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[0.8125rem] font-medium text-amber-100/95"
                                  : memberIsNonManageable(m)
                                    ? "text-[0.8125rem] text-slate-400"
                                    : "text-[0.8125rem] font-medium text-emerald-200/90"
                              }
                            >
                              {platformMemberStatusLabel(m)}
                            </span>
                            {showSuspendDetails ? (
                              <div className="mt-1.5 min-w-0 space-y-0.5 text-xs leading-tight text-slate-300/65">
                                <p>
                                  <span className="text-slate-400/55">
                                    askı nedeni:{" "}
                                  </span>
                                  <span className="break-words text-slate-300/80">
                                    {reasonLine ?? "—"}
                                  </span>
                                </p>
                                <p>
                                  <span className="text-slate-400/55">
                                    askı tarihi:{" "}
                                  </span>
                                  <span className="tabular-nums text-slate-300/85">
                                    {dateLine ?? "—"}
                                  </span>
                                </p>
                              </div>
                            ) : null}
                            {process.env.NODE_ENV === "development" &&
                            isCeyhunAlemdagDebugRow(m.display_label) &&
                            m.__debugMemberListRaw ? (
                              <div className="mt-1.5 break-words font-mono text-[0.6rem] leading-tight text-slate-500/70">
                                <p>
                                  suspend raw:{" "}
                                  {formatDebugUnknown(
                                    m.__debugMemberListRaw.suspend
                                  )}
                                </p>
                                <p>
                                  reason raw:{" "}
                                  {formatDebugUnknown(
                                    m.__debugMemberListRaw.reason
                                  )}
                                </p>
                                <p>
                                  at raw:{" "}
                                  {formatDebugUnknown(m.__debugMemberListRaw.at)}
                                </p>
                                <p>
                                  id raw:{" "}
                                  {formatDebugUnknown(m.__debugMemberListRaw.id)}
                                </p>
                                <p>
                                  email raw:{" "}
                                  {formatDebugUnknown(
                                    m.__debugMemberListRaw.email
                                  )}
                                </p>
                                <p>
                                  full_name raw:{" "}
                                  {formatDebugUnknown(
                                    m.__debugMemberListRaw.full_name
                                  )}
                                </p>
                                <p>
                                  agreement raw:{" "}
                                  {formatDebugUnknown(
                                    m.__debugMemberListRaw.agreement_accepted
                                  )}
                                </p>
                                <p>liste public.users id: {m.id}</p>
                                <p>
                                  PATCH hedef (son başarılı):{" "}
                                  {devLastMemberPatchTargetId ?? "—"}
                                </p>
                                <p>ana sayfa: auth id = aynı id (kayıt buna göre)</p>
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="admin-td whitespace-nowrap px-2.5 py-2 text-slate-300/90">
                          {platformMemberAgreementLabel(m)}
                        </td>
                        {canManageEntriesFully ? (
                          <td className="admin-td px-2 py-2 text-right sm:text-left">
                            {memberIsNonManageable(m) ? (
                              <span
                                className="inline-block text-[0.6875rem] leading-snug text-slate-500"
                                title={
                                  memberIsAnonymized(m)
                                    ? "Profil anonimleştirildi"
                                    : "Silinmiş kullanıcı kaydı"
                                }
                              >
                                {memberManagementPassiveLabel(m)}
                              </span>
                            ) : (
                              <div className="admin-member-actions-compact inline-flex max-w-full flex-col items-end gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-1">
                                {m.is_platform_access_suspended === true ? (
                                  <button
                                    type="button"
                                    className="admin-btn-text rounded border border-slate-600 px-1.5 py-0.5 text-[0.6875rem] leading-tight text-slate-300 hover:bg-slate-800"
                                    disabled={memberActionId === m.id}
                                    onClick={() =>
                                      void applyMemberAction(m, "reactivate")
                                    }
                                  >
                                    {memberActionId === m.id
                                      ? "…"
                                      : "Yeniden etkinleştir"}
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="admin-btn-text rounded border border-slate-600 px-1.5 py-0.5 text-[0.6875rem] leading-tight text-slate-300 hover:bg-slate-800"
                                      disabled={memberActionId === m.id}
                                      onClick={() =>
                                        void applyMemberAction(m, "suspend")
                                      }
                                    >
                                      {memberActionId === m.id
                                        ? "…"
                                        : "Askıya al"}
                                    </button>
                                    <button
                                      type="button"
                                      className="admin-btn-text rounded border border-slate-600 px-1.5 py-0.5 text-[0.6875rem] leading-tight text-slate-300 hover:bg-slate-800"
                                      disabled={memberActionId === m.id}
                                      onClick={() =>
                                        void applyMemberAction(m, "anonymize")
                                      }
                                    >
                                      {memberActionId === m.id
                                        ? "…"
                                        : "Anonimleştir"}
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {canManageEntriesFully ? (
          <>
            <section className="admin-card-section rounded-xl border border-slate-800 bg-slate-900/40 p-6">
              <h2 className="admin-section-title">Yönetici ayarları</h2>
              <p className="admin-helper">
                Tam yetkili oturum bilgisi ve şifre güncelleme. Şifreler{" "}
                <code className="admin-code">admin_users</code> tablosunda
                scrypt ile saklanır; sunucuda{" "}
                <code className="admin-code">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
                gerekir.
              </p>
              <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2">
                  <dt className="admin-kv-label">Kullanıcı</dt>
                  <dd className="admin-kv-value">{adminUsername ?? "—"}</dd>
                </div>
                <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2">
                  <dt className="admin-kv-label">Rol</dt>
                  <dd className="admin-kv-value">super_admin</dd>
                </div>
              </dl>
              <h3 className="admin-subsection-title mt-6">Şifre değiştir</h3>
              <p className="admin-helper admin-helper--tight-top max-w-md">
                Test için alanlar varsayılan olarak görünür; gizlemek için
                düğmeyi kullanın.
              </p>
              <button
                type="button"
                onClick={() => setShowPwFields((v) => !v)}
                className="admin-btn-text mt-2 w-fit rounded-lg border border-slate-600 px-3 py-1.5 text-slate-300 hover:bg-slate-800"
              >
                {showPwFields ? "Şifreleri gizle" : "Şifreleri göster"}
              </button>
              <form
                onSubmit={(e) => void onChangePassword(e)}
                className="mt-3 grid max-w-md gap-3"
              >
                {pwErr ? (
                  <p className="admin-msg-error text-red-300">{pwErr}</p>
                ) : null}
                {pwMsg ? (
                  <p className="admin-msg-success text-emerald-400">{pwMsg}</p>
                ) : null}
                <input
                  type={showPwFields ? "text" : "password"}
                  placeholder="Mevcut şifre"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  autoComplete="current-password"
                  className="admin-field rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                />
                <input
                  type={showPwFields ? "text" : "password"}
                  placeholder="Yeni şifre (en az 10 karakter)"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  autoComplete="new-password"
                  className="admin-field rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                />
                <input
                  type={showPwFields ? "text" : "password"}
                  placeholder="Yeni şifre tekrar"
                  value={pwAgain}
                  onChange={(e) => setPwAgain(e.target.value)}
                  autoComplete="new-password"
                  className="admin-field rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                />
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="admin-btn-text admin-btn-text--emph rounded-lg bg-slate-100 py-2 text-slate-900 hover:bg-white disabled:opacity-50"
                >
                  {pwLoading ? "İşleniyor…" : "Şifreyi güncelle"}
                </button>
              </form>
            </section>

            <section className="admin-card-section rounded-xl border border-slate-800 bg-slate-900/40 p-6">
              <h2 className="admin-section-title">Yeni yönetici ekle</h2>
              <p className="admin-helper">
                Geçici şifre ile hesap oluşturulur; kullanıcı ilk girişten sonra
                şifresini (super_admin ise bu panelden) güncelleyebilir.
              </p>
              <form
                onSubmit={(e) => void onCreateAdmin(e)}
                className="mt-4 grid max-w-lg gap-3 sm:grid-cols-2"
              >
                {newAdminErr ? (
                  <p className="admin-msg-error sm:col-span-2 text-red-300">
                    {newAdminErr}
                  </p>
                ) : null}
                {newAdminMsg ? (
                  <p className="admin-msg-success sm:col-span-2 text-emerald-400">
                    {newAdminMsg}
                  </p>
                ) : null}
                <label className="block sm:col-span-1">
                  <span className="admin-label">Kullanıcı adı</span>
                  <input
                    value={newAdminUser}
                    onChange={(e) => setNewAdminUser(e.target.value)}
                    autoComplete="off"
                    className="admin-field mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  />
                </label>
                <label className="block sm:col-span-1">
                  <span className="admin-label">Geçici şifre</span>
                  <input
                    type="password"
                    value={newAdminPass}
                    onChange={(e) => setNewAdminPass(e.target.value)}
                    autoComplete="new-password"
                    className="admin-field mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="admin-label">Rol</span>
                  <select
                    value={newAdminRole}
                    onChange={(e) =>
                      setNewAdminRole(e.target.value as AdminRole)
                    }
                    className="admin-field mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  >
                    <option value="editor_admin">editor_admin — yalnızca entry</option>
                    <option value="super_admin">super_admin — tam yetki</option>
                  </select>
                </label>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={newAdminSaving}
                    className="admin-btn-text admin-btn-text--emph rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {newAdminSaving ? "Kaydediliyor…" : "Yöneticiyi oluştur"}
                  </button>
                </div>
              </form>
            </section>

            <section className="admin-card-section rounded-xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="admin-section-title">Yönetici listesi</h2>
                  <p className="admin-helper">
                    Ana hesap{" "}
                    <code className="admin-code">{SUPER_ADMIN_USERNAME}</code>{" "}
                    korunur; silinemez veya devre dışı bırakılamaz.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadAdminUsers()}
                  className="admin-btn-text rounded-lg border border-slate-600 px-3 py-1.5 text-slate-300 hover:bg-slate-800"
                >
                  Yenile
                </button>
              </div>
              {adminUsersError ? (
                <p className="admin-msg-error mt-3 text-red-300">
                  {adminUsersError}
                </p>
              ) : null}
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80">
                      <th className="admin-th px-3 py-3">Kullanıcı</th>
                      <th className="admin-th px-3 py-3">Rol</th>
                      <th className="admin-th px-3 py-3">Oluşturulma</th>
                      <th className="admin-th px-3 py-3">Durum</th>
                      <th className="admin-th px-3 py-3 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsersLoading ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="admin-td px-3 py-8 text-center"
                        >
                          Yükleniyor…
                        </td>
                      </tr>
                    ) : adminUsers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="admin-td px-3 py-8 text-center"
                        >
                          Kayıt yok.
                        </td>
                      </tr>
                    ) : (
                      adminUsers.map((u) => {
                        const locked = u.username === SUPER_ADMIN_USERNAME;
                        const busy = userActionId === u.id;
                        return (
                          <tr
                            key={u.id}
                            className="border-b border-slate-800/80 hover:bg-slate-900/50"
                          >
                            <td className="admin-td-strong px-3 py-2">
                              {u.username}
                              {locked ? (
                                <span className="admin-td-mono ml-2 uppercase">
                                  korumalı
                                </span>
                              ) : null}
                            </td>
                            <td className="admin-td px-3 py-2">
                              {locked ? (
                                u.role
                              ) : (
                                <select
                                  value={u.role}
                                  disabled={busy}
                                  onChange={(e) =>
                                    void changeUserRole(
                                      u,
                                      e.target.value as AdminRole
                                    )
                                  }
                                  className="admin-field rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                >
                                  <option value="editor_admin">
                                    editor_admin
                                  </option>
                                  <option value="super_admin">
                                    super_admin
                                  </option>
                                </select>
                              )}
                            </td>
                            <td className="admin-td whitespace-nowrap px-3 py-2">
                              {u.created_at
                                ? new Date(u.created_at).toLocaleString("tr-TR")
                                : "—"}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`admin-btn-text rounded-md px-2 py-0.5 ${
                                  u.is_active
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-slate-600/30 text-slate-400"
                                }`}
                              >
                                {u.is_active ? "Aktif" : "Pasif"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              {locked ? (
                                <span className="admin-td-mono">—</span>
                              ) : (
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void toggleUserActive(u)}
                                    className="admin-btn-text text-slate-300 hover:underline disabled:opacity-50"
                                  >
                                    {u.is_active ? "Pasifleştir" : "Etkinleştir"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void deleteAdminUser(u)}
                                    className="admin-btn-text text-red-400 hover:underline disabled:opacity-50"
                                  >
                                    Sil
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}

        <section className="admin-card-section rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="admin-section-title">Yeni entry oluştur</h2>
          <p className="admin-helper">
            Kayıt, oturumlu{" "}
            <code className="admin-code">/api/admin/entries</code> uç noktası
            ile oluşturulur. Kategori kolonu yoksa yalnızca başlık ve içerik
            yazılır.
          </p>
          {showSuccess ? (
            <p className="admin-msg-success mt-3 text-emerald-400">
              Kayıt oluşturuldu.
            </p>
          ) : null}
          {submitError ? (
            <p className="admin-msg-error mt-3 text-red-300">{submitError}</p>
          ) : null}
          <form
            onSubmit={(e) => void onSubmitNew(e)}
            className="mt-4 space-y-4"
          >
            <label className="block">
              <span className="admin-label">Başlık</span>
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                maxLength={161}
                className="admin-field mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="admin-label">Kategori</span>
              <select
                value={draftCategory}
                onChange={(e) =>
                  setDraftCategory(e.target.value as EntryCategory | "")
                }
                className="admin-field mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              >
                <option value="">— Seçin —</option>
                {FEED_CATEGORY_OPTIONS.filter((o) => o.id !== "all").map(
                  (o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  )
                )}
              </select>
            </label>
            <div>
              <span className="admin-label m-0">Hızlı şablonlar</span>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    applyTemplate(
                      "@örnek_kullanici selam — mention testi için."
                    )
                  }
                  className="admin-chip-text rounded-md border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800"
                >
                  Mention şablonu
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyTemplate(
                      "Yanıt zinciri testi: bu metni yorumlayıp altına cevap verin."
                    )
                  }
                  className="admin-chip-text rounded-md border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800"
                >
                  Yanıt zinciri
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyTemplate(
                      "Kısa test içeriği — " + new Date().toISOString()
                    )
                  }
                  className="admin-chip-text rounded-md border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800"
                >
                  Zaman damgalı metin
                </button>
              </div>
            </div>
            <label className="block">
              <span className="admin-label">İçerik</span>
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                rows={8}
                className="admin-field mt-1 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="admin-btn-text admin-btn-text--emph rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting ? "Kaydediliyor…" : "Yayınla"}
            </button>
          </form>
        </section>

        <section>
          <div className="admin-section-head">
            <h2 className="admin-section-title">Entry listesi</h2>
            <p className="admin-helper">
              Kolonlar: başlık, kategori, durum (şu an tüm kayıtlar canlı
              görünür), tarih, yazar (ilk yorumu yazan). Düzenleme ve silme
              yalnızca tam yetkili yöneticidedir.
            </p>
          </div>
          {listBanner ? (
            <p className="admin-callout mt-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-amber-100">
              {listBanner}
            </p>
          ) : null}
          {deleteError ? (
            <p className="admin-msg-error mt-2 text-red-300">{deleteError}</p>
          ) : null}
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="admin-th px-3 py-3">Başlık</th>
                  <th className="admin-th px-3 py-3">Kategori</th>
                  <th className="admin-th px-3 py-3">Durum</th>
                  <th className="admin-th px-3 py-3">Tarih</th>
                  <th className="admin-th px-3 py-3">Yazar</th>
                  <th className="admin-th px-3 py-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="admin-td px-3 py-8 text-center"
                    >
                      Yükleniyor…
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="admin-td px-3 py-8 text-center"
                    >
                      Kayıt yok.
                    </td>
                  </tr>
                ) : (
                  entries.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-800/80 hover:bg-slate-900/50"
                    >
                      <td className="admin-td-strong max-w-[220px] px-3 py-2">
                        <span className="line-clamp-2">{row.title}</span>
                      </td>
                      <td className="admin-td whitespace-nowrap px-3 py-2">
                        {categoryLabel(row.category)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className="admin-btn-text rounded-md bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                          Canlı
                        </span>
                      </td>
                      <td className="admin-td whitespace-nowrap px-3 py-2">
                        {row.created_at
                          ? new Date(row.created_at).toLocaleString("tr-TR")
                          : "—"}
                      </td>
                      <td className="admin-td max-w-[140px] truncate px-3 py-2">
                        {authorByEntryId[row.id] ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {canManageEntriesFully ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditGuarded(row)}
                              className="admin-btn-text mr-2 text-emerald-400 hover:underline"
                            >
                              Düzenle
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === row.id}
                              onClick={() => void handleDeleteEntry(row.id)}
                              className="admin-btn-text text-red-400 hover:underline disabled:opacity-50"
                            >
                              Sil
                            </button>
                          </>
                        ) : (
                          <span className="admin-td-mono">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {editRow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="admin-modal-title">Entry düzenle</h3>
            {editError ? (
              <p className="admin-msg-error mt-2 text-red-300">{editError}</p>
            ) : null}
            <label className="mt-4 block">
              <span className="admin-label">Başlık</span>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="admin-field mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              />
            </label>
            <label className="mt-3 block">
              <span className="admin-label">Kategori</span>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="admin-field mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              >
                <option value="">—</option>
                {FEED_CATEGORY_OPTIONS.filter((o) => o.id !== "all").map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="admin-label">İçerik</span>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={10}
                className="admin-field mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditRow(null)}
                className="admin-btn-text rounded-lg border border-slate-600 px-3 py-2 text-slate-300"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={() => void saveEdit()}
                className="admin-btn-text admin-btn-text--emph rounded-lg bg-emerald-600 px-3 py-2 text-white disabled:opacity-50"
              >
                {editSaving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
