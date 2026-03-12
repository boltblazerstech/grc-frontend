import React, { useState } from 'react';
import { RefreshCw, User, ShieldAlert } from 'lucide-react';
import UserProfileModal from './UserProfileModal';

const Navbar = ({ onRecalculateAll, isRecalculating, currentUser, onLogout, showSuperAdmin, setShowSuperAdmin }) => {
    const [showProfile, setShowProfile] = useState(false);

    return (
        <>
            <nav className="navbar">
                <h1>GRC Score Manager</h1>
                
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {currentUser?.role === 'SUPER_ADMIN' && (
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowSuperAdmin(!showSuperAdmin)}
                            title="Super Admin Panel"
                        >
                            <ShieldAlert size={18} /> 
                            {showSuperAdmin ? 'Back to Dashboard' : 'Super Admin'}
                        </button>
                    )}

                    {!showSuperAdmin && (
                        <button
                            className="btn btn-primary"
                            onClick={onRecalculateAll}
                            disabled={isRecalculating}
                        >
                            {isRecalculating ? (
                                <><span className="spinner"></span> Recalculating...</>
                            ) : (
                                <><RefreshCw size={18} /> Recalculate All</>
                            )}
                        </button>
                    )}

                    <button 
                        className="btn" 
                        style={{ backgroundColor: 'var(--new-item-bg)', color: 'var(--primary-color)' }}
                        onClick={() => setShowProfile(true)}
                        title="User Profile"
                    >
                        <User size={18} /> {currentUser?.name}
                    </button>
                </div>
            </nav>

            {showProfile && (
                <UserProfileModal 
                    user={currentUser} 
                    onClose={() => setShowProfile(false)} 
                    onLogout={() => {
                        setShowProfile(false);
                        onLogout();
                    }}
                />
            )}
        </>
    );
};

export default Navbar;
