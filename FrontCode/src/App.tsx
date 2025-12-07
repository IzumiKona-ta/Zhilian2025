import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DataCollection from './pages/DataCollection';
import ThreatAnalysis from './pages/ThreatAnalysis';
import ThreatAlerts from './pages/ThreatAlerts';
import ThreatTracing from './pages/ThreatTracing';
import ReportGeneration from './pages/ReportGeneration';
import HostMonitoring from './pages/HostMonitoring';
import ProcessMonitoring from './pages/ProcessMonitoring';
import OrgManagement from './pages/OrgManagement';
import Login from './pages/Login';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <HashRouter>
      <div className="flex min-h-screen bg-cyber-950 text-slate-200 font-sans">
        <Sidebar onLogout={handleLogout} />
        <main className="flex-1 ml-72 p-8 overflow-y-auto h-screen bg-cyber-900/50">
          <Routes>
            <Route path="/" element={<DataCollection />} />
            <Route path="/analysis" element={<ThreatAnalysis />} />
            <Route path="/alerts" element={<ThreatAlerts />} />
            <Route path="/tracing" element={<ThreatTracing />} />
            <Route path="/hids" element={<HostMonitoring />} />
            <Route path="/hids/processes" element={<ProcessMonitoring />} />
            <Route path="/reports" element={<ReportGeneration />} />
            <Route path="/organization" element={<OrgManagement />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;