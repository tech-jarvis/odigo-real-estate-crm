import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="mb-5 h-4 w-32" />
      <Skeleton className="mb-6 h-8 w-64" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
        <Skeleton className="h-96 w-full rounded-lg lg:col-span-2" />
      </div>
    </div>
  );
}
