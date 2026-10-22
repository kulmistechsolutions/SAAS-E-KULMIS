"use client";

/**
 * The logos of the schools on eKulmis, scrolling in three rows.
 *
 * They used to appear late: each card was `loading="lazy"`, and a card in a
 * row that slides sideways only counts as "near the screen" once it slides
 * in, so the browser fetched every logo at the last moment — and each was a
 * full-size photo (~100 KB) resized on first request. The logos are now
 * pre-made 168px WebP files (~8 KB each, ~0.8 MB for all of them), fetched
 * straight away and drawn off the main thread.
 *
 * To add a school: put its logo in public/schools-logos as logo-NNN.webp
 * (168px on the long side) and raise TOTAL_LOGOS.
 */
const TOTAL_LOGOS = 104;

/** A fixed shuffle, so older and newer schools sit side by side. */
function mixed(n: number): number[] {
  const out = Array.from({ length: n }, (_, i) => i + 1);
  let seed = 7;
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const ORDER = mixed(TOTAL_LOGOS);
const PER_ROW = Math.ceil(TOTAL_LOGOS / 3);
const ROWS = [
  { items: ORDER.slice(0, PER_ROW), direction: "left" as const, seconds: 70 },
  { items: ORDER.slice(PER_ROW, PER_ROW * 2), direction: "right" as const, seconds: 62 },
  { items: ORDER.slice(PER_ROW * 2), direction: "left" as const, seconds: 76 },
];

const src = (n: number) => `/schools-logos/logo-${String(n).padStart(3, "0")}.webp`;

function LogoCard({ n, copy }: { n: number; copy: boolean }) {
  return (
    <div
      aria-hidden={copy || undefined}
      className={`${copy ? "logo-copy " : ""}flex h-[72px] w-[120px] shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:h-20 sm:w-36`}
    >
      {/* A plain img: the files are already the right size, so Next's
          resizer would only add a slow first request. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src(n)}
        alt=""
        width={168}
        height={168}
        loading="eager"
        decoding="async"
        draggable={false}
        className="h-full w-full select-none object-contain"
      />
    </div>
  );
}

function MarqueeRow({
  items,
  direction,
  seconds,
}: {
  items: number[];
  direction: "left" | "right";
  seconds: number;
}) {
  return (
    <div
      className="logo-row flex w-max gap-3 sm:gap-4"
      style={{ animation: `logo-marquee-${direction} ${seconds}s linear infinite` }}
    >
      {/* Twice over, so the row loops without a seam. */}
      {[...items, ...items].map((n, i) => (
        <LogoCard key={`${n}-${i}`} n={n} copy={i >= items.length} />
      ))}
    </div>
  );
}

export function LogoMarquee() {
  return (
    <div
      className="logo-marquee relative overflow-hidden py-1"
      style={{
        WebkitMaskImage: "linear-gradient(90deg, transparent, black 7%, black 93%, transparent)",
        maskImage: "linear-gradient(90deg, transparent, black 7%, black 93%, transparent)",
      }}
    >
      <style>{`
        @keyframes logo-marquee-left {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes logo-marquee-right {
          from { transform: translate3d(-50%, 0, 0); }
          to { transform: translate3d(0, 0, 0); }
        }
        .logo-row { will-change: transform; }
        .logo-marquee:hover .logo-row { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .logo-row { animation: none !important; flex-wrap: wrap; width: 100%; justify-content: center; }
          .logo-copy { display: none; }
        }
      `}</style>
      <div className="flex flex-col gap-3 sm:gap-4">
        {ROWS.map((r, i) => (
          <MarqueeRow key={i} items={r.items} direction={r.direction} seconds={r.seconds} />
        ))}
      </div>
    </div>
  );
}
