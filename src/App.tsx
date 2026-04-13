import { Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import Settings from "./pages/Settings";

function App() {
  return (
    <Routes>
      <Route path="/settings" element={<Settings />} />
      <Route path="/*" element={<AppLayout />} />
    </Routes>
  );
}

export default App;
