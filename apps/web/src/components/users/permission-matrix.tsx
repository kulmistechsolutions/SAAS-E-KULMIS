"use client";

import { ACTIONS, MODULES } from "@/lib/users/format";
import type { PermissionMap } from "@/lib/users/types";

interface PermissionMatrixProps {
  permissions: PermissionMap;
  readOnly?: boolean;
  onChange?: (permissions: PermissionMap) => void;
}

export function PermissionMatrix({
  permissions,
  readOnly = false,
  onChange,
}: PermissionMatrixProps) {
  function toggle(module: keyof PermissionMap, action: (typeof ACTIONS)[number]["id"]) {
    if (readOnly || !onChange) return;
    const next = {
      ...permissions,
      [module]: { ...permissions[module], [action]: !permissions[module][action] },
    };
    onChange(next);
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="sticky top-0 bg-secondary text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Module</th>
            {ACTIONS.map((a) => (
              <th key={a.id} className="px-3 py-2.5 text-center font-medium">
                {a.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULES.map((mod) => (
            <tr key={mod.id} className="border-t">
              <td className="px-4 py-2.5 font-medium">{mod.label}</td>
              {ACTIONS.map((a) => (
                <td key={a.id} className="px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={permissions[mod.id][a.id]}
                    disabled={readOnly}
                    onChange={() => toggle(mod.id, a.id)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
