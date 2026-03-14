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
        password: '',
        role: 'USER'
    });

    const [editingUserId, setEditingUserId] = useState(null);
    const [editUserData, setEditUserData] = useState({});

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
            setNewUserDef({ name: '', mobileNo: '', email: '', password: '', role: 'USER' });
            loadUsers();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleEditStart = (user) => {
        setEditingUserId(user.id);
        setEditUserData({ ...user });
    };

    const handleEditCancel = () => {
        setEditingUserId(null);
        setEditUserData({});
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg('');
        try {
            await apiClient.updateUser(editingUserId, editUserData, currentUser.role);
            setSuccessMsg(`User ${editUserData.name} updated successfully!`);
            setEditingUserId(null);
            loadUsers();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeleteUser = async (userId, userName) => {
        if (userId === currentUser.id) {
            setError("You cannot delete yourself.");
            return;
        }

        if (window.confirm(`Are you sure you want to delete user: ${userName}?`)) {
            setError(null);
            setSuccessMsg('');
            try {
                await apiClient.deleteUser(userId, currentUser.role);
                setSuccessMsg(`User ${userName} deleted successfully.`);
                loadUsers();
            } catch (err) {
                setError(err.message);
            }
        }
    };

    const handleToggleStatus = async (user) => {
        if (user.id === currentUser.id) {
            setError("You cannot deactivate yourself.");
            return;
        }
        
        setError(null);
        setSuccessMsg('');
        try {
            await apiClient.updateUser(user.id, { active: !user.active }, currentUser.role);
            setSuccessMsg(`User ${user.name} is now ${!user.active ? 'Active' : 'Inactive'}.`);
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
                        <div className="input-group">
                            <label>Role</label>
                            <select
                                className="form-control"
                                value={newUserDef.role}
                                onChange={e => setNewUserDef({ ...newUserDef, role: e.target.value })}
                            >
                                <option value="USER">USER</option>
                                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                            </select>
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
                                    <th style={{ width: '50px' }}>#</th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Mobile No</th>
                                    <th>Password</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user, index) => (
                                    <tr key={user.id}>
                                        <td style={{ color: 'var(--text-light)', fontWeight: 500 }}>{index + 1}</td>
                                        {editingUserId === user.id ? (
                                            <>
                                                <td>
                                                    <input
                                                        type="text"
                                                        className="form-control"
                                                        value={editUserData.name}
                                                        onChange={e => setEditUserData({ ...editUserData, name: e.target.value })}
                                                        style={{ padding: '0.2rem' }}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="email"
                                                        className="form-control"
                                                        value={editUserData.email}
                                                        onChange={e => setEditUserData({ ...editUserData, email: e.target.value })}
                                                        style={{ padding: '0.2rem' }}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        className="form-control"
                                                        maxLength={10}
                                                        value={editUserData.mobileNo}
                                                        onChange={e => setEditUserData({ ...editUserData, mobileNo: e.target.value })}
                                                        style={{ padding: '0.2rem' }}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        className="form-control"
                                                        value={editUserData.password}
                                                        onChange={e => setEditUserData({ ...editUserData, password: e.target.value })}
                                                        style={{ padding: '0.2rem' }}
                                                    />
                                                </td>
                                                <td>
                                                    <select
                                                        className="form-control"
                                                        value={editUserData.role}
                                                        onChange={e => setEditUserData({ ...editUserData, role: e.target.value })}
                                                        style={{ padding: '0.2rem' }}
                                                    >
                                                        <option value="USER">USER</option>
                                                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                                                    </select>
                                                </td>
                                                <td>
                                                    <select
                                                        className="form-control"
                                                        value={editUserData.role === 'SUPER_ADMIN' ? 'true' : editUserData.active}
                                                        onChange={e => setEditUserData({ ...editUserData, active: e.target.value === 'true' })}
                                                        style={{ padding: '0.2rem' }}
                                                        disabled={editUserData.role === 'SUPER_ADMIN'}
                                                    >
                                                        <option value="true">Active</option>
                                                        <option value="false">Inactive</option>
                                                    </select>
                                                    {editUserData.role === 'SUPER_ADMIN' && <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginTop: '2px' }}>Required for Admins</div>}
                                                </td>
                                                <td style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button className="btn btn-primary" onClick={handleUpdateUser} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>Save</button>
                                                    <button className="btn btn-secondary" onClick={handleEditCancel} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>Cancel</button>
                                                </td >
                                            </>
                                        ) : (
                                            <>
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
                                                <td>
                                                    <span style={{
                                                        backgroundColor: user.active ? 'var(--success-color)' : 'var(--danger-color)',
                                                        color: 'white',
                                                        padding: '0.2rem 0.5rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.8rem'
                                                    }}>
                                                        {user.active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button className="btn btn-secondary" onClick={() => handleEditStart(user)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>Edit</button>
                                                    {user.id !== currentUser.id && (
                                                        <>
                                                            {user.role !== 'SUPER_ADMIN' && (
                                                                <button 
                                                                    className="btn btn-secondary" 
                                                                    onClick={() => handleToggleStatus(user)} 
                                                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: user.active ? 'var(--danger-color)' : 'var(--success-color)' }}
                                                                >
                                                                    {user.active ? 'Deactivate' : 'Activate'}
                                                                </button>
                                                            )}
                                                            <button className="btn btn-sm" onClick={() => handleDeleteUser(user.id, user.name)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: 'var(--danger-color)', border: '1px solid var(--danger-color)', backgroundColor: 'transparent' }}>Delete</button>
                                                        </>
                                                    )}
                                                </td>
                                            </>
                                        )}
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
