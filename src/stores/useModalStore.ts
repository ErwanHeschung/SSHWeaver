import { create } from "zustand";
import type { ComponentType } from "react";

interface ModalEntry {
  Component: ComponentType<any>;
  props: Record<string, unknown>;
}

interface ModalState {
  modal: ModalEntry | null;
  open: <P extends object>(
    Component: ComponentType<P>,
    ...args: Record<string, never> extends P ? [props?: P] : [props: P]
  ) => void;
  close: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  modal: null,
  open: (Component, ...args) =>
    set({
      modal: {
        Component,
        props: args[0] ?? {},
      },
    }),
  close: () => set({ modal: null }),
}));
