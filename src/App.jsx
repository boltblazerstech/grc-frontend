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
  const [showLogin, setShowLogin] = useState(false);

  // Check simple local storage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('grc_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setCurrentUser(parsedUser);
      
      // Verify user still exists and is active
      const checkUserStatus = () => {
        apiClient.getUserById(parsedUser.id)
          .then(user => {
            if (!user.active) {
              handleLogout();
              alert("Your account has been deactivated. Please contact administrator.");
            } else {
              // Update local user data in case name/role changed
              localStorage.setItem('grc_user', JSON.stringify(user));
              setCurrentUser(user);
            }
          })
          .catch(() => {
            // User likely deleted
            handleLogout();
          });
      };

      checkUserStatus();
      const interval = setInterval(checkUserStatus, 5 * 60 * 1000); // Check every 5 minutes
      return () => clearInterval(interval);
    }
  }, []);

  const handleLogin = (user) => {
    localStorage.setItem('grc_user', JSON.stringify(user));
    setCurrentUser(user);
    setShowSuperAdmin(false);
    setShowLogin(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('grc_user');
    setCurrentUser(null);
    setShowSuperAdmin(false);
    setShowLogin(false);
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

  if (showLogin && !currentUser) {
    return (
      <div className="app-container">
        <nav className="navbar">
          <h1>GRC Score Manager</h1>
          <button className="btn btn-secondary" onClick={() => setShowLogin(false)}>Back to Dashboard</button>
        </nav>
        <Login onLogin={handleLogin} />
      </div>
    );
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
        onLoginClick={() => setShowLogin(true)}
      />

      <main className="main-content">
        {showSuperAdmin && currentUser?.role === 'SUPER_ADMIN' ? (
          <SuperAdmin currentUser={currentUser} />
        ) : (
          <Dashboard forceRefreshFlag={forceRefreshFlag} currentUser={currentUser} />
        )}
      </main>
    </div>
  );
}

export default App;
