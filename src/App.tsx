import "./App.css";
import { Route, Routes } from "react-router-dom";
import { AppLayout } from "@layouts/AppLayout";
import { SettingsScreen } from "@components/Settings/SettingsScreen";
import { useHostKeyPrompts } from "@hooks/useHostKeyPrompts";

function App() {
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
