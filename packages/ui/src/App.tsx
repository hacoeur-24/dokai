import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { DocOrEditor } from './components/DocOrEditor.js';
import { SettingsView } from './components/SettingsView.js';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dokai" replace />} />
      <Route element={<Layout />}>
        <Route path="/dokai/_settings" element={<SettingsView />} />
        <Route path="/dokai/*" element={<DocOrEditor />} />
      </Route>
    </Routes>
  );
}
