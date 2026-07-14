"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateParent, type ParentWithChildren } from "@/lib/students/store";
import type { ParentStatus } from "@/lib/students/types";

interface Props {
  open: boolean;
  onClose: () => void;
  parent: ParentWithChildren | null;
  onSaved?: (message: string) => void;
}

export function ParentFormDialog({ open, onClose, parent, onSaved }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [occupation, setOccupation] = useState("");
  const [status, setStatus] = useState<ParentStatus>("ACTIVE");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !parent) return;
    setError(null);
    setName(parent.name);
    setPhone(parent.phone);
    setAltPhone(parent.altPhone ?? "");
    setEmail(parent.email ?? "");
    setAddress(parent.address ?? "");
    setOccupation(parent.occupation ?? "");
    setStatus(parent.status);
  }, [open, parent]);

  async function handleSubmit() {
    if (!parent) return;
    setError(null);
    const res = await updateParent(parent.id, {
      name,
      phone,
      altPhone: altPhone || null,
      email: email || null,
      address: address || null,
      occupation: occupation || null,
      status,
    });
    if (!res.ok) return setError(res.error ?? "Update failed.");
    onSaved?.(`${res.parent?.name} updated successfully.`);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit Parent"
      description={`Update profile for ${parent?.code}. Parent ID cannot be changed.`}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Save Changes</Button>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-600">
          {error}
        </div>
      )}
      <p className="mb-4 rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
        Parent accounts are created automatically when students are registered. You cannot create parents manually.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label required>Full Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label required>Phone Number</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label>Alternative Phone</Label>
          <Input value={altPhone} onChange={(e) => setAltPhone(e.target.value)} />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Address</Label>
          <Textarea value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <Label>Occupation</Label>
          <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as ParentStatus)}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </div>
      </div>
    </Dialog>
  );
}
