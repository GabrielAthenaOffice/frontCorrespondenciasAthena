import React, { useState, useEffect } from 'react';
import { DataProvider } from './context/DataContext';
import { Layout } from './components/Layout';
import { CorrespondenceManager } from './components/CorrespondenceManager';
import { CompanyManager } from './components/CompanyManager';
import { AuditLog } from './components/AuditLog';
import Login from './components/Login';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { API_BASE } from './service/api';
import { apiFetch } from './service/api';


const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const resp = await apiFetch('/auth/user', {
          method: "GET",
          credentials: "include", // 🔥 necessário para enviar o cookie
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
        });

        if (!resp.ok) throw new Error("unauthorized");

        const data = await resp.json();
        setIsAuthenticated(!!data);
      } catch (err) {
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-300">
        Verificando sessão...
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const DashboardContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
      case 'correspondences':
        return <CorrespondenceManager />;
      case 'companies':
        return <CompanyManager />;
      case 'audit':
        return <AuditLog />;
      default:
        return <CorrespondenceManager />;
    }
  };

  return (
    <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
};

function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <Routes>
          {/* Login público */}
          <Route path="/login" element={<Login />} />

          {/* Rotas protegidas */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <DashboardContent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </DataProvider>
  );
}

export default App;
