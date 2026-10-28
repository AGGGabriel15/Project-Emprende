import { Logo } from "@/components/layout/logo";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="container-page grid min-h-[calc(100dvh-8rem)] place-items-center py-10">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex justify-center">
            <Logo />
          </div>
          <h1 className="text-center text-2xl font-semibold">{title}</h1>
          {description && (
            <p className="mt-2 text-center text-sm text-muted-foreground">{description}</p>
          )}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

export function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {children}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
