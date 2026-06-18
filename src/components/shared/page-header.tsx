export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-end sm:self-auto">
          {action}
        </div>
      )}
    </div>
  );
}
