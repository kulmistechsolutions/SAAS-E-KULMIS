"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { createAcademicYear } from "@/lib/academics/store";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AcademicYearDialog({ open, onClose }: Props) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [makeActive, setMakeActive] = useState("no");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName("");
    setStartDate("");
    setEndDate("");
    setMakeActive("no");
  }, [open]);

  function submit() {
    setError(null);
    if (!name.trim()) return setError("Academic year name is required.");
    if (!startDate || !endDate) return setError("Start and end dates are required.");
    const res = createAcademicYear({
      name,
      startDate,
      endDate,
      status: makeActive === "yes" ? "ACTIVE" : "CLOSED",
    });
    if (!res.ok) return setError(res.error ?? "Operation failed.");
    toast("Academic year created.", "success");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add Academic Year"
      description="Only one academic year can be active at a time."
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Create</Button>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}
      <div className="grid gap-4">
        <div>
          <Label required>Academic Year Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 2025-2026"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label required>Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label required>End Date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div>
          <Label required>Set as Active</Label>
          <Select value={makeActive} onChange={(e) => setMakeActive(e.target.value)}>
            <option value="no">No — keep current active year</option>
            <option value="yes">Yes — activate this year</option>
          </Select>
        </div>
      </div>
    </Dialog>
  );
}
