import { Skeleton } from '@/components/ui/skeleton'

export function OverdueSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>

      {/* Pods / Designers toggle */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        {/* Table header */}
        <div className="flex gap-4 px-4 py-3 border-b bg-muted/30">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>

        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b last:border-0">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}

        {/* Summary row */}
        <div className="flex gap-4 px-4 py-3 border-t-2 bg-muted/50">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-8" />
        </div>
      </div>
    </div>
  )
}
