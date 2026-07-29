import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, ShieldAlert, Settings, FileText, Shield, ChevronDown } from 'lucide-react';
import UserProfileModal from './UserProfileModal';
import SettingsModal from './SettingsModal';

const Navbar = ({ onRecalculateAll, isRecalculating, currentUser, onLogout, showSuperAdmin, setShowSuperAdmin, onLoginClick, onHomeClick }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const onGstr7Page = location.pathname === '/gstr7-master';
    const [showProfile, setShowProfile] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <>
            <style>{`
                .navbar-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    padding: 0.45rem 0.9rem;
                    border-radius: 10px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    font-family: 'Outfit', sans-serif;
                    cursor: pointer;
                    border: 1px solid transparent;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }
                .navbar-btn-ghost {
                    background: transparent;
                    color: #64748b;
                    border-color: #e2e8f0;
                }
                .navbar-btn-ghost:hover {
                    background: #f1f5f9;
                    color: #4f46e5;
                    border-color: #c7d2fe;
                }
                .navbar-btn-accent {
                    background: linear-gradient(135deg, #ede9fe, #e0e7ff);
                    color: #5b21b6;
                    border-color: #c4b5fd;
                }
                .navbar-btn-accent:hover {
                    background: linear-gradient(135deg, #ddd6fe, #c7d2fe);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(124,58,237,0.2);
                }
                .navbar-btn-active {
                    background: linear-gradient(135deg, #7c3aed, #4f46e5);
                    color: white;
                    border-color: transparent;
                    box-shadow: 0 4px 12px rgba(99,102,241,0.35);
                }
                .navbar-btn-active:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px rgba(99,102,241,0.45);
                }
                .user-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.35rem 0.75rem 0.35rem 0.35rem;
                    border-radius: 30px;
                    background: linear-gradient(135deg, #f0f4ff, #ede9fe);
                    border: 1px solid #c4b5fd;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-family: 'Outfit', sans-serif;
                }
                .user-pill:hover {
                    background: linear-gradient(135deg, #e0e7ff, #ddd6fe);
                    box-shadow: 0 4px 12px rgba(124,58,237,0.18);
                    transform: translateY(-1px);
                }
                .user-avatar {
                    width: 28px; height: 28px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #7c3aed, #4f46e5);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 0.75rem; font-weight: 800; color: white;
                    flex-shrink: 0;
                }
            `}</style>

            <nav style={{
                position: 'sticky', top: 0, zIndex: 100,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0 1.5rem',
                height: '58px',
                background: scrolled
                    ? 'rgba(255,255,255,0.92)'
                    : 'rgba(255,255,255,0.97)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderBottom: scrolled ? '1px solid rgba(226,232,240,0.9)' : '1px solid rgba(226,232,240,0.6)',
                boxShadow: scrolled ? '0 4px 20px -2px rgba(0,0,0,0.08)' : '0 1px 4px rgba(0,0,0,0.04)',
                transition: 'all 0.3s ease',
            }}>
                {/* Brand */}
                <div
                    onClick={onHomeClick}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', userSelect: 'none' }}
                >
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '9px',
                        background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(124,58,237,0.35)',
                    }}>
                        <Shield size={17} color="white" />
                    </div>
                    <div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e1b4b', lineHeight: 1, letterSpacing: '-0.3px' }}>GRC Manager</div>
                        <div style={{ fontSize: '0.58rem', color: '#7c3aed', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Score & Compliance</div>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {currentUser ? (
                        <>
                            {currentUser.role === 'super_admin' && (
                                <button
                                    className={`navbar-btn ${(showSuperAdmin || onGstr7Page) ? 'navbar-btn-active' : 'navbar-btn-ghost'}`}
                                    onClick={() => {
                                        if (onGstr7Page) {
                                            navigate('/');
                                        } else {
                                            setShowSuperAdmin(!showSuperAdmin);
                                        }
                                    }}
                                    title="Super Admin Control Center"
                                >
                                    <ShieldAlert size={15} />
                                    <span className="btn-text">{(showSuperAdmin || onGstr7Page) ? 'Back to Dashboard' : 'Super Admin'}</span>
                                </button>
                            )}

                            {currentUser.role !== 'super_admin' && (
                                <button
                                    className={`navbar-btn ${onGstr7Page ? 'navbar-btn-active' : 'navbar-btn-ghost'}`}
                                    onClick={() => onGstr7Page ? navigate('/') : navigate('/gstr7-master')}
                                    title="Manage GSTR-7"
                                >
                                    <FileText size={15} />
                                    <span className="btn-text">{onGstr7Page ? 'Back' : 'GSTR-7'}</span>
                                </button>
                            )}

                            {onGstr7Page && currentUser.role === 'super_admin' && (
                                <button
                                    className="navbar-btn navbar-btn-ghost"
                                    onClick={() => navigate('/')}
                                    title="Back to Dashboard"
                                >
                                    ← Dashboard
                                </button>
                            )}

                            {!showSuperAdmin && currentUser.role === 'super_admin' && (
                                <>
                                    <button
                                        className="navbar-btn navbar-btn-ghost"
                                        onClick={() => navigate('/trash')}
                                        title="Trash Folder"
                                    >
                                        <span style={{ fontSize: '15px' }}>🗑️</span>
                                        <span className="btn-text">Trash</span>
                                    </button>
                                    <button
                                        className="navbar-btn navbar-btn-ghost"
                                        onClick={() => setShowSettings(true)}
                                        title="Rule Settings"
                                    >
                                        <Settings size={15} />
                                        <span className="btn-text">Settings</span>
                                    </button>
                                </>
                            )}

                            {/* User Pill */}
                            <div className="user-pill" onClick={() => setShowProfile(true)} title="User Profile">
                                <div className="user-avatar">
                                    {currentUser.name ? currentUser.name[0].toUpperCase() : <User size={13} />}
                                </div>
                                <span style={{ fontSize: '0.83rem', fontWeight: 700, color: '#4c1d95', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {currentUser.name}
                                </span>
                                <ChevronDown size={13} color="#7c3aed" />
                            </div>
                        </>
                    ) : (
                        <button className="navbar-btn navbar-btn-accent" onClick={onLoginClick}>
                            Login
                        </button>
                    )}
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
