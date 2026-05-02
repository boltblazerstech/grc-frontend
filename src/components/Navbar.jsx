import React, { useState } from 'react';
import { RefreshCw, User, ShieldAlert, Settings, FileText } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import UserProfileModal from './UserProfileModal';
import SettingsModal from './SettingsModal';

const Navbar = ({ onRecalculateAll, isRecalculating, currentUser, onLogout, onLoginClick }) => {
    const [showProfile, setShowProfile] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;

    const getBtnStyle = (isActive, activeBg, inactiveBg, inactiveColor) => ({
        backgroundColor: isActive ? activeBg : inactiveBg,
        color: isActive ? '#fff' : inactiveColor,
        border: 'none',
        fontWeight: isActive ? '600' : '500',
        boxShadow: isActive ? `0 2px 8px ${activeBg}50` : 'none',
        transition: 'all 0.2s ease',
    });

    return (
        <>
            <nav className="navbar">
                <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>GRC Score Manager</h1>

                <div className="navbar-actions">
                    {currentUser ? (
                        <>
                            <button
                                className="btn"
                                style={getBtnStyle(currentPath === '/gstr7-management', '#8b5cf6', '#ede9fe', '#7c3aed')}
                                onClick={() => navigate('/gstr7-management')}
                                title="GSTR-7 Management"
                            >
                                <FileText size={18} />
                                <span className="btn-text">GSTR-7 Management</span>
                            </button>

                            {currentUser.role === 'super_admin' && (
                                <>
                                    <button
                                        className="btn"
                                        style={getBtnStyle(currentPath === '/gstr7-reviews', '#0ea5e9', '#e0f2fe', '#0284c7')}
                                        onClick={() => navigate('/gstr7-reviews')}
                                        title="Pending GSTR-7 Reviews"
                                    >
                                        <FileText size={18} />
                                        <span className="btn-text">GSTR-7 Reviews</span>
                                    </button>
                                </>
                            )}

                            {currentPath === '/' && currentUser.role === 'super_admin' && (
                                <button
                                    className="btn"
                                    style={{ ...getBtnStyle(showSettings, '#64748b', '#f1f5f9', '#475569'), padding: '0.6rem' }}
                                    onClick={() => setShowSettings(true)}
                                    title="Rule Settings"
                                >
                                    <Settings size={20} />
                                </button>
                            )}

                            <button
                                className="btn"
                                style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: 'white', border: 'none', boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)' }}
                                onClick={() => navigate('/admin')}
                                title="Account Details"
                            >
                                <User size={18} /> <span className="btn-text">{currentUser.name}</span>
                            </button>
                        </>
                    ) : (
                        <button className="btn btn-primary" onClick={onLoginClick}>
                            Login
                        </button>
                    )}
                </div>
            </nav>



            {showSettings && (
                <SettingsModal
                    onClose={() => setShowSettings(false)}
                    onRecalculateAll={() => { onRecalculateAll(); }}
                    isRecalculating={isRecalculating}
                />
            )}
        </>
    );
};

export default Navbar;
