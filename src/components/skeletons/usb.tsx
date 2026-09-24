import { Skeleton } from "@/components/ui/skeleton";

import TabView from "../TabView";

export default function USBSkeleton() {
  return (
    <TabView>
      <div className="flex flex-col gap-8">
        <div>
          <Skeleton className="mb-8 h-7 w-28" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <div className="mt-4 flex flex-row flex-wrap justify-between">
            <Skeleton className="h-9 w-24" />
            <div className="mt-8 flex flex-col items-start md:mt-0 md:flex-row md:items-center lg:mt-0">
              <Skeleton className="mr-4 h-7 w-48" />
              <div className="mt-4 flex gap-4 md:mt-0">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-7 w-24 animate-pulse rounded-full bg-muted"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TabView>
  );
}
