interface SkeletonCardProps {
  portrait?: boolean;
}

export function SkeletonCard({ portrait = false }: SkeletonCardProps) {
  return (
    <div aria-hidden="true" className="motion-safe:animate-pulse">
      <div className={portrait ? 'aspect-[2/3] rounded-sm bg-gray-850' : 'h-28 rounded-sm bg-gray-850'} />
      <div className="space-y-2 pt-3">
        <div className="h-3 w-3/4 bg-gray-850" />
        <div className="h-2.5 w-1/2 bg-gray-850" />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div aria-hidden="true" className="flex items-center gap-4 border-b border-gray-800 py-3 motion-safe:animate-pulse">
      <div className="h-10 w-10 shrink-0 bg-gray-850" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-1/2 bg-gray-850" />
        <div className="h-2.5 w-1/3 bg-gray-850" />
      </div>
    </div>
  );
}
