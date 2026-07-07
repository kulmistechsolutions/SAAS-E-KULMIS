"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  onCancel: () => void;
  onResetDefault: () => void;
}

export function SettingsSaveBar({
  dirty,
  saving,
  onSave,
  onCancel,
  onResetDefault,
}: Props) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 mt-8 border-t bg-card/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6",
        !dirty && "opacity-90",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {dirty ? "You have unsaved changes." : "All changes saved."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            className="h-9"
            variant="outline"
            onClick={onResetDefault}
            disabled={saving}
          >
            Reset to Default
          </Button>
          <Button className="h-9" variant="outline" onClick={onCancel} disabled={!dirty || saving}>
            Cancel
          </Button>
          <Button className="h-9" onClick={onSave} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
