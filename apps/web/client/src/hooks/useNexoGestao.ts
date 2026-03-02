import { useState, useEffect, useCallback } from "react";
import { api, AdminOverview, Customer, Appointment, ServiceOrder, Charge, FinanceOverview } from "@/lib/api";

export function useAdminOverview() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.getAdminOverview();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useCustomers() {
  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.listCustomers();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(
    async (customer: { name: string; phone: string; email?: string; notes?: string }) => {
      try {
        const result = await api.createCustomer(customer);
        setData((prev) => [...prev, result]);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        throw error;
      }
    },
    []
  );

  const update = useCallback(
    async (
      id: string,
      data: Partial<{
        name: string;
        phone: string;
        email: string;
        notes: string;
        active: boolean;
      }>
    ) => {
      try {
        const result = await api.updateCustomer(id, data);
        setData((prev) => prev.map((c) => (c.id === id ? result : c)));
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        throw error;
      }
    },
    []
  );

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch, create, update };
}

export function useAppointments(filters?: { from?: string; to?: string; status?: string; customerId?: string }) {
  const [data, setData] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.listAppointments(filters);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const create = useCallback(
    async (appointment: {
      customerId: string;
      startsAt: string;
      endsAt: string;
      status?: string;
      notes?: string;
    }) => {
      try {
        const result = await api.createAppointment(appointment);
        setData((prev) => [...prev, result]);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        throw error;
      }
    },
    []
  );

  const update = useCallback(
    async (
      id: string,
      data: Partial<{
        startsAt: string;
        endsAt: string;
        status: string;
        notes: string;
      }>
    ) => {
      try {
        const result = await api.updateAppointment(id, data);
        setData((prev) => prev.map((a) => (a.id === id ? result : a)));
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        throw error;
      }
    },
    []
  );

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch, create, update };
}

export function useServiceOrders(filters?: {
  status?: string;
  customerId?: string;
  assignedToPersonId?: string;
}) {
  const [data, setData] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.listServiceOrders(filters);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const create = useCallback(
    async (order: {
      customerId: string;
      title: string;
      description?: string;
      priority?: number;
      scheduledFor?: string;
      appointmentId?: string;
      assignedToPersonId?: string;
    }) => {
      try {
        const result = await api.createServiceOrder(order);
        setData((prev) => [...prev, result]);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        throw error;
      }
    },
    []
  );

  const update = useCallback(
    async (
      id: string,
      data: Partial<{
        title: string;
        description: string;
        status: string;
        priority: number;
        assignedToPersonId: string;
      }>
    ) => {
      try {
        const result = await api.updateServiceOrder(id, data);
        setData((prev) => prev.map((o) => (o.id === id ? result : o)));
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        throw error;
      }
    },
    []
  );

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch, create, update };
}

export function useFinance() {
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.getFinanceOverview();
      setOverview(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCharges = useCallback(
    async (filters?: { status?: string; customerId?: string; page?: number; limit?: number }) => {
      try {
        const result = await api.listCharges(filters);
        setCharges(result.items);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
        setCharges([]);
      }
    },
    []
  );

  const payCharge = useCallback(async (chargeId: string, method: string, amountCents: number) => {
    try {
      const result = await api.payCharge(chargeId, { method, amountCents });
      setCharges((prev) => prev.map((c) => (c.id === chargeId ? result : c)));
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      throw error;
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    fetchCharges();
  }, [fetchOverview, fetchCharges]);

  return {
    overview,
    charges,
    loading,
    error,
    refetchOverview: fetchOverview,
    refetchCharges: fetchCharges,
    payCharge,
  };
}
