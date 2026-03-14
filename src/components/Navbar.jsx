import React, { useState } from 'react';
import { RefreshCw, User, ShieldAlert, Settings } from 'lucide-react';
import UserProfileModal from './UserProfileModal';
import SettingsModal from './SettingsModal';

const Navbar = ({ onRecalculateAll, isRecalculating, currentUser, onLogout, showSuperAdmin, setShowSuperAdmin }) => {
    const [showProfile, setShowProfile] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    return (
        <>
            <nav className="navbar">
                <h1>GRC Score Manager</h1>

                <div className="navbar-actions">
                    {currentUser?.role === 'SUPER_ADMIN' && (
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowSuperAdmin(!showSuperAdmin)}
                            title="Super Admin Panel"
                        >
                            <ShieldAlert size={18} />
                            <span className="btn-text">{showSuperAdmin ? 'Back to Dashboard' : 'Admin Portal'}</span>
                        </button>
                    )}

                    {!showSuperAdmin && currentUser?.role === 'SUPER_ADMIN' && (
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowSettings(true)}
                            title="Rule Settings"
                        >
                            <Settings size={18} />
                            <span className="btn-text">Settings</span>
                        </button>
                    )}

                    <button
                        className="btn"
                        style={{ backgroundColor: 'var(--new-item-bg)', color: 'var(--primary-color)' }}
                        onClick={() => setShowProfile(true)}
                        title="User Profile"
                    >
                        <User size={18} /> <span className="btn-text">{currentUser?.name}</span>
                    </button>
                </div>
            </nav>

            {showProfile && (
                <UserProfileModal
                    user={currentUser}
                    onClose={() => setShowProfile(false)}
                    onLogout={() => { setShowProfile(false); onLogout(); }}
                />
            )}

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
