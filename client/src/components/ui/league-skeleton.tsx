import { Skeleton } from "@/components/ui/skeleton"

export function LeagueSkeleton() {
  return (
    <div className="rounded-2xl shadow border p-4" data-testid="skeleton-league">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-5 w-5 rounded" />
        </div>
      </div>
    </div>
  )
}

export function LeagueListSkeleton() {
  return (
    <div className="space-y-4" data-testid="skeleton-league-list">
      {Array.from({ length: 3 }).map((_, i) => (
        <LeagueSkeleton key={i} />
      ))}
    </div>
  )
}