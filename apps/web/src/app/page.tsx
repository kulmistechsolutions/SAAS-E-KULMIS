import { ALL_ROLES } from "@ekulmis/shared";

export default function HomePage() {
  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center gap-6 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary">
          eKulmis
        </h1>
        <p className="mt-2 text-muted-foreground">
          Multi-tenant School Management ERP — scaffold is live.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
          System roles ({ALL_ROLES.length})
        </h2>
        <ul className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          {ALL_ROLES.map((role) => (
            <li key={role} className="text-foreground">
              {role}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
