import Link from "next/link";

/**
 * Marketing landing for catnip.io. Scaffold placeholder — no service imports so
 * the app boots with an empty .env.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-neutral-400">
        A MemeWorks company
      </p>
      <h1 className="text-5xl font-bold tracking-tight">Catnip 🐈</h1>
      <p className="text-lg text-neutral-600">
        Build, host, and spread interactive marketing toys. The layer that turns
        a generated toy into something safe to put in front of the public and
        engineered to spread — cost control, a virality loop, and measurement.
      </p>
      <div className="flex gap-4 text-sm">
        <Link
          href="/dashboard"
          className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white"
        >
          Dashboard
        </Link>
        <span className="rounded-md border border-neutral-200 px-4 py-2 text-neutral-400">
          Scaffold — features not built yet
        </span>
      </div>
    </main>
  );
}
