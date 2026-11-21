"use client";

import { InputHTMLAttributes, forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { Input } from "./input";

/**
 * A password field with a show/hide eye. Typing a code like MDFS0001 or a
 * phone-style 12345 blind on a phone is where most failed logins came from,
 * so every login screen lets the person see what they typed.
 */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { wrapperClassName?: string }
>(({ className, wrapperClassName, ...props }, ref) => {
  const t = useT();
  const [show, setShow] = useState(false);
  const label = t(show ? "auth.hidePassword" : "auth.showPassword");
  return (
    <div className={cn("relative", wrapperClassName)}>
      <Input
        ref={ref}
        type={show ? "text" : "password"}
        className={cn("pe-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={label}
        title={label}
        tabIndex={-1}
        className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";
