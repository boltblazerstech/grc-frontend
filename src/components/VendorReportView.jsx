import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, Copy, Check, AlertCircle } from 'lucide-react';
import { apiClient } from '../api/apiClient';
import GstCard from './GstCard';
import GstDetailsModal from './GstDetailsModal';

const VendorReportView = () => {
    const { gstin } = useParams();

    const [vendor, setVendor] = useState(null);
    const [thresholds, setThresholds] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [copiedLink, setCopiedLink] = useState(false);
    const [selectedGst, setSelectedGst] = useState(null);

    useEffect(() => {
        const fetchVendor = async () => {
            if (!gstin) {
                setError('No GSTIN specified');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const cleanGstin = gstin.trim().toUpperCase();
                const [data, config] = await Promise.all([
                    apiClient.getDetailByGstin(cleanGstin),
                    apiClient.getRuleConfig().catch(() => [])
                ]);

                setVendor(data);

                const configMap = {};
                (config || []).forEach(item => {
                    configMap[item.configKey] = item.configValue;
                });
                setThresholds(configMap);
            } catch (err) {
                console.error("Failed to fetch vendor:", err);
                setError(err.message || 'Vendor not found or could not be loaded');
            } finally {
                setLoading(false);
            }
        };

        fetchVendor();
    }, [gstin]);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                background: '#f8fafc',
                color: 'var(--text-light)'
            }}>
                <div className="spinner" style={{ width: '36px', height: '36px' }}></div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Loading Vendor Details...</div>
            </div>
        );
    }

    if (error || !vendor) {
        return (
            <div style={{
                minHeight: '100vh',
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem'
            }}>
                <div style={{
                    maxWidth: '480px',
                    width: '100%',
                    background: 'white',
                    border: '1px solid #fee2e2',
                    borderRadius: '16px',
                    padding: '2.5rem 1.5rem',
                    textAlign: 'center',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
                }}>
                    <AlertCircle size={44} color="#dc2626" style={{ margin: '0 auto 1rem' }} />
                    <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', color: '#111827' }}>Vendor Not Found</h3>
                    <p style={{ margin: 0, color: '#6b7280', fontSize: '0.88rem' }}>
                        {error || `Unable to locate compliance records for GSTIN: ${gstin}`}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: '3rem' }}>
            {/* Minimal Header — GRC Logo + Share button only, NO navigation away */}
            <header style={{
                position: 'sticky',
                top: 0,
                zIndex: 50,
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
                padding: '0.75rem 2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', userSelect: 'none' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '9px',
                        background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(124,58,237,0.35)',
                    }}>
                        <Shield size={17} color="white" />
                    </div>
                    <div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e1b4b', lineHeight: 1, letterSpacing: '-0.3px' }}>
                            GRC Manager
                        </div>
                        <div style={{ fontSize: '0.58rem', color: '#7c3aed', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                            Score & Compliance
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleCopyLink}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        border: '1px solid #e2e8f0',
                        background: 'white',
                        color: '#475569',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                    title="Copy unique link for this vendor"
                >
                    {copiedLink ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                    {copiedLink ? 'Link Copied' : 'Copy Link'}
                </button>
            </header>

            {/* Centered Exact Same Card */}
            <main style={{ maxWidth: '980px', margin: '2rem auto 0', padding: '0 1rem' }}>
                <GstCard 
                    gst={vendor} 
                    thresholds={thresholds} 
                    onClick={() => setSelectedGst(vendor)} 
                    isStandalone={true}
                />
            </main>

            {/* Read-Only Details Modal if user clicks "View Details" */}
            {selectedGst && (
                <GstDetailsModal
                    gst={selectedGst}
                    onClose={() => setSelectedGst(null)}
                    thresholds={thresholds}
                    currentUser={null}
                    isReadOnly={true}
                />
            )}
        </div>
    );
};

export default VendorReportView;
