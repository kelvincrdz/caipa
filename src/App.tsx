/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Register from "./pages/Register";
import AdminView from "./pages/AdminView";
import ClientView from "./pages/ClientView";
import QueueTV from "./pages/QueueTV";
import SuperAdmin from "./pages/SuperAdmin";
import SpotifyCallback from "./pages/SpotifyCallback";
import StatsView from "./pages/StatsView";
import BarProfile from "./pages/BarProfile";

export default function App() {
  return (
    <div className="relative min-h-screen bg-secondary text-white">
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
