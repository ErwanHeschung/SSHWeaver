import { useModalStore } from "@stores/useModalStore";

export function ModalHost() {
  const modal = useModalStore((s) => s.modal);
  if (!modal) return null;

  const { Component, props } = modal;
  return <Component {...props} />;
}
