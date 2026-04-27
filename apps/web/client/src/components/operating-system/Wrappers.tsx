import type { ReactNode } from "react";
import { PageShell } from "@/components/PagePattern";
import { DataTable, type DataTableProps } from "@/components/DataTable";
import { ActionBarWrapper } from "./ActionBar";
import { OperationalHeader } from "./OperationalHeader";

type PageWrapperProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  primaryAction?: ReactNode;
  breadcrumb?: Array<{ label: string; href?: string }>;
  showOperationalHeader?: boolean;
  children: ReactNode;
};

export function PageWrapper({
  title: _title,
  subtitle,
  primaryAction,
  breadcrumb,
  showOperationalHeader = true,
  children,
}: PageWrapperProps) {
  return (
    <PageShell>
      <div className="space-y-4 md:space-y-5">
        {showOperationalHeader ? (
          <OperationalHeader
            description={subtitle}
            primaryAction={primaryAction}
            breadcrumb={breadcrumb}
          />
        ) : null}
        {children}
      </div>
    </PageShell>
  );
}

export function DataTableWrapper<T extends { id?: number | string }>(props: DataTableProps<T>) {
  return <DataTable {...props} />;
}

export { ActionBarWrapper };
