import { create } from 'zustand';

let toastIdCounter = 0;

const useUIStore = create((set) => ({
  toasts: [],
  modalContent: null,
  sidebarOpen: true,

  addToast: (toast) => {
    const id = ++toastIdCounter;
    const newToast = { id, duration: 5000, ...toast };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    if (newToast.duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, newToast.duration);
    }

    return id;
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  showModal: (content) => set({ modalContent: content }),
  hideModal: () => set({ modalContent: null }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));

export default useUIStore;
