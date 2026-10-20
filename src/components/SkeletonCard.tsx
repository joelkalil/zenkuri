interface SkeletonCardProps {
  portrait?: boolean;
}

export function SkeletonCard({ portrait = false }: SkeletonCardProps) {
  return (
    <div aria-hidden="true" className={portrait ? 'animate-pulse' : 'bg-gray-900 border border-gray-800 rounded-xl overflow-hidden animate-pulse'}>
      <div className={portrait ? 'aspect-[2/3] rounded-xl bg-gray-800' : 'h-28 bg-gray-800'} />
      <div className={portrait ? 'pt-3 space-y-2' : 'p-3 space-y-2'}>
        <div className="h-3 bg-gray-800 rounded w-3/4" />
        <div className="h-2.5 bg-gray-800 rounded w-1/2" />
        <div className="h-1.5 bg-gray-800 rounded-full w-full mt-3" />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
      <div className="w-16 h-16 bg-gray-800 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-gray-800 rounded w-1/2" />
        <div className="h-2.5 bg-gray-800 rounded w-1/3" />
        <div className="h-1.5 bg-gray-800 rounded-full w-full" />
      </div>
    </div>
  );
}
