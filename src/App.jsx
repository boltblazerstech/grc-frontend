import React, { useState, useEffect, Suspense } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import { apiClient } from './api/apiClient';
import './App.css';

const Login = React.lazy(() => import('./components/Login'));
const SuperAdmin = React.lazy(() => import('./components/SuperAdmin'));
const Gstr7Management = React.lazy(() => import('./components/Gstr7Management'));
const AdminCenter = React.lazy(() => import('./components/AdminCenter'));
const MasterView = React.lazy(() => import('./components/MasterView'));
const Gstr7DataEntryRedirect = React.lazy(() => import('./components/Gstr7DataEntryRedirect'));
const TrashFolder = React.lazy(() => import('./components/TrashFolder'));

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [forceRefreshFlag, setForceRefreshFlag] = useState(0);
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const navigate = useNavigate();

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

  const handleHomeClick = () => {
    setShowSuperAdmin(false);
    setShowLogin(false);
    navigate('/');
  };

  if (showLogin && !currentUser) {
    return (
      <div className="app-container">
        <nav className="navbar">
          <h1 onClick={handleHomeClick} style={{ cursor: 'pointer' }}>GRC Score Manager</h1>
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
        setShowSuperAdmin={(val) => { setShowSuperAdmin(val); }}
        onLoginClick={() => setShowLogin(true)}
        onHomeClick={handleHomeClick}
      />

      <main className="main-content">
        <Suspense fallback={<div style={{display: 'flex', justifyContent: 'center', padding: '3rem'}}><div className="spinner"></div></div>}>
          <Routes>
            <Route path="/gstr7-master" element={<Gstr7Management />} />
            <Route path="/grc/master-view" element={<MasterView currentUser={currentUser} />} />
            <Route path="/grc/gstr7/:gstin" element={<Gstr7DataEntryRedirect />} />
            <Route path="/trash" element={<TrashFolder currentUser={currentUser} />} />
            <Route path="*" element={
              showSuperAdmin && currentUser?.role === 'super_admin' ? (
                <SuperAdmin currentUser={currentUser} />
              ) : (
                <Dashboard
                  forceRefreshFlag={forceRefreshFlag}
                  currentUser={currentUser}
                  onOpenGstr7={(pan) => {
                    navigate('/gstr7-master', { state: { searchQuery: pan || '' } });
                    setShowSuperAdmin(false);
                  }}
                />
              )
            } />
          </Routes>
        </Suspense>
      </main>

      <footer style={{ 
        textAlign: 'center', 
        padding: '1.5rem 1rem 3rem', 
        fontSize: '0.75rem', 
        color: 'var(--text-light)', 
        opacity: 0.8,
        lineHeight: 1.5,
        borderTop: '1px solid var(--border-color)',
        marginTop: '2rem'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          All figures and data on this website are for reference purposes only; 
          some information may be approximate or subject to change and should be independently verified.
        </div>
      </footer>
    </div>
  );
}

export default App;
