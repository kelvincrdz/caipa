/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Home from "./pages/Home";
import Register from "./pages/Register";
import AdminView from "./pages/AdminView";
import ClientView from "./pages/ClientView";
import QueueTV from "./pages/QueueTV";
import SuperAdmin from "./pages/SuperAdmin";
import SpotifyCallback from "./pages/SpotifyCallback";
import StatsView from "./pages/StatsView";
import BarProfile from "./pages/BarProfile";
import { applyTheme } from "./lib/themes";

export default function App() {
  // Apply boteco as global default; bar-specific pages override this themselves
  useEffect(() => { applyTheme("boteco"); }, []);

  return (
    <div className="app-root selection:bg-brand-blue selection:text-brand-cream">
      {/* Texture Overlay */}
      <div className="bg-grainy fixed inset-0 z-[100] pointer-events-none overflow-hidden" />
      
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/cadastro" element={<Register />} />
          <Route path="/admin" element={<SuperAdmin />} />
          <Route path="/superadmin" element={<SuperAdmin />} />
          <Route path="/spotify/callback" element={<SpotifyCallback />} />
          <Route path="/admin/:slug" element={<AdminView />} />
          <Route path="/stats/:slug" element={<StatsView />} />
          <Route path="/bar/:slug" element={<BarProfile />} />
          <Route path="/:slug" element={<ClientView />} />
          <Route path="/:slug/fila" element={<QueueTV />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}
