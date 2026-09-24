import { Skeleton } from "@/components/ui/skeleton";

import TabView from "../TabView";

export default function InfoSkeleton() {
  return (
    <TabView>
      <div className="mb-6">
        <Skeleton className="mb-7 h-7 w-32" />
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <div className="w-1/4">
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-4 w-1/2 md:w-3/4" />
          </div>
        </div>
        <Skeleton className="mt-4 h-9 w-36" />
      </div>

      <div>
        <Skeleton className="mb-6 h-7 w-20" />
        <div className="flex flex-row gap-4">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
    </TabView>
  );
}
