import React, { useState } from 'react';
import SuperAdmin from './SuperAdmin';
import UserProfileModal from './UserProfileModal';
import { Users, User } from 'lucide-react';

const AdminDashboard = ({ currentUser, onLogout }) => {
    const [activeTab, setActiveTab] = useState('profile');

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <button 
                    onClick={() => setActiveTab('profile')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        background: activeTab === 'profile' ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'transparent',
                        color: activeTab === 'profile' ? '#fff' : 'var(--text-light)',
                        border: 'none',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: activeTab === 'profile' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
                    }}
                >
                    <User size={18} /> My Profile
                </button>
                {currentUser.role === 'super_admin' && (
                    <button 
                        onClick={() => setActiveTab('users')}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: activeTab === 'users' ? '#f59e0b' : 'transparent',
                            color: activeTab === 'users' ? '#fff' : 'var(--text-light)',
                            border: 'none',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: activeTab === 'users' ? '0 4px 12px rgba(245, 158, 11, 0.3)' : 'none'
                        }}
                    >
                        <Users size={18} /> User Management
                    </button>
                )}
            </div>

            <div>
                {activeTab === 'profile' ? (
                    <div style={{ maxWidth: '500px', background: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)', border: '1px solid var(--border-color)' }}>
                        <UserProfileModal user={currentUser} onClose={() => {}} onLogout={onLogout} isEmbedded={true} />
                    </div>
                ) : (
                    <SuperAdmin currentUser={currentUser} />
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
