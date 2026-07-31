interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          {description ??
            'This module is not implemented yet. It will be built in a future iteration.'}
        </p>
      </div>
    </div>
  );
}
