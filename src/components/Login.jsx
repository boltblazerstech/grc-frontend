import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { Eye, EyeOff, Shield, BarChart3, CheckCircle, ArrowRight, Lock, Mail, Sparkles, TrendingUp, FileText, AlertCircle } from 'lucide-react';

const features = [
    { icon: Shield, title: 'Compliance Monitoring', desc: 'Track GST filing compliance with real-time alerts.' },
    { icon: BarChart3, title: 'Risk Scoring', desc: 'AI-powered GRC scores for every vendor GSTIN.' },
    { icon: FileText, title: 'GSTR-7 Insights', desc: 'Full audit trail of monthly filing history.' },
    { icon: TrendingUp, title: 'Smart Analytics', desc: 'Identify high-risk vendors before issues arise.' },
];

// Floating particle component
const Particle = ({ style }) => (
    <div style={{
        position: 'absolute',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)',
        animation: 'float linear infinite',
        ...style
    }} />
);

const Login = ({ onLogin }) => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [focusedField, setFocusedField] = useState(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(null);
        if (!identifier.trim()) { setError('Please enter Email or Mobile Number'); return; }
        if (!password.trim()) { setError('Please enter Password'); return; }
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

    const particles = [
        { width: 60, height: 60, top: '10%', left: '5%', animationDuration: '20s', animationDelay: '0s', opacity: 0.5 },
        { width: 40, height: 40, top: '70%', left: '10%', animationDuration: '15s', animationDelay: '3s', opacity: 0.3 },
        { width: 80, height: 80, top: '40%', left: '85%', animationDuration: '25s', animationDelay: '1s', opacity: 0.4 },
        { width: 30, height: 30, top: '80%', left: '75%', animationDuration: '18s', animationDelay: '5s', opacity: 0.6 },
        { width: 50, height: 50, top: '20%', left: '60%', animationDuration: '22s', animationDelay: '2s', opacity: 0.3 },
        { width: 20, height: 20, top: '55%', left: '30%', animationDuration: '12s', animationDelay: '4s', opacity: 0.5 },
    ];

    return (
        <>
            <style>{`
                @keyframes float {
                    0% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-30px) rotate(180deg); }
                    100% { transform: translateY(0px) rotate(360deg); }
                }
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(24px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes shimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                @keyframes pulse-ring {
                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
                    70% { transform: scale(1); box-shadow: 0 0 0 12px rgba(99, 102, 241, 0); }
                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
                }
                @keyframes slideRight {
                    from { transform: translateX(-12px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .login-input {
                    width: 100%;
                    padding: 0.85rem 1rem 0.85rem 2.8rem;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 6px;
                    font-size: 0.95rem;
                    font-family: 'Outfit', sans-serif;
                    background: #f8fafc;
                    color: #0f172a;
                    transition: all 0.25s ease;
                    outline: none;
                }
                .login-input:focus {
                    border-color: var(--primary-color);
                    background: #ffffff;
                    box-shadow: 0 0 0 2px rgba(0, 191, 255, 0.2);
                }
                .login-input::placeholder { color: #94a3b8; }
                .login-btn {
                    width: 100%;
                    padding: 0.9rem;
                    border: none;
                    border-radius: 6px;
                    font-size: 1rem;
                    font-weight: 700;
                    font-family: 'Outfit', sans-serif;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    background: var(--primary-color);
                    color: white;
                    transition: all 0.2s ease;
                    position: relative;
                    overflow: hidden;
                }
                .login-btn:hover:not(:disabled) {
                    background: var(--primary-hover);
                }
                .login-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                    transform: none;
                }
                .feature-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.85rem;
                    padding: 0.85rem;
                    border-radius: 12px;
                    background: rgba(255,255,255,0.07);
                    border: 1px solid rgba(255,255,255,0.1);
                    backdrop-filter: blur(4px);
                    transition: all 0.25s ease;
                }
                .feature-item:hover {
                    background: rgba(255,255,255,0.12);
                    transform: translateX(4px);
                }
            `}</style>

            <div style={{
                display: 'flex',
                minHeight: '100vh',
                fontFamily: "'Outfit', sans-serif",
                opacity: mounted ? 1 : 0,
                transition: 'opacity 0.4s ease',
            }}>
                {/* ── LEFT PANEL ── */}
                <div style={{
                    flex: '0 0 48%',
                    background: 'var(--primary-color)',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '3rem 3.5rem',
                }}>
                    {/* Background Particles */}
                    {particles.map((p, i) => (
                        <Particle key={i} style={{
                            width: p.width, height: p.height,
                            top: p.top, left: p.left,
                            animationDuration: p.animationDuration,
                            animationDelay: p.animationDelay,
                            opacity: p.opacity,
                        }} />
                    ))}

                    {/* Grid overlay */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
                        backgroundSize: '40px 40px',
                    }} />



                    <div style={{ position: 'relative', zIndex: 1 }}>
                        {/* Logo / Brand */}
                        <div style={{ marginBottom: '2.5rem', animation: 'fadeSlideIn 0.6s ease forwards' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}>
                                <div style={{
                                    width: '44px', height: '44px', borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Shield size={22} color="white" />
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>GRC Manager</div>
                                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Score & Compliance</div>
                                </div>
                            </div>
                        </div>

                        {/* Headline */}
                        <div style={{ marginBottom: '2.5rem', animation: 'fadeSlideIn 0.6s ease 0.1s both' }}>
                            <h1 style={{
                                fontSize: '2.4rem', fontWeight: 900, color: 'white',
                                lineHeight: 1.2, marginBottom: '1rem',
                            }}>
                                Vendor Compliance<br />Made Intelligent.
                            </h1>
                            <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.7, maxWidth: '380px', fontWeight: 400 }}>
                                Monitor your entire vendor portfolio's GST compliance, risk scores, and filing history — all from one unified dashboard.
                            </p>
                        </div>

                        {/* Feature list */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', animation: 'fadeSlideIn 0.6s ease 0.2s both' }}>
                            {features.map((f, i) => (
                                <div key={i} className="feature-item" style={{ animationDelay: `${0.25 + i * 0.08}s` }}>
                                    <div style={{
                                        width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
                                        background: 'rgba(255,255,255,0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: '1px solid rgba(255,255,255,0.3)',
                                    }}>
                                        <f.icon size={16} color="white" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'white', marginBottom: '0.1rem' }}>{f.title}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>{f.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Stats strip */}
                        <div style={{
                            display: 'flex', gap: '1.5rem', marginTop: '2rem',
                            animation: 'fadeSlideIn 0.6s ease 0.55s both',
                        }}>
                            {[['500+', 'Vendors Tracked'], ['98%', 'Accuracy Rate'], ['<1s', 'Score Refresh']].map(([num, label], i) => (
                                <div key={i} style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white' }}>{num}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── RIGHT PANEL ── */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    background: 'var(--bg-color)',
                    padding: '2rem',
                    position: 'relative',
                    overflow: 'hidden',
                }}>


                    <div style={{
                        width: '100%', maxWidth: '420px',
                        animation: 'fadeSlideIn 0.7s ease 0.15s both',
                        position: 'relative', zIndex: 1,
                    }}>
                        {/* Header */}
                        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                background: 'rgba(0, 191, 255, 0.1)',
                                border: '1px solid var(--primary-color)',
                                borderRadius: '6px', padding: '0.3rem 0.85rem',
                                marginBottom: '1rem',
                            }}>
                                <Sparkles size={12} color="var(--primary-color)" />
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary-color)', letterSpacing: '0.5px' }}>SECURE ACCESS</span>
                            </div>
                            <h2 style={{
                                fontSize: '2rem', fontWeight: 900, color: '#0f172a',
                                marginBottom: '0.4rem', letterSpacing: '-0.5px',
                            }}>
                                Welcome back 👋
                            </h2>
                            <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 400 }}>
                                Sign in to your GRC Manager account
                            </p>
                        </div>

                        {/* Form Card */}
                        <div style={{
                            background: 'white',
                            borderRadius: '8px',
                            padding: '2rem',
                            boxShadow: 'var(--box-shadow)',
                            border: '1px solid var(--border-color)',
                        }}>
                            {/* Error Message */}
                            {error && (
                                <div style={{
                                    display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                                    background: '#fef2f2', border: '1px solid #fca5a5',
                                    borderRadius: '10px', padding: '0.75rem 1rem',
                                    marginBottom: '1.25rem',
                                    animation: 'slideRight 0.3s ease',
                                }}>
                                    <AlertCircle size={16} color="#ef4444" style={{ marginTop: '1px', flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.85rem', color: '#991b1b', fontWeight: 500 }}>{error}</span>
                                </div>
                            )}

                            <form onSubmit={handleLogin}>
                                {/* Email field */}
                                <div style={{ marginBottom: '1.1rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem', letterSpacing: '0.2px' }}>
                                        Email or Mobile Number
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', transition: 'color 0.2s' }}>
                                            <Mail size={16} color={focusedField === 'id' ? 'var(--primary-color)' : '#94a3b8'} />
                                        </div>
                                        <input
                                            type="text"
                                            className="login-input"
                                            value={identifier}
                                            onChange={(e) => setIdentifier(e.target.value)}
                                            onFocus={() => setFocusedField('id')}
                                            onBlur={() => setFocusedField(null)}
                                            disabled={isLoading}
                                            placeholder="user@example.com or 9999999999"
                                            autoComplete="username"
                                        />
                                    </div>
                                </div>

                                {/* Password field */}
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem', letterSpacing: '0.2px' }}>
                                        Password
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                                            <Lock size={16} color={focusedField === 'pw' ? 'var(--primary-color)' : '#94a3b8'} />
                                        </div>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            className="login-input"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onFocus={() => setFocusedField('pw')}
                                            onBlur={() => setFocusedField(null)}
                                            disabled={isLoading}
                                            placeholder="Enter your password"
                                            autoComplete="current-password"
                                            style={{ paddingRight: '2.8rem' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            style={{
                                                position: 'absolute', right: '0.85rem', top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                padding: '0.2rem', display: 'flex', alignItems: 'center',
                                                color: '#94a3b8', transition: 'color 0.2s',
                                            }}
                                            onMouseOver={e => e.currentTarget.style.color = '#6366f1'}
                                            onMouseOut={e => e.currentTarget.style.color = '#94a3b8'}
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button type="submit" className="login-btn" disabled={isLoading}>
                                    {isLoading ? (
                                        <>
                                            <div style={{
                                                width: '18px', height: '18px', borderRadius: '50%',
                                                border: '2px solid rgba(255,255,255,0.3)',
                                                borderTopColor: 'white',
                                                animation: 'spin 0.8s linear infinite',
                                            }} />
                                            Signing in...
                                        </>
                                    ) : (
                                        <>Sign In <ArrowRight size={17} /></>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Footer */}
                        <div style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <CheckCircle size={14} color="#10b981" />
                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                                256-bit SSL encrypted. Your data is secure.
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Login;
