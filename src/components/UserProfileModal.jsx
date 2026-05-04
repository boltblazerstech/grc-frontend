import React, { useState } from 'react';
import { X, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { apiClient } from '../api/apiClient';

const UserProfileModal = ({ user, onClose, onLogout }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState({ text: '', type: '' });
    const [isChanging, setIsChanging] = useState(false);
    const [showPlainPassword, setShowPlainPassword] = useState(false);
    const [copied, setCopied] = useState(false);

    if (!user) return null;

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });

        if (!currentPassword) {
            setMessage({ text: 'Please enter your current password.', type: 'error' });
            return;
        }
        if (!newPassword) {
            setMessage({ text: 'Please enter a new password.', type: 'error' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setMessage({ text: 'New passwords do not match.', type: 'error' });
            return;
        }

        setIsChanging(true);
        try {
            await apiClient.changePassword(user.id, currentPassword, newPassword);
            setMessage({ text: 'Password changed successfully.', type: 'success' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setMessage({ text: err.message || 'Failed to change password.', type: 'error' });
        } finally {
            setIsChanging(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '400px' }}>
                <div className="modal-header">
                    <h2>User Profile</h2>
                    <button className="close-btn" onClick={onClose}><X size={24} /></button>
                </div>
                
                <div className="modal-body">
                    <div style={{ marginBottom: '2rem' }}>
                        <p style={{ margin: '0.25rem 0', color: 'var(--text-light)' }}>Name:</p>
                        <h3 style={{ margin: '0 0 1rem 0' }}>{user.name}</h3>
                        
                        <p style={{ margin: '0.25rem 0', color: 'var(--text-light)' }}>Role:</p>
                        <p style={{ margin: '0 0 1rem 0', fontWeight: 'bold' }}>{user.role}</p>

                        {user.email && (
                            <>
                                <p style={{ margin: '0.25rem 0', color: 'var(--text-light)' }}>Email:</p>
                                <p style={{ margin: '0 0 1rem 0', fontWeight: 'bold' }}>{user.email}</p>
                            </>
                        )}
                        {user.mobileNo && (
                            <>
                                <p style={{ margin: '0.25rem 0', color: 'var(--text-light)' }}>Mobile No:</p>
                                <p style={{ margin: '0 0 1rem 0', fontWeight: 'bold' }}>{user.mobileNo}</p>
                            </>
                        )}

                        <p style={{ margin: '0.25rem 0', color: 'var(--text-light)' }}>Password:</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <p style={{ margin: 0, fontWeight: 'bold', fontFamily: 'monospace', fontSize: '1.1rem' }}>
                                {showPlainPassword ? user.password : '••••••••'}
                            </p>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button 
                                    className="ghost-btn" 
                                    onClick={() => setShowPlainPassword(!showPlainPassword)}
                                    title={showPlainPassword ? "Hide Password" : "Show Password"}
                                    style={{ padding: '0.2rem', color: 'var(--text-light)' }}
                                >
                                    {showPlainPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                                <button 
                                    className="ghost-btn" 
                                    onClick={() => {
                                        navigator.clipboard.writeText(user.password);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }}
                                    title="Copy Password"
                                    style={{ padding: '0.2rem', color: copied ? 'var(--success-color)' : 'var(--text-light)' }}
                                >
                                    {copied ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <hr style={{ margin: '1rem 0', borderColor: 'var(--border-color)' }} />
                    
                    <h4 style={{ marginBottom: '1rem', color: 'var(--primary-color)' }}>Change Password</h4>
                    
                    {message.text && (
                        <div style={{ 
                            padding: '0.75rem', 
                            borderRadius: '4px', 
                            marginBottom: '1rem',
                            backgroundColor: message.type === 'error' ? 'var(--new-item-bg)' : '#e8f5e9',
                            color: message.type === 'error' ? 'var(--danger-color)' : '#2e7d32',
                            border: `1px solid ${message.type === 'error' ? 'var(--danger-color)' : '#4caf50'}`
                        }}>
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handlePasswordChange}>
                        <div className="input-group">
                            <label>Current Password</label>
                            <input 
                                type="password" 
                                className="form-control" 
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                            />
                        </div>
                        <div className="input-group">
                            <label>New Password</label>
                            <input 
                                type="password" 
                                className="form-control" 
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                            />
                        </div>
                        <div className="input-group">
                            <label>Confirm New Password</label>
                            <input 
                                type="password" 
                                className="form-control" 
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                            />
                        </div>
                        
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem' }} disabled={isChanging}>
                            {isChanging ? 'Updating...' : 'Change Password'}
                        </button>
                    </form>
                    
                    <hr style={{ margin: '1rem 0', borderColor: 'var(--border-color)' }} />
                    <button 
                        onClick={onLogout} 
                        className="btn btn-secondary" 
                        style={{ width: '100%', color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                    >
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserProfileModal;
