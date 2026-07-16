import Link from "next/link";

const NAV_ITEMS = [
  { href: "/account", label: "Dashboard" },
  { href: "/account/sync", label: "Sync & migration" },
  { href: "/account/data", label: "Export & import" },
  { href: "/account/security", label: "Security" },
  { href: "/account/delete", label: "Delete data" },
];

interface AccountNavProps {
  email: string;
  displayName: string | null;
}

export function AccountNav({ email, displayName }: AccountNavProps) {
  return (
    <nav
      aria-label="Account navigation"
      className="flex shrink-0 flex-col gap-1 border-b border-border bg-surface p-4 lg:w-64 lg:border-b-0 lg:border-r"
    >
      <div className="mb-3">
        <p className="text-sm font-semibold text-foreground">{displayName || email}</p>
        <p className="text-xs text-foreground-muted">{email}</p>
      </div>

      <ul className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-border pt-3">
        <Link href="/workspace" className="block rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-muted">
          Go to workspace
        </Link>
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-foreground-muted hover:bg-surface-muted"
          >
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
