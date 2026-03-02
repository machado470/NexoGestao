export function SkeletonLoader({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 p-4 border rounded-lg">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
          <div className="flex gap-2 mt-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse" />
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeletonLoader({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="p-4 text-left">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} className="border-b">
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx} className="p-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CardSkeletonLoader() {
  return (
    <div className="p-6 border rounded-lg space-y-4">
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse" />
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6 animate-pulse" />
      </div>
      <div className="flex gap-2 pt-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse" />
      </div>
    </div>
  );
}
