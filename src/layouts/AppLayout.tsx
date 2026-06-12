import { Outlet } from "react-router-dom";
import { Shell } from "@components/Shell";
import { ModalHost } from "@components/Modal/ModalHost";
import { ConnectionScreen } from "@screens/ConnectionScreen";

export function AppLayout() {
  return (
    <Shell>
      <ConnectionScreen />
      <Outlet />
      <ModalHost />
    </Shell>
  );
}
