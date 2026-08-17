"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import {
  apiCreateContact,
  apiCreateContactGroup,
  apiDeleteContact,
  apiDeleteContactGroup,
  apiListContactGroups,
  apiListContacts,
  apiRenameContactGroup,
  apiUpdateContact,
  type SmsContact,
  type SmsContactGroup,
} from "@/lib/sms/api";

/**
 * Custom SMS contacts — people who are not students, parents or teachers
 * (a committee, a supplier, a landlord), organised into named groups so a
 * whole group can be picked as one send audience in Step 1 of composing,
 * instead of pasting numbers in by hand every time.
 */

const EMPTY_CONTACT = { name: "", phone: "", note: "" };

interface Props {
  onGroupsChanged: () => void;
}

export function ContactManager({ onGroupsChanged }: Props) {
  const [groups, setGroups] = useState<SmsContactGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");

  const [contacts, setContacts] = useState<SmsContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT);
  const [editingContactId, setEditingContactId] = useState<string | "new" | null>(null);
  const [savingContact, setSavingContact] = useState(false);

  async function loadGroups() {
    setGroupsLoading(true);
    try {
      const rows = await apiListContactGroups();
      setGroups(rows);
      if (!activeGroupId && rows.length > 0) setActiveGroupId(rows[0].id);
      onGroupsChanged();
    } catch {
      toast("Could not load contact groups", "error");
    } finally {
      setGroupsLoading(false);
    }
  }

  async function loadContacts(groupId: string) {
    setContactsLoading(true);
    try {
      setContacts(await apiListContacts(groupId));
    } catch {
      toast("Could not load contacts", "error");
    } finally {
      setContactsLoading(false);
    }
  }

  useEffect(() => {
    void loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeGroupId) void loadContacts(activeGroupId);
  }, [activeGroupId]);

  async function createGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    setCreatingGroup(true);
    try {
      const g = await apiCreateContactGroup(name);
      setNewGroupName("");
      await loadGroups();
      setActiveGroupId(g.id);
      toast("Group created", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not create group", "error");
    } finally {
      setCreatingGroup(false);
    }
  }

  async function saveGroupName(id: string) {
    const name = editingGroupName.trim();
    if (!name) return;
    try {
      await apiRenameContactGroup(id, name);
      setEditingGroupId(null);
      await loadGroups();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not rename group", "error");
    }
  }

  async function removeGroup(id: string) {
    if (!confirm("Delete this group? Its contacts are kept, just no longer grouped.")) return;
    try {
      await apiDeleteContactGroup(id);
      if (activeGroupId === id) setActiveGroupId(null);
      await loadGroups();
      toast("Group deleted", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete group", "error");
    }
  }

  function startCreateContact() {
    setContactForm(EMPTY_CONTACT);
    setEditingContactId("new");
  }

  function startEditContact(c: SmsContact) {
    setContactForm({ name: c.name, phone: c.phone, note: c.note ?? "" });
    setEditingContactId(c.id);
  }

  async function saveContact() {
    if (!contactForm.name.trim() || !contactForm.phone.trim()) {
      toast("Name and phone are required", "error");
      return;
    }
    if (!activeGroupId) return;
    setSavingContact(true);
    try {
      if (editingContactId === "new") {
        await apiCreateContact({ ...contactForm, groupId: activeGroupId });
        toast("Contact added", "success");
      } else if (editingContactId) {
        await apiUpdateContact(editingContactId, contactForm);
        toast("Contact updated", "success");
      }
      setEditingContactId(null);
      await loadContacts(activeGroupId);
      await loadGroups();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSavingContact(false);
    }
  }

  async function removeContact(id: string) {
    if (!confirm("Remove this contact?")) return;
    try {
      await apiDeleteContact(id);
      if (activeGroupId) await loadContacts(activeGroupId);
      await loadGroups();
      toast("Contact removed", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not remove contact", "error");
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      {/* ── Groups ── */}
      <div className="space-y-3">
        <h2 className="font-semibold">Custom Groups</h2>
        <div className="flex gap-1.5">
          <Input
            className="h-8 text-xs"
            placeholder="New group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void createGroup()}
          />
          <Button
            className="h-8 shrink-0 px-2.5"
            onClick={() => void createGroup()}
            disabled={creatingGroup || !newGroupName.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ul className="space-y-1">
          {groupsLoading && <li className="text-xs text-muted-foreground">Loading…</li>}
          {!groupsLoading && groups.length === 0 && (
            <li className="text-xs text-muted-foreground">
              No groups yet — create one above (e.g. &ldquo;Guddiga Waalidiinta&rdquo;).
            </li>
          )}
          {groups.map((g) => (
            <li key={g.id}>
              {editingGroupId === g.id ? (
                <div className="flex gap-1">
                  <Input
                    className="h-8 text-xs"
                    value={editingGroupName}
                    onChange={(e) => setEditingGroupName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void saveGroupName(g.id)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
                    onClick={() => setEditingGroupId(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveGroupId(g.id)}
                  className={`group flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-start text-sm transition-colors ${
                    activeGroupId === g.id
                      ? "bg-primary/10 font-medium text-primary"
                      : "hover:bg-secondary/60"
                  }`}
                >
                  <span className="truncate">{g.name}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="text-xs text-muted-foreground">{g._count.contacts}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingGroupId(g.id);
                        setEditingGroupName(g.name);
                      }}
                      className="rounded p-0.5 opacity-0 hover:bg-secondary group-hover:opacity-100"
                    >
                      <Pencil className="h-3 w-3" />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        void removeGroup(g.id);
                      }}
                      className="rounded p-0.5 opacity-0 hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </span>
                  </span>
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Contacts in the selected group ── */}
      <div className="space-y-3 border-t pt-4 md:border-t-0 md:border-s md:pe-0 md:ps-4 md:pt-0">
        {!activeGroupId ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Users className="h-6 w-6 opacity-40" />
            Select or create a group to add contacts.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">
                {groups.find((g) => g.id === activeGroupId)?.name ?? "Contacts"}
              </h2>
              {editingContactId === null && (
                <Button className="h-8 px-3 text-xs" onClick={startCreateContact}>
                  <Plus className="me-1.5 h-4 w-4" /> Add Contact
                </Button>
              )}
            </div>

            {editingContactId !== null && (
              <div className="space-y-3 rounded-xl border bg-secondary/30 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Name</Label>
                    <Input
                      className="mt-1.5"
                      value={contactForm.name}
                      onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      className="mt-1.5"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="61XXXXXXX"
                    />
                  </div>
                </div>
                <div>
                  <Label>Note (optional)</Label>
                  <Input
                    className="mt-1.5"
                    value={contactForm.note}
                    onChange={(e) => setContactForm((f) => ({ ...f, note: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button className="h-8 px-3 text-xs" onClick={() => void saveContact()} disabled={savingContact}>
                    {savingContact ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    className="h-8 px-3 text-xs"
                    variant="outline"
                    onClick={() => setEditingContactId(null)}
                  >
                    <X className="me-1.5 h-4 w-4" /> Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border">
              <ul className="divide-y">
                {contactsLoading && (
                  <li className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</li>
                )}
                {!contactsLoading && contacts.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No contacts in this group yet.
                  </li>
                )}
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {c.phone}
                        {c.note ? ` · ${c.note}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => startEditContact(c)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeContact(c.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-rose-100 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// A group-move dropdown, exported so a contact could later be reassigned to a
// different group without deleting and recreating it.
export function GroupSelect({
  groups,
  value,
  onChange,
}: {
  groups: SmsContactGroup[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <Select
      className="mt-1.5"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">No group</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </Select>
  );
}
