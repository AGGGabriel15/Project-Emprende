/** Sección de una página legal: título, contenido (texto o JSX) y ancla opcional para enlazarla. */
export type LegalSection = [title: string, body: React.ReactNode, id?: string];

export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro?: React.ReactNode;
  sections: LegalSection[];
}) {
  const anchors = sections.filter(([, , id]) => id);
  return (
    <article className="container-page max-w-3xl py-10">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Última actualización: {updated}</p>
      {intro && <div className="mt-5 leading-relaxed text-muted-foreground">{intro}</div>}
      {anchors.length > 1 && (
        <nav aria-label="En esta página" className="mt-6 rounded-2xl border bg-card p-4 text-sm">
          <p className="mb-2 font-semibold">En esta página</p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {anchors.map(([heading, , id]) => (
              <li key={id}>
                <a href={`#${id}`} className="text-primary hover:underline">
                  {heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="mt-8 space-y-7">
        {sections.map(([heading, body, id]) => (
          <section key={heading} id={id} className="scroll-mt-24">
            <h2 className="font-sans text-lg font-semibold tracking-normal">{heading}</h2>
            {typeof body === "string" ? (
              <p className="mt-2 leading-relaxed text-muted-foreground">{body}</p>
            ) : (
              <div className="legal-body mt-2 space-y-3 leading-relaxed text-muted-foreground">{body}</div>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}

/** Tabla simple para las páginas legales. */
export function LegalTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t align-top">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
