import React, { useState } from 'react';
import { apiClient } from '../api/apiClient';
import { Eye, EyeOff } from 'lucide-react';

const Login = ({ onLogin }) => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

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
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? "text" : "password"}
                                className="form-control"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                                style={{ paddingRight: '2.5rem' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-light)',
                                    cursor: 'pointer',
                                    padding: '0.2rem',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
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
