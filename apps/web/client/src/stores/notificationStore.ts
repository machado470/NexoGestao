import { create } from 'zustand';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number; // ms, 0 = persistent
  timestamp: number;
}

interface NotificationStore {
  notifications: Notification[];
  add: (notification: Omit<Notification, 'id' | 'timestamp'>) => string;
  remove: (id: string) => void;
  clear: () => void;
}

const getIcon = (type: NotificationType) => {
  switch (type) {
    case 'success':
      return CheckCircle;
    case 'error':
      return AlertCircle;
    case 'warning':
      return AlertTriangle;
    case 'info':
      return Info;
  }
};

const getColor = (type: NotificationType) => {
  switch (type) {
    case 'success':
      return 'border-l-2 border-l-[var(--success)] text-[var(--text-primary)]';
    case 'error':
      return 'border-l-2 border-l-[var(--danger)] text-[var(--text-primary)]';
    case 'warning':
      return 'border-l-2 border-l-[var(--warning)] text-[var(--text-primary)]';
    case 'info':
      return 'border-l-2 border-l-[var(--accent)] text-[var(--text-primary)]';
  }
};

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],

  add: (notification) => {
    const id = `${Date.now()}-${Math.random()}`;
    const duration = notification.duration ?? 5000;

    set((state) => ({
      notifications: [
        ...state.notifications,
        {
          ...notification,
          id,
          timestamp: Date.now(),
        },
      ],
    }));

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, duration);
    }

    return id;
  },

  remove: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clear: () => {
    set({ notifications: [] });
  },
}));

export const notify = {
  success: (title: string, description?: string, action?: Notification['action']) => {
    return useNotificationStore.getState().add({
      type: 'success',
      title,
      description,
      action,
      duration: 5000,
    });
  },

  successPersistent: (title: string, description?: string, action?: Notification['action']) => {
    return useNotificationStore.getState().add({
      type: 'success',
      title,
      description,
      action,
      duration: 0,
    });
  },

  error: (title: string, description?: string, action?: Notification['action']) => {
    return useNotificationStore.getState().add({
      type: 'error',
      title,
      description,
      action,
      duration: 7000,
    });
  },

  warning: (title: string, description?: string, action?: Notification['action']) => {
    return useNotificationStore.getState().add({
      type: 'warning',
      title,
      description,
      action,
      duration: 6000,
    });
  },

  info: (title: string, description?: string, action?: Notification['action']) => {
    return useNotificationStore.getState().add({
      type: 'info',
      title,
      description,
      action,
      duration: 5000,
    });
  },

  loading: (title: string, description?: string) => {
    return useNotificationStore.getState().add({
      type: 'info',
      title,
      description,
      duration: 0,
    });
  },
};

export { getIcon, getColor };
