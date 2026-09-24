import { Skeleton } from "@/components/ui/skeleton";

import TableItem from "../TableItem";
import TabView from "../TabView";

export default function AboutSkeleton() {
  return (
    <TabView>
      <dl className="flex flex-col">
        <TableItem term="Board model">
          <Skeleton className="h-6 w-48" />
        </TableItem>
        <TableItem term="Board serial">
          <Skeleton className="h-6 w-48" />
        </TableItem>
        <TableItem term="Host name">
          <Skeleton className="h-6 w-48" />
        </TableItem>
        <TableItem term="Daemon version">
          <Skeleton className="h-6 w-48" />
        </TableItem>
        <TableItem term="Build time">
          <Skeleton className="h-6 w-48" />
        </TableItem>
        <TableItem term="Build version">
          <Skeleton className="h-6 w-48" />
        </TableItem>
        <TableItem term="Buildroot release">
          <Skeleton className="h-6 w-48" />
        </TableItem>
        <TableItem term="API version">
          <Skeleton className="h-6 w-48" />
        </TableItem>
        <TableItem term="BMC UI">
          <Skeleton className="h-6 w-48" />
        </TableItem>
      </dl>
    </TabView>
  );
}
