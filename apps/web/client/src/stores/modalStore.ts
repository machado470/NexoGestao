import { create } from 'zustand';

export type ModalType = 
  | 'create-customer'
  | 'edit-customer'
  | 'delete-customer'
  | 'create-appointment'
  | 'edit-appointment'
  | 'delete-appointment'
  | 'create-service-order'
  | 'edit-service-order'
  | 'delete-service-order'
  | 'create-charge'
  | 'edit-charge'
  | 'delete-charge'
  | 'confirm-action';

export interface ModalState {
  type: ModalType | null;
  isOpen: boolean;
  data?: Record<string, any>;
  onSuccess?: () => void;
}

interface ModalStore {
  modals: Record<ModalType, ModalState>;
  openModal: (type: ModalType, data?: Record<string, any>, onSuccess?: () => void) => void;
  closeModal: (type: ModalType) => void;
  closeAll: () => void;
  isModalOpen: (type: ModalType) => boolean;
  getModalData: (type: ModalType) => Record<string, any> | undefined;
}

const initialState: ModalState = {
  type: null,
  isOpen: false,
  data: undefined,
  onSuccess: undefined,
};

const modalTypes: ModalType[] = [
  'create-customer',
  'edit-customer',
  'delete-customer',
  'create-appointment',
  'edit-appointment',
  'delete-appointment',
  'create-service-order',
  'edit-service-order',
  'delete-service-order',
  'create-charge',
  'edit-charge',
  'delete-charge',
  'confirm-action',
];

export const useModalStore = create<ModalStore>((set, get) => ({
  modals: modalTypes.reduce(
    (acc, type) => ({
      ...acc,
      [type]: initialState,
    }),
    {} as Record<ModalType, ModalState>
  ),

  openModal: (type, data, onSuccess) => {
    set((state) => ({
      modals: {
        ...state.modals,
        [type]: {
          type,
          isOpen: true,
          data,
          onSuccess,
        },
      },
    }));
  },

  closeModal: (type) => {
    set((state) => ({
      modals: {
        ...state.modals,
        [type]: initialState,
      },
    }));
  },

  closeAll: () => {
    set((state) => ({
      modals: modalTypes.reduce(
        (acc, type) => ({
          ...acc,
          [type]: initialState,
        }),
        {} as Record<ModalType, ModalState>
      ),
    }));
  },

  isModalOpen: (type) => {
    return get().modals[type].isOpen;
  },

  getModalData: (type) => {
    return get().modals[type].data;
  },
}));

// Helper hook for easier usage
export const useModal = (type: ModalType) => {
  const modal = useModalStore((state) => state.modals[type]);
  const openModal = useModalStore((state) => state.openModal);
  const closeModal = useModalStore((state) => state.closeModal);

  return {
    isOpen: modal.isOpen,
    data: modal.data,
    onSuccess: modal.onSuccess,
    open: (data?: Record<string, any>, onSuccess?: () => void) => openModal(type, data, onSuccess),
    close: () => closeModal(type),
  };
};
