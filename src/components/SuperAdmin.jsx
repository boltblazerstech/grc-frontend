import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';

const SuperAdmin = ({ currentUser }) => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');

    const [newUserDef, setNewUserDef] = useState({
        name: '',
        mobileNo: '',
        email: '',
        password: ''
    });

    const loadUsers = async () => {
        setIsLoading(true);
        try {
            const data = await apiClient.getUsers();
            setUsers(data);
        } catch (err) {
            setError('Failed to fetch users: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg('');

        if (!newUserDef.name.trim()) {
            setError("Name is required.");
            return;
        }
        if (!newUserDef.email.trim() && !newUserDef.mobileNo.trim()) {
            setError("At least Email or Mobile Number must be provided.");
            return;
        }
        if (!newUserDef.password.trim()) {
            setError("Password is required.");
            return;
        }

        try {
            await apiClient.createUser(newUserDef, currentUser.role);
            setSuccessMsg(`User ${newUserDef.name} created successfully!`);
            setNewUserDef({ name: '', mobileNo: '', email: '', password: '' });
            loadUsers();
        } catch (err) {
            setError(err.message);
        }
    };

    if (currentUser?.role !== 'SUPER_ADMIN') {
        return (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
                <h2 style={{ color: 'var(--danger-color)' }}>Access Denied</h2>
                <p>You do not have permission to view this page.</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)' }}>Super Admin Panel</h2>

            {error && <div style={{ color: 'white', backgroundColor: 'var(--danger-color)', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>{error}</div>}
            {successMsg && <div style={{ color: 'white', backgroundColor: 'var(--success-color)', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>{successMsg}</div>}

            <div className="card" style={{ marginBottom: '2rem' }}>
                <h3>Add New User</h3>
                <hr style={{ margin: '1rem 0', borderColor: 'var(--border-color)' }} />
                <form onSubmit={handleCreateUser}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="input-group">
                            <label>Name *</label>
                            <input
                                type="text"
                                className="form-control"
                                value={newUserDef.name}
                                onChange={e => setNewUserDef({ ...newUserDef, name: e.target.value })}
                            />
                        </div>
                        <div className="input-group">
                            <label>Password *</label>
                            <input
                                type="text"
                                className="form-control"
                                value={newUserDef.password}
                                onChange={e => setNewUserDef({ ...newUserDef, password: e.target.value })}
                            />
                        </div>
                        <div className="input-group">
                            <label>Email (Optional if Mobile provided)</label>
                            <input
                                type="email"
                                className="form-control"
                                value={newUserDef.email}
                                onChange={e => setNewUserDef({ ...newUserDef, email: e.target.value })}
                            />
                        </div>
                        <div className="input-group">
                            <label>Mobile No. (Optional if Email provided)</label>
                            <input
                                type="text"
                                className="form-control"
                                maxLength={10}
                                value={newUserDef.mobileNo}
                                onChange={e => setNewUserDef({ ...newUserDef, mobileNo: e.target.value })}
                            />
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Create User</button>
                </form>
            </div>

            <div className="card">
                <h3>System Users</h3>
                <hr style={{ margin: '1rem 0', borderColor: 'var(--border-color)' }} />
                
                {isLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                        <div className="spinner"></div>
                    </div>
                ) : (
                    <div className="gst-table-wrapper" style={{ overflowX: 'auto' }}>
                        <table className="gst-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Mobile No</th>
                                    <th>Password</th>
                                    <th>Role</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user.id}>
                                        <td>{user.name}</td>
                                        <td>{user.email || 'N/A'}</td>
                                        <td>{user.mobileNo || 'N/A'}</td>
                                        <td style={{ fontFamily: 'monospace' }}>{user.password}</td>
                                        <td>
                                            <span style={{ 
                                                backgroundColor: user.role === 'SUPER_ADMIN' ? 'var(--warning-color)' : 'var(--success-color)', 
                                                color: 'white', 
                                                padding: '0.2rem 0.5rem', 
                                                borderRadius: '4px',
                                                fontSize: '0.8rem' 
                                            }}>
                                                {user.role}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SuperAdmin;
