import React, { useState } from 'react';
import { DataProvider } from './context/DataContext';
import { Layout } from './components/Layout';
import { CorrespondenceManager } from './components/CorrespondenceManager';
import { CompanyManager } from './components/CompanyManager';
import { AuditLog } from './components/AuditLog';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <CorrespondenceManager />;
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
      <AppContent />
    </DataProvider>
  );
}

export default App;