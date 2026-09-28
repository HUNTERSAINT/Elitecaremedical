export default function ProductSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-card-border overflow-hidden">
      <div className="aspect-[4/3] skeleton-shimmer" />
      <div className="p-4 space-y-3">
        <div className="h-2.5 w-1/3 rounded skeleton-shimmer" />
        <div className="h-4 w-4/5 rounded skeleton-shimmer" />
        <div className="h-3.5 w-2/5 rounded skeleton-shimmer" />
        <div className="flex justify-between items-center mt-2">
          <div className="h-5 w-1/3 rounded skeleton-shimmer" />
          <div className="h-8 w-16 rounded-lg skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}
