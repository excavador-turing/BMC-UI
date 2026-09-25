import { Skeleton } from "@/components/ui/skeleton";

import TabView from "../TabView";

/**
 * The Network tab while `type=info` is still in flight.
 *
 * Only the interface list is drawn. The switch panel below it is a plain
 * `useQuery` rather than a suspense one, so it never reaches this state: it
 * mounts with the rest of the page and draws its own pending rows.
 */
export default function NetworkSkeleton() {
  return (
    <TabView>
      <div>
        <Skeleton className="mb-8 h-7 w-2/5" />
        <Skeleton className="mb-6 h-7 w-40" />
        <div className="flex flex-row border-b pb-3">
          <div className="w-1/2 lg:w-1/4">
            <Skeleton className="h-6 w-10" />
          </div>
        </div>
        <div className="flex flex-row border-b py-3">
          <div className="w-1/2 lg:w-1/4">
            <Skeleton className="h-6 w-10" />
          </div>
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex flex-row py-3">
          <div className="w-1/2 lg:w-1/4">
            <Skeleton className="h-6 w-10" />
          </div>
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="mt-4">
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
    </TabView>
  );
}
