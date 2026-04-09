import type { ReactNode } from "react";
import { PageShell } from "@/components/PagePattern";
import { DataTable, type DataTableProps } from "@/components/DataTable";
import { ActionBarWrapper } from "./ActionBar";
import { PageHeader } from "./PageHeader";

type PageWrapperProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  primaryAction?: ReactNode;
  breadcrumb?: Array<{ label: string; href?: string }>;
  children: ReactNode;
};

export function PageWrapper({
  title,
  subtitle,
  primaryAction,
  breadcrumb,
  children,
}: PageWrapperProps) {
  return (
    <PageShell>
      <PageHeader
        title={title}
        subtitle={subtitle}
        primaryAction={primaryAction}
        breadcrumb={breadcrumb}
      />
      {children}
    </PageShell>
  );
}

export function DataTableWrapper<T extends { id?: number | string }>(props: DataTableProps<T>) {
  return <DataTable {...props} />;
}

export { ActionBarWrapper };
