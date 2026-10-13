import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Building2, Calendar, ShieldCheck, Copy, Check, Printer, 
    AlertCircle, CheckCircle, AlertTriangle, Clock, ArrowLeft,
    Share2, ExternalLink, FileText, IndianRupee
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import Gstr7Timeline from './Gstr7Timeline';

const calculateAge = (dateString) => {
    if (!dateString) return 'N/A';
    const birthDate = new Date(dateString);
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) { years--; months += 12; }
    if (today.getDate() < birthDate.getDate()) { months--; if (months < 0) months = 11; }
    if (months >= 6) years++;
    if (years <= 0) return 'New';
    return `${years} yr${years > 1 ? 's' : ''}`;
};

const getScoreInfo = (score, thresholds) => {
    if (score === null || score === undefined) {
        return { color: '#6b7280', bg: '#f3f4f6', label: 'Score Pending', risk: null, level: 'Pending' };
    }
    const red = thresholds?.COLOR_RED_THRESHOLD ?? 30;
    const yellow = thresholds?.COLOR_YELLOW_THRESHOLD ?? 20;
    if (score > red) {
        return { color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', label: 'High Risk', subLabel: 'Needs Immediate Attention', level: 'High' };
    }
    if (score >= yellow) {
        return { color: '#d97706', bg: '#fef3c7', border: '#fcd34d', label: 'Moderate Risk', subLabel: 'Monitor Closely', level: 'Moderate' };
    }
    return { color: '#16a34a', bg: '#dcfce7', border: '#86efac', label: 'Low Risk', subLabel: 'Good Compliance Record', level: 'Low' };
};

const DelayCard = ({ title, count }) => {
    const isZero = !count || count === 0;
    const isOne = count === 1;
    const color = isZero ? '#16a34a' : isOne ? '#d97706' : '#dc2626';
    const bg = isZero ? '#f0fdf4' : isOne ? '#fffbeb' : '#fef2f2';
    const border = isZero ? '#bbf7d0' : isOne ? '#fde68a' : '#fecaca';
    const Icon = isZero ? CheckCircle : isOne ? AlertTriangle : AlertCircle;

    return (
        <div style={{
            background: bg,
            border: `1px solid ${border}`,
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
        }}>
            <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {title}
                </span>
                <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Icon size={18} color={color} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color }}>
                        {isZero ? 'Filed on Time' : `${count} Return${count > 1 ? 's' : ''} Delayed`}
                    </span>
                </div>
            </div>
            <div style={{
                minWidth: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'white',
                border: `1px solid ${color}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                fontWeight: 800,
                color
            }}>
                {count ?? 0}
            </div>
        </div>
    );
};

const VendorReportView = () => {
    const { gstin } = useParams();
    const navigate = useNavigate();

    const [vendor, setVendor] = useState(null);
    const [thresholds, setThresholds] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [copiedGstin, setCopiedGstin] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    useEffect(() => {
        const fetchVendorReport = async () => {
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
                console.error("Failed to fetch vendor report:", err);
                setError(err.message || 'Vendor not found or could not be loaded');
            } finally {
                setLoading(false);
            }
        };

        fetchVendorReport();
    }, [gstin]);

    const handleCopyGstin = () => {
        if (!vendor?.gstin) return;
        navigator.clipboard.writeText(vendor.gstin);
        setCopiedGstin(true);
        setTimeout(() => setCopiedGstin(false), 2000);
    };

    const handleCopyLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                color: 'var(--text-light)'
            }}>
                <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>Loading Vendor Assessment Report...</div>
            </div>
        );
    }

    if (error || !vendor) {
        return (
            <div style={{ maxWidth: '600px', margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
                <div style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '16px',
                    padding: '2.5rem 1.5rem',
                    color: '#991b1b'
                }}>
                    <AlertCircle size={48} color="#dc2626" style={{ margin: '0 auto 1rem' }} />
                    <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Vendor Report Not Found</h3>
                    <p style={{ margin: '0 0 1.5rem', color: '#7f1d1d', fontSize: '0.9rem' }}>
                        {error || `Unable to locate compliance records for GSTIN: ${gstin}`}
                    </p>
                    <button 
                        className="btn btn-secondary" 
                        onClick={() => navigate('/')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <ArrowLeft size={16} /> Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const scoreInfo = getScoreInfo(vendor.grcScore, thresholds);
    const registrationAge = calculateAge(vendor.registrationDate);

    return (
        <div className="vendor-report-container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>
            {/* Top Navigation & Action Bar */}
            <div className="no-print" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.5rem',
                paddingBottom: '1rem',
                borderBottom: '1px solid var(--border-color)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button 
                        onClick={() => navigate('/')}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
                        title="Back to Home"
                    >
                        <ArrowLeft size={16} /> Dashboard
                    </button>
                    <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            ScrapDMS · Vendor Assessment
                        </span>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-dark)' }}>Vendor Compliance Report</h2>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                        onClick={handleCopyLink}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
                        title="Copy direct shareable link"
                    >
                        {copiedLink ? <Check size={15} color="#16a34a" /> : <Share2 size={15} />}
                        {copiedLink ? 'Link Copied!' : 'Copy Link'}
                    </button>
                    <button
                        onClick={handlePrint}
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
                    >
                        <Printer size={15} /> Print / Save PDF
                    </button>
                </div>
            </div>

            {/* Print Header only visible on paper/PDF */}
            <div className="print-only" style={{ display: 'none', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #2563eb', paddingBottom: '0.75rem' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1e3a8a' }}>GRC Vendor Assessment Report</h1>
                        <span style={{ fontSize: '0.85rem', color: '#4b5563' }}>Integrated Compliance Verification for ScrapDMS</span>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#6b7280' }}>
                        <div>Report Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        <div>GSTIN: {vendor.gstin}</div>
                    </div>
                </div>
            </div>

            {/* Main Vendor Header Card */}
            <div className="card" style={{ padding: '1.75rem', marginBottom: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
                    
                    {/* Left: Vendor Identity */}
                    <div style={{ flex: '1 1 500px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                            <span style={{
                                padding: '0.25rem 0.65rem',
                                borderRadius: '20px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: vendor.gstStatus === 'Active' ? 'rgba(22, 163, 74, 0.12)' : 'rgba(220, 38, 38, 0.12)',
                                color: vendor.gstStatus === 'Active' ? '#16a34a' : '#dc2626',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                            }}>
                                {vendor.gstStatus === 'Active' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                                {vendor.gstStatus || 'Status Unknown'}
                            </span>

                            {vendor.aadhaarValidation && (
                                <span style={{
                                    padding: '0.25rem 0.65rem',
                                    borderRadius: '20px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    background: '#eff6ff',
                                    color: '#2563eb',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem'
                                }}>
                                    <ShieldCheck size={13} /> Aadhaar: {vendor.aadhaarValidation}
                                </span>
                            )}

                            {vendor.gstType && (
                                <span style={{
                                    padding: '0.25rem 0.65rem',
                                    borderRadius: '20px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    background: '#f3f4f6',
                                    color: '#4b5563'
                                }}>
                                    {vendor.gstType}
                                </span>
                            )}
                        </div>

                        <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-dark)', lineHeight: 1.3 }}>
                            {vendor.tradeName || vendor.legalName || 'Vendor Name Not Available'}
                        </h1>
                        {vendor.legalName && vendor.tradeName && vendor.legalName !== vendor.tradeName && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '0.75rem' }}>
                                Legal Name: <strong style={{ color: 'var(--text-dark)' }}>{vendor.legalName}</strong>
                            </div>
                        )}

                        {/* GSTIN & PAN tags */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                padding: '0.35rem 0.75rem',
                                borderRadius: '8px'
                            }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>GSTIN:</span>
                                <code style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e293b' }}>{vendor.gstin}</code>
                                <button
                                    onClick={handleCopyGstin}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#64748b' }}
                                    title="Copy GSTIN"
                                >
                                    {copiedGstin ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                                </button>
                            </div>

                            {vendor.panNumber && (
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '8px'
                                }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>PAN:</span>
                                    <code style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e293b' }}>{vendor.panNumber}</code>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: GRC Score Box */}
                    <div style={{
                        flex: '0 0 240px',
                        background: scoreInfo.bg,
                        border: `1.5px solid ${scoreInfo.border || scoreInfo.color}30`,
                        borderRadius: '14px',
                        padding: '1.25rem',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: scoreInfo.color }}>
                            GRC Compliance Score
                        </span>
                        <div style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1.1, margin: '0.4rem 0', color: scoreInfo.color }}>
                            {vendor.grcScore !== null && vendor.grcScore !== undefined ? vendor.grcScore : '—'}
                        </div>
                        <span style={{
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            padding: '0.2rem 0.8rem',
                            borderRadius: '12px',
                            background: 'white',
                            color: scoreInfo.color,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                        }}>
                            {scoreInfo.label}
                        </span>
                        {scoreInfo.subLabel && (
                            <span style={{ fontSize: '0.7rem', color: scoreInfo.color, marginTop: '0.35rem', fontWeight: 600 }}>
                                {scoreInfo.subLabel}
                            </span>
                        )}
                    </div>
                </div>

                {/* Vendor Metadata Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginTop: '1.5rem',
                    paddingTop: '1.5rem',
                    borderTop: '1px solid var(--border-color)'
                }}>
                    <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-light)', marginBottom: '0.2rem' }}>
                            Registration Date
                        </div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Calendar size={15} color="var(--primary-color)" />
                            {vendor.registrationDate || 'N/A'} ({registrationAge})
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-light)', marginBottom: '0.2rem' }}>
                            Aggregate Annual Turnover
                        </div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <IndianRupee size={15} color="var(--primary-color)" />
                            {vendor.aggregateTurnover || 'Not Disclosed'}
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-light)', marginBottom: '0.2rem' }}>
                            Principal Business Activity
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                            {vendor.coreActivity || 'General Operations'}
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-light)', marginBottom: '0.2rem' }}>
                            Last Compliance Sync
                        </div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                            {vendor.lastApiSync ? new Date(vendor.lastApiSync).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Synchronized'}
                        </div>
                    </div>
                </div>

                {vendor.address && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-color)', fontSize: '0.82rem', color: 'var(--text-light)' }}>
                        <strong>Registered Address:</strong> {vendor.address}
                    </div>
                )}
            </div>

            {/* Filing Track Record & Delays */}
            <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-dark)', margin: '0 0 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={18} color="var(--primary-color)" /> GST Filing Track Record (Last 12 Months)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <DelayCard title="GSTR-1 Outward Supplies" count={vendor.delayCountGstr1} />
                    <DelayCard title="GSTR-3B Monthly Return" count={vendor.delayCountGstr3b} />
                </div>
            </div>

            {/* GSTR-7 TDS Compliance (if applicable) */}
            {vendor.tdsApplicable && (
                <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', borderRadius: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                            GSTR-7 TDS Compliance Status
                        </h4>
                        <span style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.6rem',
                            borderRadius: '12px',
                            background: vendor.gstr7Status === 'Regular without delay' ? '#dcfce7' : '#fee2e2',
                            color: vendor.gstr7Status === 'Regular without delay' ? '#16a34a' : '#dc2626'
                        }}>
                            {vendor.gstr7Status || 'Pending'}
                        </span>
                    </div>

                    <Gstr7Timeline gstin={vendor.gstin} tdsApplicable={vendor.tdsApplicable} />
                </div>
            )}

            {/* Assessment Summary / Disclaimer */}
            <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1.25rem',
                fontSize: '0.78rem',
                color: '#64748b',
                lineHeight: 1.6
            }}>
                <div style={{ fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    Assessment Notice & Verification Integrity:
                </div>
                This Vendor Assessment Report has been dynamically compiled through the GRC Compliance Engine for ScrapDMS integration.
                Filing metrics, score parameters, and compliance indicators are derived from authorized GST records.
                Direct link: <a href={window.location.href} style={{ color: '#2563eb', wordBreak: 'break-all' }}>{window.location.href}</a>
            </div>
        </div>
    );
};

export default VendorReportView;
