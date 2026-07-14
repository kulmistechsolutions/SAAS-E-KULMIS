import { redirect } from "next/navigation";

/** Root path: send users straight to the app without a client-side loading screen. */
export default function Home() {
  const preview = process.env.NEXT_PUBLIC_PREVIEW_AUTH === "true";
  redirect(preview ? "/dashboard" : "/login");
}
