import React, { useState } from 'react';
import SuperAdmin from './SuperAdmin';
import Gstr7Management from './Gstr7Management';
import { Users, ShieldCheck, LayoutDashboard } from 'lucide-react';

const AdminCenter = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState('users');

    const tabs = [
        { id: 'users', label: 'System & Users', icon: Users, description: 'Manage user access and maintenance' },
        { id: 'gstr7', label: 'GSTR-7 Master', icon: ShieldCheck, description: 'Manage GSTR-7 filing records' },
    ];

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
            {/* Page Header */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', borderRadius: '10px', padding: '0.5rem', display: 'flex' }}>
                        <LayoutDashboard size={24} color="white" />
                    </div>
                    <h2 style={{ color: '#1e1b4b', margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Admin Control Center</h2>
                </div>
                <p style={{ color: '#64748b', margin: 0, fontSize: '0.95rem', fontWeight: 500 }}>
                    Unified portal for system administration and compliance management
                </p>
            </div>

            {/* Tab Navigation */}
            <div style={{ 
                display: 'flex', 
                gap: '0.5rem', 
                marginBottom: '2rem', 
                background: '#f1f5f9', 
                padding: '0.4rem', 
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                width: 'fit-content',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
            }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '10px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            background: activeTab === tab.id ? 'white' : 'transparent',
                            color: activeTab === tab.id ? '#4f46e5' : '#64748b',
                            boxShadow: activeTab === tab.id ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                            fontFamily: 'inherit'
                        }}
                    >
                        <tab.icon size={18} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div style={{ 
                animation: 'fadeIn 0.3s ease-out',
                minHeight: '600px'
            }}>
                <style>{`
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
                {activeTab === 'users' ? (
                    <SuperAdmin currentUser={currentUser} isTab={true} />
                ) : (
                    <Gstr7Management isTab={true} />
                )}
            </div>
        </div>
    );
};

export default AdminCenter;
