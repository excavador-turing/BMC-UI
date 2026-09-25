import { type ReactNode } from "react";

interface TableItemProps {
  term: string;
  children?: ReactNode;
}

export default function TableItem({ term, children }: TableItemProps) {
  return (
    <div className="flex flex-row border-b py-3 text-sm first:pt-0 last:border-none">
      <dt className="w-1/2 text-muted-foreground lg:w-1/4">{term}</dt>
      {children && (
        <dd className="w-1/2 text-right lg:w-3/4 lg:text-start">{children}</dd>
      )}
    </div>
  );
}
