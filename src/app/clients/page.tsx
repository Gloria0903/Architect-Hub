"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import {
  Input,
  Field,
  FormRow,
} from "@/components/ui/form-field";
import {
  useStore,
  Client,
} from "@/store/app-store";
import {
  Plus,
  Building2,
  Mail,
  Phone,
  MapPin,
  Pencil,
  Trash2,
  KeyRound,
  Copy,
  Check,
} from "lucide-react";

const emptyForm = {
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
};

export default function ClientsPage() {
  const {
    clients,
    projects,
    addClient,
    updateClient,
    removeClient,
  } = useStore();

  const {
    data: session,
    status: sessionStatus,
  } = useSession();

  const role = session?.user?.role;

  const canManage = role === "ADMIN";

  const [open, setOpen] =
    useState(false);

  const [editTarget, setEditTarget] =
    useState<string | null>(null);

  const [form, setForm] =
    useState(emptyForm);

  const [error, setError] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  function closeCreateModal() {
    if (submitting) return;

    setOpen(false);
    setForm(emptyForm);
    setError("");
  }

  function closeEditModal() {
    if (submitting) return;

    setEditTarget(null);
    setForm(emptyForm);
    setError("");
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!canManage || submitting) {
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await addClient({
        name: form.name.trim(),
        contactPerson:
          form.contactPerson.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      });

      setOpen(false);
      setForm(emptyForm);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to add client."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(id: string) {
    if (!canManage) {
      return;
    }

    const client = clients.find(
      (currentClient) =>
        currentClient.id === id
    );

    if (!client) {
      return;
    }

    setForm({
      name: client.name,
      contactPerson:
        client.contactPerson,
      email: client.email ?? "",
      phone: client.phone ?? "",
      address: client.address ?? "",
    });

    setError("");
    setEditTarget(id);
  }

  async function handleEdit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (
      !canManage ||
      !editTarget ||
      submitting
    ) {
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await updateClient(
        editTarget,
        {
          name: form.name.trim(),
          contactPerson:
            form.contactPerson.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
        }
      );

      setEditTarget(null);
      setForm(emptyForm);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update client."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(
    id: string,
    name: string
  ) {
    if (!canManage || deletingId) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete client "${name}"?\n\n` +
          `A client can only be deleted if they have no projects and no client communication records.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(id);

    try {
      await removeClient(id);
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "Failed to delete client."
      );
    } finally {
      setDeletingId(null);
    }
  }

  /*
   * While NextAuth is still resolving the session,
   * avoid rendering management controls based on
   * an undefined role.
   */
  const authenticated =
    sessionStatus ===
    "authenticated";

  return (
    <AppShell>
      <div>
        {/* HEADER */}

        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display font-bold text-[20px] text-ink">
              Clients
            </h1>

            <p className="text-muted text-[12px] mt-0.5">
              {clients.length} registered
              clients
            </p>
          </div>

          {authenticated &&
            canManage && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setForm(emptyForm);
                  setOpen(true);
                }}
                className="flex items-center gap-1.5 bg-ink-solid text-white rounded-md px-3.5 py-2 text-[12.5px] font-medium hover:bg-ink-solid/90"
              >
                <Plus size={15} />
                Add client
              </button>
            )}
        </div>

        {/* CLIENT LIST */}

        {clients.length === 0 ? (
          <Card className="p-8 text-center">
            <Building2
              size={28}
              className="mx-auto text-muted mb-2"
            />

            <p className="text-[13px] font-medium text-ink">
              No clients found
            </p>

            <p className="text-[11.5px] text-muted mt-1">
              {canManage
                ? "Add your first client to get started."
                : "No clients are currently assigned to your projects."}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {clients.map((client) => {
              const clientProjects =
                projects.filter(
                  (project) =>
                    project.clientId ===
                    client.id
                );

              return (
                <Card
                  key={client.id}
                  className="p-4"
                >
                  {/* CLIENT HEADER */}

                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-ochre-bg text-ochre flex items-center justify-center shrink-0">
                        <Building2
                          size={18}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="font-display font-semibold text-[14px] text-ink truncate">
                          {client.name}
                        </div>

                        <div className="text-muted text-[11.5px] truncate">
                          {
                            client.contactPerson
                          }
                        </div>
                      </div>
                    </div>

                    {authenticated &&
                      canManage && (
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {/* EDIT */}

                          <button
                            type="button"
                            onClick={() =>
                              openEdit(
                                client.id
                              )
                            }
                            className="text-muted hover:text-blueprint disabled:opacity-40"
                            title="Edit client"
                            disabled={
                              deletingId ===
                              client.id
                            }
                          >
                            <Pencil
                              size={14}
                            />
                          </button>

                          {/* DELETE */}

                          {canManage && (
                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(
                                  client.id,
                                  client.name
                                )
                              }
                              className="text-muted hover:text-brick disabled:opacity-40"
                              title="Delete client"
                              disabled={
                                deletingId ===
                                client.id
                              }
                            >
                              {deletingId ===
                              client.id ? (
                                <span className="text-[10px]">
                                  ...
                                </span>
                              ) : (
                                <Trash2
                                  size={14}
                                />
                              )}
                            </button>
                          )}
                        </div>
                      )}
                  </div>

                  {/* CONTACT DETAILS */}

                  <div className="flex flex-col gap-1.5 text-[12px] mb-3">
                    <div className="flex items-center gap-2 text-muted">
                      <Mail size={12} />

                      <span className="truncate">
                        {client.email ||
                          "—"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-muted">
                      <Phone size={12} />

                      <span>
                        {client.phone ||
                          "—"}
                      </span>
                    </div>

                    {client.address && (
                      <div className="flex items-start gap-2 text-muted">
                        <MapPin size={12} className="mt-0.5 shrink-0" />

                        <span className="line-clamp-2">
                          {client.address}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* CLIENT PORTAL */}

                  {canManage && (
                    <ClientPortalAccess
                      key={`${client.id}-${client.portalEnabled ? "enabled" : "disabled"}`}
                      client={client}
                    />
                  )}

                  {/* PROJECTS */}

                  <div className="border-t border-line pt-3">
                    <div className="text-[11px] text-muted mb-2">
                      Projects (
                      {
                        clientProjects.length
                      }
                      )
                    </div>

                    {clientProjects.length ===
                    0 ? (
                      <div className="text-[11.5px] text-muted">
                        No projects yet
                      </div>
                    ) : (
                      clientProjects.map(
                        (project) => (
                          <div
                            key={
                              project.id
                            }
                            className="flex items-center justify-between gap-2 text-[11.5px] mb-1"
                          >
                            <span className="font-mono text-muted shrink-0">
                              {
                                project.sheetNo
                              }
                            </span>

                            <span className="text-ink truncate">
                              {
                                project.name
                              }
                            </span>

                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                                project.status ===
                                "ON_TRACK"
                                  ? "bg-moss-bg text-moss"
                                  : project.status ===
                                    "AT_RISK"
                                  ? "bg-ochre-bg text-ochre"
                                  : "bg-brick-bg text-brick"
                              }`}
                            >
                              {
                                project.progress
                              }
                              %
                            </span>
                          </div>
                        )
                      )
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ADD CLIENT MODAL */}

        <Modal
          open={open}
          onClose={
            closeCreateModal
          }
          title="Add new client"
        >
          <form
            onSubmit={
              handleSubmit
            }
            className="flex flex-col gap-3.5"
          >
            <Field
              label="Organisation / client name"
              required
            >
              <Input
                required
                value={form.name}
                disabled={submitting}
                onChange={(e) =>
                  setForm(
                    (current) => ({
                      ...current,
                      name: e.target
                        .value,
                    })
                  )
                }
                placeholder="e.g. Aurora Properties Ltd"
              />
            </Field>

            <Field
              label="Contact person"
              required
            >
              <Input
                required
                value={
                  form.contactPerson
                }
                disabled={submitting}
                onChange={(e) =>
                  setForm(
                    (current) => ({
                      ...current,
                      contactPerson:
                        e.target
                          .value,
                    })
                  )
                }
                placeholder="e.g. Sarah Njoroge"
              />
            </Field>

            <FormRow>
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email}
                  disabled={submitting}
                  onChange={(e) =>
                    setForm(
                      (current) => ({
                        ...current,
                        email: e.target
                          .value,
                      })
                    )
                  }
                  placeholder="contact@company.com"
                />
              </Field>

              <Field label="Phone">
                <Input
                  value={form.phone}
                  disabled={submitting}
                  onChange={(e) =>
                    setForm(
                      (current) => ({
                        ...current,
                        phone: e.target
                          .value,
                      })
                    )
                  }
                  placeholder="+254 7XX XXX XXX"
                />
              </Field>
            </FormRow>

            <Field label="Address">
              <Input
                value={form.address}
                disabled={submitting}
                onChange={(e) =>
                  setForm(
                    (current) => ({
                      ...current,
                      address:
                        e.target.value,
                    })
                  )
                }
                placeholder="e.g. Westlands, Nairobi"
              />
            </Field>

            {error && (
              <p className="text-brick text-[12px]">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1 border-t border-line mt-1">
              <button
                type="button"
                onClick={
                  closeCreateModal
                }
                disabled={submitting}
                className="px-4 py-2 rounded-md text-[12.5px] border border-line text-muted disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-md text-[12.5px] bg-ink-solid text-white font-medium disabled:opacity-50"
              >
                {submitting
                  ? "Adding..."
                  : "Add client"}
              </button>
            </div>
          </form>
        </Modal>

        {/* EDIT CLIENT MODAL */}

        <Modal
          open={!!editTarget}
          onClose={
            closeEditModal
          }
          title="Edit client"
        >
          <form
            onSubmit={handleEdit}
            className="flex flex-col gap-3.5"
          >
            <Field
              label="Organisation / client name"
              required
            >
              <Input
                required
                value={form.name}
                disabled={submitting}
                onChange={(e) =>
                  setForm(
                    (current) => ({
                      ...current,
                      name: e.target
                        .value,
                    })
                  )
                }
              />
            </Field>

            <Field
              label="Contact person"
              required
            >
              <Input
                required
                value={
                  form.contactPerson
                }
                disabled={submitting}
                onChange={(e) =>
                  setForm(
                    (current) => ({
                      ...current,
                      contactPerson:
                        e.target
                          .value,
                    })
                  )
                }
              />
            </Field>

            <FormRow>
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email}
                  disabled={submitting}
                  onChange={(e) =>
                    setForm(
                      (current) => ({
                        ...current,
                        email: e.target
                          .value,
                      })
                    )
                  }
                />
              </Field>

              <Field label="Phone">
                <Input
                  value={form.phone}
                  disabled={submitting}
                  onChange={(e) =>
                    setForm(
                      (current) => ({
                        ...current,
                        phone: e.target
                          .value,
                      })
                    )
                  }
                />
              </Field>
            </FormRow>

            <Field label="Address">
              <Input
                value={form.address}
                disabled={submitting}
                onChange={(e) =>
                  setForm(
                    (current) => ({
                      ...current,
                      address:
                        e.target.value,
                    })
                  )
                }
              />
            </Field>

            {error && (
              <p className="text-brick text-[12px]">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1 border-t border-line mt-1">
              <button
                type="button"
                onClick={
                  closeEditModal
                }
                disabled={submitting}
                className="px-4 py-2 rounded-md text-[12.5px] border border-line text-muted disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-md text-[12.5px] bg-ink-solid text-white font-medium disabled:opacity-50"
              >
                {submitting
                  ? "Saving..."
                  : "Save changes"}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}

/**
 * Admin-only client portal controls.
 *
 * Portal access/password issuance is deliberately kept
 * separate from the central application store because
 * it is a narrow administrative operation.
 */
function ClientPortalAccess({
  client,
}: {
  client: Client;
}) {
  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [tempPassword, setTempPassword] =
    useState<string | null>(null);

  const [copied, setCopied] =
    useState(false);

  /*
   * Initial state comes directly from the client.
   *
   * We intentionally do not synchronize this state
   * using useEffect/setState because React's lint rule
   * correctly flags synchronous state updates inside effects.
   *
   * The parent supplies a key containing portalEnabled,
   * so this component remounts whenever the server/store
   * value changes.
   */
  const [enabled, setEnabled] =
    useState(
      Boolean(client.portalEnabled)
    );

  async function callPortalApi(
    body: {
      portalEnabled: boolean;
      password?: string;
    }
  ) {
    setError("");
    setBusy(true);
    setTempPassword(null);
    setCopied(false);

    try {
      const res =
        await fetch(
          `/api/clients/${client.id}/portal`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              body
            ),
          }
        );

      let data: {
        error?: string;
        portalEnabled?: boolean;
        temporaryPassword?: string;
      };

      try {
        data = await res.json();
      } catch {
        throw new Error(
          "The server returned an invalid response."
        );
      }

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Failed to update portal access."
        );
      }

      if (
        typeof data.portalEnabled ===
        "boolean"
      ) {
        setEnabled(
          data.portalEnabled
        );
      }

      if (
        data.temporaryPassword
      ) {
        setTempPassword(
          data.temporaryPassword
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update portal access."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!tempPassword) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        tempPassword
      );

      setCopied(true);

      window.setTimeout(
        () => setCopied(false),
        1500
      );
    } catch {
      setError(
        "Unable to copy the temporary password."
      );
    }
  }

  return (
    <div className="border-t border-line pt-3 mb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <KeyRound size={12} />
          Client Portal
        </div>

        <button
          type="button"
          disabled={
            busy ||
            (!enabled &&
              !client.email)
          }
          onClick={() =>
            callPortalApi({
              portalEnabled:
                !enabled,
            })
          }
          title={
            !client.email
              ? "Add a client email first"
              : undefined
          }
          className={`text-[10.5px] px-2 py-0.5 rounded-[3px] font-medium disabled:opacity-40 ${
            enabled
              ? "bg-moss-bg text-moss"
              : "bg-vellum text-muted border border-line"
          }`}
        >
          {busy
            ? "Updating..."
            : enabled
            ? "Enabled"
            : "Disabled"}
        </button>
      </div>

      {enabled && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            callPortalApi({
              portalEnabled: true,
              password: "",
            })
          }
          className="text-[11px] text-blueprint mt-1.5 hover:underline disabled:opacity-40"
        >
          Issue new portal password
        </button>
      )}

      {error && (
        <p className="text-brick text-[11px] mt-1">
          {error}
        </p>
      )}

      {tempPassword && (
        <div className="mt-2 bg-vellum border border-line rounded-md p-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] text-muted">
              Share this with the client
              securely — shown once:
            </div>

            <div className="font-mono text-[12px] text-ink">
              {tempPassword}
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="text-muted hover:text-blueprint shrink-0"
            title="Copy temporary password"
          >
            {copied ? (
              <Check
                size={14}
                className="text-moss"
              />
            ) : (
              <Copy size={14} />
            )}
          </button>
        </div>
      )}
    </div>
  );
}