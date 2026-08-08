function SkeletonBlock({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded bg-zinc-200 ${className}`}
    />
  );
}

export function MyOrdersPageSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading orders"
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
    >
      <div className="flex items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div className="w-full max-w-md">
          <SkeletonBlock className="h-4 w-20" />
          <SkeletonBlock className="mt-3 h-9 w-52" />
          <SkeletonBlock className="mt-3 h-4 w-full" />
        </div>
        <SkeletonBlock className="hidden h-9 w-28 sm:block" />
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="grid min-h-40 gap-5 rounded-md border border-zinc-200 bg-white p-5 sm:min-h-32 sm:grid-cols-[minmax(0,1.25fr)_minmax(10rem,0.8fr)_auto] sm:items-center"
            key={index}
          >
            <div>
              <SkeletonBlock className="h-5 w-40" />
              <SkeletonBlock className="mt-4 h-4 w-52 max-w-full" />
              <SkeletonBlock className="mt-3 h-3 w-28" />
            </div>
            <div className="grid grid-cols-2 gap-5 sm:block">
              <SkeletonBlock className="h-9 w-20 sm:ml-auto" />
              <SkeletonBlock className="h-9 w-28 sm:ml-auto sm:mt-3" />
            </div>
            <SkeletonBlock className="hidden size-5 sm:block" />
          </div>
        ))}
      </div>
    </main>
  );
}

export function OrderDetailsPageSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading order details"
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
    >
      <SkeletonBlock className="h-10 w-28" />
      <div className="mt-4 border-b border-zinc-200 pb-6">
        <SkeletonBlock className="h-4 w-24" />
        <SkeletonBlock className="mt-3 h-9 w-64 max-w-full" />
        <SkeletonBlock className="mt-3 h-3 w-72 max-w-full" />
      </div>
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-10">
          <section>
            <SkeletonBlock className="h-6 w-40" />
            <div className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200">
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  className="grid min-h-28 grid-cols-[4rem_minmax(0,1fr)] gap-4 py-5 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]"
                  key={index}
                >
                  <SkeletonBlock className="aspect-square w-full" />
                  <div>
                    <SkeletonBlock className="h-5 w-48 max-w-full" />
                    <SkeletonBlock className="mt-3 h-4 w-32" />
                  </div>
                  <SkeletonBlock className="col-start-2 h-5 w-24 sm:col-start-auto" />
                </div>
              ))}
            </div>
          </section>
          <section>
            <SkeletonBlock className="h-6 w-48" />
            <div className="mt-4 grid min-h-44 gap-6 border-y border-zinc-200 py-5 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index}>
                  <SkeletonBlock className="h-3 w-20" />
                  <SkeletonBlock className="mt-3 h-5 w-44 max-w-full" />
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="min-h-[34rem] rounded-md border border-zinc-200 bg-white p-5">
          <SkeletonBlock className="h-6 w-36" />
          <div className="mt-6 space-y-6">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index}>
                <SkeletonBlock className="h-3 w-24" />
                <SkeletonBlock className="mt-3 h-5 w-36" />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
