import { useEffect, useRef } from "react";

type PageDiagnosticsInput = {
  page: string;
  isLoading: boolean;
  hasError: boolean;
  isEmpty: boolean;
  dataCount?: number;
};

const enabled = import.meta.env.DEV;

export function usePageDiagnostics({ page, isLoading, hasError, isEmpty, dataCount }: PageDiagnosticsInput) {
  const didLogRender = useRef(false);

  useEffect(() => {
    if (!enabled || didLogRender.current) return;
    console.info(`[diag:${page}] render`);
    didLogRender.current = true;
  }, [page]);

  useEffect(() => {
    if (!enabled) return;
    if (isLoading) {
      console.info(`[diag:${page}] loading_data`);
      return;
    }
    if (hasError) {
      console.error(`[diag:${page}] query_error`);
      return;
    }
    if (isEmpty) {
      console.warn(`[diag:${page}] empty_data`);
      return;
    }
    console.info(`[diag:${page}] data_ready`, { dataCount: dataCount ?? null });
  }, [page, isLoading, hasError, isEmpty, dataCount]);
}
