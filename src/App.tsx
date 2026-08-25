import "./App.css";
import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { AppLayout } from "@layouts/AppLayout";
import { SettingsScreen } from "@components/Settings/SettingsScreen";
import { useConnectionStore } from "@stores/useConnectionStore";
import { useProfileStore } from "@stores/useProfileStore";
import { useHostKeyPrompts } from "@hooks/useHostKeyPrompts";

function App() {
  useEffect(() => {
    void useConnectionStore.getState().load();
    void useProfileStore.getState().load();
  }, []);
  
  useHostKeyPrompts();

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={null} />
        <Route path="settings" element={<SettingsScreen />} />
      </Route>
    </Routes>
  );
}

export default App;
