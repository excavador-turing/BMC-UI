import { Skeleton } from "@/components/ui/skeleton";

import TabView from "../TabView";

export default function NodesSkeleton() {
  return (
    <TabView>
      <div>
        <Skeleton className="mb-8 h-7 w-2/5" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="border-b py-4">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="flex items-center gap-4">
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-9 w-24" />
              </div>
              <div className="flex flex-1 flex-wrap gap-4">
                <div className="flex-1">
                  <Skeleton className="h-12 w-full" />
                </div>
                <div className="flex-1">
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            </div>
          </div>
        ))}
        <div className="mt-6 flex justify-end gap-4">
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-9 w-16" />
        </div>
      </div>
    </TabView>
  );
}
