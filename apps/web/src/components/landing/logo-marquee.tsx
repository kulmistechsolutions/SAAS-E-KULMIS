"use client";

import Image from "next/image";

const TOTAL_LOGOS = 51;

const ROW_1 = Array.from({ length: 26 }, (_, i) => i + 1);
const ROW_2 = Array.from({ length: TOTAL_LOGOS - 26 }, (_, i) => i + 27);

function logoSrc(n: number) {
  const num = String(n).padStart(2, "0");
  const ext = [3, 5, 6].includes(n) ? "png" : n === 1 || n === 2 ? "jpg" : "jpeg";
  return `/schools-logos/school-${num}.${ext}`;
}

function LogoCard({ n }: { n: number }) {
  return (
    <div className="flex h-16 w-32 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm sm:h-20 sm:w-36">
      <Image
        src={logoSrc(n)}
        alt=""
        width={140}
        height={140}
        className="h-full w-full object-contain"
        loading="lazy"
      />
    </div>
  );
}

function MarqueeRow({ items, direction, duration }: { items: number[]; direction: "left" | "right"; duration: number }) {
  return (
    <div className="flex w-max gap-4" style={{ animation: `logo-marquee-${direction} ${duration}s linear infinite` }}>
      {[...items, ...items].map((n, i) => (
        <LogoCard key={`${n}-${i}`} n={n} />
      ))}
    </div>
  );
}

export function LogoMarquee() {
  return (
    <div
      className="group relative overflow-hidden"
      style={{ WebkitMaskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)", maskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)" }}
    >
      <style>{`
        @keyframes logo-marquee-left {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes logo-marquee-right {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
        .logo-marquee-pause:hover [style*="logo-marquee"] {
          animation-play-state: paused;
        }
      `}</style>
      <div className="logo-marquee-pause flex flex-col gap-4">
        <MarqueeRow items={ROW_1} direction="left" duration={42} />
        <MarqueeRow items={ROW_2} direction="right" duration={38} />
      </div>
    </div>
  );
}
