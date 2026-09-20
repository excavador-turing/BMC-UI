import { type ReactNode } from "react";

interface TabViewProps {
  title?: string;
  /**
   * Lay the cards out in two columns at `xl`, instead of one down the page.
   *
   * Every tab stacked full-width cards down a 1280 px-wide screen, so pages
   * made of three or four short cards scrolled while half the window stayed
   * empty. Measured on bmc-2: Network 1149 px, Access 1670 px, both against
   * 744 px of usable height.
   *
   * Only at `xl`, where `main` is 1200 px and a column is still wide enough
   * for a form. Below that it stacks exactly as before — two columns at
   * 768 px would be two cramped columns.
   *
   * A card that needs the full width says so itself with `xl:col-span-2`;
   * the grid starts its rows at the top so a short card does not stretch to
   * match a tall neighbour.
   */
  columns?: boolean;
  children: ReactNode;
}

export default function TabView({ title, columns, children }: TabViewProps) {
  return (
    <section>
      {title && <h2 className="mb-8 text-lg font-bold">{title}</h2>}
      <div
        className={
          columns ? "grid gap-8 xl:grid-cols-2 xl:items-start" : "space-y-8"
        }
      >
        {children}
      </div>
    </section>
  );
}
