import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import SuperAdmin from './components/SuperAdmin';
import { apiClient } from './api/apiClient';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [forceRefreshFlag, setForceRefreshFlag] = useState(0);
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);

  // Check simple local storage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('grc_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (user) => {
    localStorage.setItem('grc_user', JSON.stringify(user));
    setCurrentUser(user);
    setShowSuperAdmin(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('grc_user');
    setCurrentUser(null);
    setShowSuperAdmin(false);
  };

  const handleRecalculateAll = async () => {
    if (!window.confirm("Are you sure you want to recalculate all GST scores? This may take a while.")) {
      return;
    }

    setIsRecalculating(true);
    try {
      await apiClient.recalculateAll();
      alert("All scores recalculated successfully!");
      setForceRefreshFlag(prev => prev + 1); // Trigger dashboard refresh
    } catch (err) {
      alert(err.message || 'Failed to recalculate scores.');
    } finally {
      setIsRecalculating(false);
    }
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-container">
      <Navbar
        onRecalculateAll={handleRecalculateAll}
        isRecalculating={isRecalculating}
        currentUser={currentUser}
        onLogout={handleLogout}
        showSuperAdmin={showSuperAdmin}
        setShowSuperAdmin={setShowSuperAdmin}
      />

      <main className="main-content">
        {showSuperAdmin && currentUser.role === 'SUPER_ADMIN' ? (
          <SuperAdmin currentUser={currentUser} />
        ) : (
          <Dashboard forceRefreshFlag={forceRefreshFlag} />
        )}
      </main>
    </div>
  );
}

export default App;
