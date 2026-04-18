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
  type EntryCategory,
} from "@/lib/entry-category";
import {
  combinedFullNameFromParts,
  resolveVisibleName,
  type DisplayNameModePref,
} from "@/lib/visible-name";
import {
  SUPER_ADMIN_USERNAME,
  isSuperAdminRole,
  type AdminRole,
} from "@/lib/admin-role";

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

function authorLabelFromUserRow(row: {
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  display_name_mode: string | null;
  email: string | null;
}): string {
  const full = combinedFullNameFromParts(row.first_name, row.last_name);
  const dm = row.display_name_mode;
  const displayMode: DisplayNameModePref =
    dm === "nickname" || dm === "real_name" ? dm : null;
  return resolveVisibleName({
    fullName: full,
    nickname: row.nickname,
    displayMode,
    emailFallback: row.email,
  });
}

const categoryLabel = (id: string | null): string => {
  if (!id) return "—";
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
    setEditCategory(row.category ?? "");
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
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <p className="text-sm text-slate-400">Oturum kontrol ediliyor…</p>
      </main>
    );
  }

  if (!sessionOk) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-[400px] rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-xl">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500/90">
              61LARUS
            </p>
            <h1 className="mt-2 text-xl font-semibold text-white">
              Yönetim girişi
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Bu alan yalnızca yetkili kullanıcılar içindir.
            </p>
          </div>
          <form onSubmit={(e) => void onLogin(e)} className="space-y-4">
            {loginError ? (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {loginError}
              </p>
            ) : null}
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">Kullanıcı adı</span>
              <input
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                autoComplete="username"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none ring-emerald-500/0 transition focus:ring-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">Şifre</span>
              <input
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none ring-emerald-500/0 transition focus:ring-2"
              />
            </label>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {loginLoading ? "Giriş…" : "Giriş yap"}
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-slate-500">
            <Link href="/" className="text-slate-400 hover:text-white">
              Ana siteye dön
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-emerald-500/90">
              Yönetim paneli
            </p>
            <h1 className="text-lg font-semibold text-white">
              İçerik ve yönetim
            </h1>
            <p className="text-xs text-slate-500">
              Oturum:{" "}
              <span className="text-slate-300">
                {adminUsername ?? "—"}
              </span>{" "}
              · Rol:{" "}
              <span className="text-slate-300">
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
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                canManageEntriesFully
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-amber-500/15 text-amber-200"
              }`}
            >
              {canManageEntriesFully ? "Tam içerik yetkisi" : "Yalnızca yeni entry"}
            </span>
            <Link
              href="/"
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Ana sayfa
            </Link>
            <button
              type="button"
              onClick={() => void onLogout()}
              className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {!canManageEntriesFully ? (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/95">
            Bu hesap <strong className="font-semibold">editör</strong> rolünde:
            yalnızca yeni entry oluşturabilirsiniz. Mevcut kayıtları düzenleme,
            silme, yayın durumu veya yönetici işlemleri kapalıdır; ilgili
            düğmeler gösterilmez.
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-500">Toplam başlık</p>
            <p className="mt-1 text-2xl font-semibold text-white">{stats.n}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-500">Son 7 gün</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {stats.recent}
            </p>
          </div>
        </div>

        {canManageEntriesFully ? (
          <>
            <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
              <h2 className="text-sm font-semibold text-white">
                Yönetici ayarları
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Tam yetkili oturum bilgisi ve şifre güncelleme. Şifreler{" "}
                <code className="text-slate-400">admin_users</code> tablosunda
                scrypt ile saklanır; sunucuda{" "}
                <code className="text-slate-400">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
                gerekir.
              </p>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2">
                  <dt className="text-xs text-slate-500">Kullanıcı</dt>
                  <dd className="font-medium text-white">
                    {adminUsername ?? "—"}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2">
                  <dt className="text-xs text-slate-500">Rol</dt>
                  <dd className="font-medium text-white">super_admin</dd>
                </div>
              </dl>
              <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Şifre değiştir
              </h3>
              <p className="mt-2 max-w-md text-xs text-slate-500">
                Test için alanlar varsayılan olarak görünür; gizlemek için
                düğmeyi kullanın.
              </p>
              <button
                type="button"
                onClick={() => setShowPwFields((v) => !v)}
                className="mt-2 w-fit rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                {showPwFields ? "Şifreleri gizle" : "Şifreleri göster"}
              </button>
              <form
                onSubmit={(e) => void onChangePassword(e)}
                className="mt-3 grid max-w-md gap-3"
              >
                {pwErr ? (
                  <p className="text-sm text-red-300">{pwErr}</p>
                ) : null}
                {pwMsg ? (
                  <p className="text-sm text-emerald-400">{pwMsg}</p>
                ) : null}
                <input
                  type={showPwFields ? "text" : "password"}
                  placeholder="Mevcut şifre"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  autoComplete="current-password"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
                <input
                  type={showPwFields ? "text" : "password"}
                  placeholder="Yeni şifre (en az 10 karakter)"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  autoComplete="new-password"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
                <input
                  type={showPwFields ? "text" : "password"}
                  placeholder="Yeni şifre tekrar"
                  value={pwAgain}
                  onChange={(e) => setPwAgain(e.target.value)}
                  autoComplete="new-password"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-900 hover:bg-white disabled:opacity-50"
                >
                  {pwLoading ? "İşleniyor…" : "Şifreyi güncelle"}
                </button>
              </form>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
              <h2 className="text-sm font-semibold text-white">
                Yeni yönetici ekle
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Geçici şifre ile hesap oluşturulur; kullanıcı ilk girişten sonra
                şifresini (super_admin ise bu panelden) güncelleyebilir.
              </p>
              <form
                onSubmit={(e) => void onCreateAdmin(e)}
                className="mt-4 grid max-w-lg gap-3 sm:grid-cols-2"
              >
                {newAdminErr ? (
                  <p className="sm:col-span-2 text-sm text-red-300">
                    {newAdminErr}
                  </p>
                ) : null}
                {newAdminMsg ? (
                  <p className="sm:col-span-2 text-sm text-emerald-400">
                    {newAdminMsg}
                  </p>
                ) : null}
                <label className="block text-sm sm:col-span-1">
                  <span className="text-slate-400">Kullanıcı adı</span>
                  <input
                    value={newAdminUser}
                    onChange={(e) => setNewAdminUser(e.target.value)}
                    autoComplete="off"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  />
                </label>
                <label className="block text-sm sm:col-span-1">
                  <span className="text-slate-400">Geçici şifre</span>
                  <input
                    type="password"
                    value={newAdminPass}
                    onChange={(e) => setNewAdminPass(e.target.value)}
                    autoComplete="new-password"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="text-slate-400">Rol</span>
                  <select
                    value={newAdminRole}
                    onChange={(e) =>
                      setNewAdminRole(e.target.value as AdminRole)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  >
                    <option value="editor_admin">editor_admin — yalnızca entry</option>
                    <option value="super_admin">super_admin — tam yetki</option>
                  </select>
                </label>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={newAdminSaving}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {newAdminSaving ? "Kaydediliyor…" : "Yöneticiyi oluştur"}
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Yönetici listesi
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Ana hesap{" "}
                    <code className="text-slate-400">{SUPER_ADMIN_USERNAME}</code>{" "}
                    korunur; silinemez veya devre dışı bırakılamaz.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadAdminUsers()}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Yenile
                </button>
              </div>
              {adminUsersError ? (
                <p className="mt-3 text-sm text-red-300">{adminUsersError}</p>
              ) : null}
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3 font-medium">Kullanıcı</th>
                      <th className="px-3 py-3 font-medium">Rol</th>
                      <th className="px-3 py-3 font-medium">Oluşturulma</th>
                      <th className="px-3 py-3 font-medium">Durum</th>
                      <th className="px-3 py-3 font-medium text-right">
                        İşlemler
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsersLoading ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-8 text-center text-slate-500"
                        >
                          Yükleniyor…
                        </td>
                      </tr>
                    ) : adminUsers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-8 text-center text-slate-500"
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
                            <td className="px-3 py-2 font-medium text-white">
                              {u.username}
                              {locked ? (
                                <span className="ml-2 text-[10px] font-normal uppercase text-slate-500">
                                  korumalı
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-slate-400">
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
                                  className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
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
                            <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                              {u.created_at
                                ? new Date(u.created_at).toLocaleString("tr-TR")
                                : "—"}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={
                                  u.is_active
                                    ? "rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300"
                                    : "rounded-md bg-slate-600/30 px-2 py-0.5 text-xs text-slate-400"
                                }
                              >
                                {u.is_active ? "Aktif" : "Pasif"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              {locked ? (
                                <span className="text-xs text-slate-600">—</span>
                              ) : (
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void toggleUserActive(u)}
                                    className="text-xs text-slate-300 hover:underline disabled:opacity-50"
                                  >
                                    {u.is_active ? "Pasifleştir" : "Etkinleştir"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void deleteAdminUser(u)}
                                    className="text-xs text-red-400 hover:underline disabled:opacity-50"
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

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-sm font-semibold text-white">
            Yeni entry oluştur
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Kayıt, oturumlu{" "}
            <code className="text-slate-400">/api/admin/entries</code> uç noktası
            ile oluşturulur. Kategori kolonu yoksa yalnızca başlık ve içerik
            yazılır.
          </p>
          {showSuccess ? (
            <p className="mt-3 text-sm text-emerald-400">Kayıt oluşturuldu.</p>
          ) : null}
          {submitError ? (
            <p className="mt-3 text-sm text-red-300">{submitError}</p>
          ) : null}
          <form
            onSubmit={(e) => void onSubmitNew(e)}
            className="mt-4 space-y-4"
          >
            <label className="block text-sm">
              <span className="text-slate-400">Başlık</span>
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                maxLength={161}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-400">Kategori</span>
              <select
                value={draftCategory}
                onChange={(e) =>
                  setDraftCategory(e.target.value as EntryCategory | "")
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
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
              <span className="text-sm text-slate-400">Hızlı şablonlar</span>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    applyTemplate(
                      "@örnek_kullanici selam — mention testi için."
                    )
                  }
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
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
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
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
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Zaman damgalı metin
                </button>
              </div>
            </div>
            <label className="block text-sm">
              <span className="text-slate-400">İçerik</span>
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                rows={8}
                className="mt-1 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting ? "Kaydediliyor…" : "Yayınla"}
            </button>
          </form>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-white">Entry listesi</h2>
          <p className="text-xs text-slate-500">
            Kolonlar: başlık, kategori, durum (şu an tüm kayıtlar canlı
            görünür), tarih, yazar (ilk yorumu yazan). Düzenleme ve silme
            yalnızca tam yetkili yöneticidedir.
          </p>
          {listBanner ? (
            <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm text-amber-100">
              {listBanner}
            </p>
          ) : null}
          {deleteError ? (
            <p className="mt-2 text-sm text-red-300">{deleteError}</p>
          ) : null}
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 font-medium">Başlık</th>
                  <th className="px-3 py-3 font-medium">Kategori</th>
                  <th className="px-3 py-3 font-medium">Durum</th>
                  <th className="px-3 py-3 font-medium">Tarih</th>
                  <th className="px-3 py-3 font-medium">Yazar</th>
                  <th className="px-3 py-3 font-medium text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-slate-500"
                    >
                      Yükleniyor…
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-slate-500"
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
                      <td className="max-w-[220px] px-3 py-2 font-medium text-white">
                        <span className="line-clamp-2">{row.title}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                        {categoryLabel(row.category)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                          Canlı
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                        {row.created_at
                          ? new Date(row.created_at).toLocaleString("tr-TR")
                          : "—"}
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-2 text-slate-400">
                        {authorByEntryId[row.id] ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {canManageEntriesFully ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditGuarded(row)}
                              className="mr-2 text-xs text-emerald-400 hover:underline"
                            >
                              Düzenle
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === row.id}
                              onClick={() => void handleDeleteEntry(row.id)}
                              className="text-xs text-red-400 hover:underline disabled:opacity-50"
                            >
                              Sil
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
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
            <h3 className="text-base font-semibold text-white">
              Entry düzenle
            </h3>
            {editError ? (
              <p className="mt-2 text-sm text-red-300">{editError}</p>
            ) : null}
            <label className="mt-4 block text-sm">
              <span className="text-slate-400">Başlık</span>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-slate-400">Kategori</span>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              >
                <option value="">—</option>
                {FEED_CATEGORY_OPTIONS.filter((o) => o.id !== "all").map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-slate-400">İçerik</span>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={10}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditRow(null)}
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={() => void saveEdit()}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
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
