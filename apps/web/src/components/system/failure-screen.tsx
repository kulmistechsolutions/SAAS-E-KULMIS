"use client";

/**
 * What a school sees when something breaks.
 *
 * Until this existed, any client-side exception anywhere in the app fell
 * through to Next.js's own developer message — "Application error: a
 * client-side exception has occurred while loading <school>.ekulmis.com (see
 * the browser console for more information)" — on a blank white page. Schools
 * were reading that, and it tells them nothing they can act on while sounding
 * like their data is gone.
 *
 * Deliberately self-contained: no i18n provider, no design system, no store,
 * no icons. Everything this component could import is something that might be
 * what just failed, and a broken error screen leaves nowhere to fall back to.
 * The three languages are inlined for the same reason.
 */

type Kind = "UNKNOWN_TENANT" | "OFFLINE" | "GENERIC";

const COPY: Record<Kind, Record<"so" | "en" | "ar", { title: string; body: string }>> = {
  UNKNOWN_TENANT: {
    so: {
      title: "Cinwaankan dugsi kuma xidhna",
      body: "Hubi ciwaanka aad qortay. Haddii dugsigaagu cusub yahay, weli lama furin.",
    },
    en: {
      title: "No school at this address",
      body: "Check the address you typed. If your school is new, it may not be open yet.",
    },
    ar: {
      title: "لا توجد مدرسة على هذا العنوان",
      body: "تحقق من العنوان الذي كتبته. إذا كانت مدرستك جديدة، فقد لا تكون مفتوحة بعد.",
    },
  },
  OFFLINE: {
    so: {
      title: "Isku xidhku wuu go'ay",
      body: "Hubi internetkaaga, kadibna isku day mar kale. Xogtaadu waa badbaado.",
    },
    en: {
      title: "Connection lost",
      body: "Check your internet, then try again. Your data is safe.",
    },
    ar: {
      title: "انقطع الاتصال",
      body: "تحقق من الإنترنت ثم حاول مرة أخرى. بياناتك آمنة.",
    },
  },
  GENERIC: {
    so: {
      title: "Bogga lama soo bandhigi karin",
      body: "Isku day mar kale. Haddii ay sii jirto, la xidhiidh taageerada. Xogtaadu waa badbaado.",
    },
    en: {
      title: "This page could not be loaded",
      body: "Please try again. If it keeps happening, contact support. Your data is safe.",
    },
    ar: {
      title: "تعذر تحميل هذه الصفحة",
      body: "يرجى المحاولة مرة أخرى. إذا استمر ذلك، اتصل بالدعم. بياناتك آمنة.",
    },
  },
};

const RETRY = { so: "Isku day mar kale", en: "Try again", ar: "حاول مرة أخرى" };

/**
 * The stored language, read defensively.
 *
 * Storage throws outright in some contexts (a private window, site data
 * blocked), and this component exists precisely for the moments when the
 * usual paths are not working.
 */
function lang(): "so" | "en" | "ar" {
  try {
    const v =
      document.documentElement.lang ||
      window.localStorage.getItem("ekulmis_lang") ||
      "";
    if (v.startsWith("so")) return "so";
    if (v.startsWith("ar")) return "ar";
  } catch {
    /* fall through to English */
  }
  return "en";
}

/** Which of the three situations this is, from the error itself. */
export function classifyFailure(error?: { message?: string } | null): Kind {
  const m = (error?.message ?? "").toLowerCase();
  if (m.includes("unknown tenant") || m.includes("no tenant")) {
    return "UNKNOWN_TENANT";
  }
  if (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("load failed")
  ) {
    return "OFFLINE";
  }
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "OFFLINE";
    }
  } catch {
    /* navigator is not always there */
  }
  return "GENERIC";
}

export function FailureScreen({
  kind = "GENERIC",
  onRetry,
}: {
  kind?: Kind;
  onRetry?: () => void;
}) {
  const l = lang();
  const copy = COPY[kind][l];
  const rtl = l === "ar";

  return (
    <div
      dir={rtl ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#f8fafc",
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: "420px", textAlign: "center" }}>
        <div
          aria-hidden
          style={{
            width: "56px",
            height: "56px",
            margin: "0 auto 20px",
            borderRadius: "16px",
            background: "#e0e7ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "26px",
          }}
        >
          {kind === "OFFLINE" ? "⚡" : kind === "UNKNOWN_TENANT" ? "🏫" : "↻"}
        </div>
        <h1 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 10px" }}>
          {copy.title}
        </h1>
        <p
          style={{
            fontSize: "15px",
            lineHeight: 1.6,
            color: "#475569",
            margin: "0 0 24px",
          }}
        >
          {copy.body}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              border: "none",
              borderRadius: "10px",
              background: "#4f46e5",
              color: "#fff",
              fontSize: "15px",
              fontWeight: 600,
              padding: "11px 26px",
              cursor: "pointer",
            }}
          >
            {RETRY[l]}
          </button>
        )}
      </div>
    </div>
  );
}
