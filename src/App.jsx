import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import SuperAdmin from "./components/SuperAdmin";
import AdminDashboard from "./components/AdminDashboard";
import { apiClient } from "./api/apiClient";
import Gstr7Management from "./components/Gstr7Management";
import Gstr7ReviewPage from "./components/Gstr7ReviewPage";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import "./App.css";

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [forceRefreshFlag, setForceRefreshFlag] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Check simple local storage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("grc_user");
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setCurrentUser(parsedUser);

      const checkUserStatus = () => {
        apiClient
          .getUserById(parsedUser.id)
          .then((user) => {
            if (!user.active) {
              handleLogout();
              alert(
                "Your account has been deactivated. Please contact administrator.",
              );
            } else {
              localStorage.setItem("grc_user", JSON.stringify(user));
              setCurrentUser(user);
            }
          })
          .catch(() => {
            handleLogout();
          });
      };

      checkUserStatus();
      const interval = setInterval(checkUserStatus, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, []);

  const handleLogin = (user) => {
    localStorage.setItem("grc_user", JSON.stringify(user));
    setCurrentUser(user);
    navigate("/");
    setShowLogin(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("grc_user");
    setCurrentUser(null);
    navigate("/");
    setShowLogin(false);
  };

  const handleRecalculateAll = async () => {
    if (
      !window.confirm(
        "Are you sure you want to recalculate all GST scores? This may take a while.",
      )
    )
      return;
    setIsRecalculating(true);
    try {
      await apiClient.recalculateAll();
      alert("All scores recalculated successfully!");
      setForceRefreshFlag((prev) => prev + 1);
    } catch (err) {
      alert(err.message || "Failed to recalculate scores.");
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleHomeClick = () => {
    navigate("/");
    setShowLogin(false);
  };

  if (showLogin && !currentUser) {
    return (
      <div className="app-container">
        <nav className="navbar">
          <h1 onClick={handleHomeClick} style={{ cursor: "pointer" }}>
            GRC Score Manager
          </h1>
          <button
            className="btn btn-secondary"
            onClick={() => setShowLogin(false)}
          >
            Back to Dashboard
          </button>
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
        onLoginClick={() => setShowLogin(true)}
      />

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard forceRefreshFlag={forceRefreshFlag} currentUser={currentUser} />} />
          <Route path="/admin" element={<AdminDashboard currentUser={currentUser} onLogout={handleLogout} />} />
          <Route path="/gstr7-management" element={<Gstr7Management />} />
          <Route path="/gstr7-reviews" element={currentUser?.role === "super_admin" ? <Gstr7ReviewPage /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <footer
        style={{
          textAlign: "center",
          padding: "1.5rem 1rem 3rem",
          fontSize: "0.75rem",
          color: "var(--text-light)",
          opacity: 0.8,
          lineHeight: 1.5,
          borderTop: "1px solid var(--border-color)",
          marginTop: "2rem",
        }}
      >
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          All figures and data on this website are for reference purposes only;
          some information may be approximate or subject to change and should be
          independently verified.
        </div>
      </footer>
    </div>
  );
}

export default App;
