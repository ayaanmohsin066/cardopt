export interface SectionLink {
  /** The id of the section's element on the page. */
  id: string;
  label: string;
  /** A short status next to the label, e.g. "2 of 3". */
  status?: string;
  /** False while the section isn't on the page yet. */
  available: boolean;
}

/**
 * In-page navigation: the steps of the page in order. A step that isn't on
 * the page yet is shown but can't be followed.
 */
export function SectionNav({ links }: { links: SectionLink[] }) {
  return (
    <nav
      aria-label="Sections"
      className="sticky top-14 z-20 -mx-4 border-b border-border bg-background px-4 sm:-mx-6 sm:px-6"
    >
      <ol className="-mx-1 flex gap-1 overflow-x-auto [scrollbar-width:none]">
        {links.map((l, i) => {
          const body = (
            <>
              <span
                aria-hidden
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${l.available ? "bg-accent text-accent-foreground" : "border border-border"}`}
              >
                {i + 1}
              </span>
              <span className="font-medium">{l.label}</span>
              {l.status && <span className="text-xs tabular-nums text-muted">{l.status}</span>}
            </>
          );
          const base = "flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-3 text-sm";
          return (
            <li key={l.id}>
              {l.available ? (
                <a href={`#${l.id}`} className={`${base} rounded-control text-foreground transition-colors duration-(--duration-fast) hover:bg-surface-2`}>
                  {body}
                </a>
              ) : (
                <span aria-disabled className={`${base} text-muted opacity-60`}>
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
