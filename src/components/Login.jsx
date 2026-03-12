import React, { useState } from 'react';
import { apiClient } from '../api/apiClient';

const Login = ({ onLogin }) => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(null);
        
        if (!identifier.trim()) {
            setError('Please enter Email or Mobile Number');
            return;
        }
        if (!password.trim()) {
            setError('Please enter Password');
            return;
        }

        setIsLoading(true);
        try {
            const user = await apiClient.loginUser(identifier.trim(), password);
            onLogin(user);
        } catch (err) {
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--primary-color)' }}>Login to GRC Manager</h2>
                
                {error && (
                    <div style={{ backgroundColor: 'var(--new-item-bg)', color: 'var(--danger-color)', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', border: '1px solid var(--danger-color)' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <label>Email or Mobile Number</label>
                        <input
                            type="text"
                            className="form-control"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            disabled={isLoading}
                            placeholder="user@example.com or 9999999999"
                        />
                    </div>
                    
                    <div className="input-group">
                        <label>Password</label>
                        <input
                            type="password"
                            className="form-control"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        className="btn btn-primary" 
                        style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}
                        disabled={isLoading}
                    >
                        {isLoading ? <div className="spinner"></div> : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
