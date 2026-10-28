export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: [string, string][] }) {
  return (
    <article className="container-page max-w-3xl py-10">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Última actualización: {updated}</p>
      <div className="mt-8 space-y-6">
        {sections.map(([heading, body]) => (
          <section key={heading}>
            <h2 className="font-sans text-lg font-semibold tracking-normal">{heading}</h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">{body}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
