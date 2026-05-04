import React, { useState } from 'react';
import { Eye, Copy, Check, AlertCircle, History } from 'lucide-react';
import Gstr7Timeline from './Gstr7Timeline';

const calculateAge = (dateString) => {
    if (!dateString) return 'N/A';
    const birthDate = new Date(dateString);
    const today = new Date();
    
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    
    if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
        years--;
        months += 12;
    }
    
    if (today.getDate() < birthDate.getDate()) {
        months--;
        if (months < 0) {
            months = 11;
        }
    }

    if (months >= 6) {
        years++;
    }
    
    if (years <= 0) return 'New';
    return `${years} yr${years > 1 ? 's' : ''}`;
};

const getScoreColor = (score, thresholds) => {
    if (score === null || score === undefined) return '';
    const red = thresholds?.COLOR_RED_THRESHOLD ?? 30;
    const yellow = thresholds?.COLOR_YELLOW_THRESHOLD ?? 20;
    
    if (score > red) return 'score-red';
    if (score >= yellow) return 'score-yellow';
    return 'score-green';
};

const formatGstType = (type) => {
    if (!type) return 'N/A';
    return type.trim().split(/\s+/)[0];
};

const formatTurnover = (turnover) => {
    if (!turnover || turnover === "0" || turnover === 0) return 'N/A';
    return turnover;
};

const formatPeriod = (period) => {
    if (!period) return period;
    const parts = period.split("-");
    if (parts.length === 2) {
        const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
        const monthName = date.toLocaleString('default', { month: 'long' });
        const yearStr = parts[0].substring(2);
        return `${monthName} ${yearStr}`;
    }
    return period;
};

const Gstr7Badge = ({ status }) => {
    let bg = '#f3f4f6';
    let color = '#374151';
    let text = status || 'N/A';

    if (status === 'Regular without delay') {
        bg = '#d1fae5'; color = '#047857'; text = 'Regular';
    } else if (status === 'Regular with Delay') {
        bg = '#fef3c7'; color = '#b45309'; text = 'Regular with delay';
    } else if (status === 'Missed') {
        bg = '#fee2e2'; color = '#b91c1c'; text = 'Missed';
    }

    return (
        <span style={{ background: bg, color: color, padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
            {text}
        </span>
    );
};

const GstCard = ({ gst, onClick, isNew, isFirstFetch, index, thresholds }) => {
    const [copied, setCopied] = useState(false);
    const [showTimeline, setShowTimeline] = useState(false);

    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(gst.gstin);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const dataSourceBadge = (ds) => {
        if (!ds) return null;
        const styles = {
            API:     { background: '#e0e7ff', color: '#3730a3', border: 'none' },
            Manual:  { background: '#fef3c7', color: '#92400e', border: 'none' },
            Error:   { background: '#fee2e2', color: '#991b1b', border: 'none' },
            Pending: { background: '#f3f4f6', color: '#6b7280', border: 'none' },
        };
        const s = styles[ds] || styles.Pending;
        return (
            <span style={{ ...s, fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase' }}>
                {ds}
            </span>
        );
    };

    return (
        <div
            className={`card gst-card ${isFirstFetch ? 'first-fetch-item' : isNew ? 'new-item' : ''}`}
            style={{
                position: 'relative',
                padding: '1.25rem',
                transition: 'transform 0.2s, box-shadow 0.2s',
                border: gst.apiError ? '1px solid #fca5a5' : '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                backgroundColor: 'white'
            }}
        >
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, paddingRight: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--text-dark)', fontSize: '0.9rem', fontWeight: 700 }}>#{index}</span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary-color)' }}>{gst.gstin}</span>
                        <button
                            className="ghost-btn"
                            onClick={handleCopy}
                            title="Copy GSTIN"
                            style={{ padding: '0.2rem', color: 'var(--text-light)', display: 'inline-flex', border: '1px solid var(--border-color)', borderRadius: '4px', background: '#f9fafb' }}
                        >
                            {copied ? <Check size={14} color="var(--success-color)" /> : <Copy size={14} />}
                        </button>
                        <button
                            className="ghost-btn"
                            onClick={(e) => { e.stopPropagation(); onClick(gst); }}
                            title="View Details"
                            style={{ padding: '0.2rem', color: 'var(--primary-color)', display: 'inline-flex', border: '1px solid var(--border-color)', borderRadius: '4px', background: '#f9fafb' }}
                        >
                            <Eye size={14} />
                        </button>
                        {isFirstFetch && <span className="first-fetch-badge">NEW</span>}
                        {gst.gstdNo && (
                            <span style={{ 
                                backgroundColor: '#f0f9ff', 
                                color: '#0369a1', 
                                border: '1px solid #bae6fd', 
                                padding: '0.1rem 0.4rem', 
                                borderRadius: '4px', 
                                fontSize: '0.7rem', 
                                fontWeight: 700,
                                fontFamily: "'Roboto Mono', monospace"
                            }}>
                                GSTD: {gst.gstdNo}
                            </span>
                        )}
                        {dataSourceBadge(gst.dataSource)}
                        {gst.apiError && (
                            <span style={{ background: '#fee2e2', color: '#991b1b', fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="API failed">
                                <AlertCircle size={12} /> ERROR
                            </span>
                        )}
                    </div>
                    <div style={{ 
                        fontSize: '0.85rem', 
                        color: 'var(--text-light)', 
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                    }}>
                        {gst.tradeName || gst.legalName || 'N/A'}
                    </div>
                </div>
                
                <div className={`score-badge ${getScoreColor(gst.grcScore, thresholds)}`} style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: 700,
                    minWidth: '42px', 
                    height: '42px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                }}>
                    {gst.grcScore !== null ? gst.grcScore : '-'}
                </div>
            </div>

            <div style={{ height: '1px', background: 'var(--border-color)', opacity: 0.5 }}></div>

            {/* 3-Column Body Section */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '0.8fr 1.2fr 1.5fr', 
                gap: '1rem',
                fontSize: '0.8rem'
            }}>
                {/* Column 1: Basic Info (Left) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderRight: '1px solid var(--border-color)', paddingRight: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--text-light)', fontWeight: 600, fontSize: '0.75rem' }}>Age</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9rem' }}>{calculateAge(gst.registrationDate)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.4rem' }}>
                        <span style={{ color: 'var(--text-light)', fontWeight: 600, fontSize: '0.75rem' }}>Type</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.85rem' }} title={gst.gstType}>
                            {formatGstType(gst.gstType)}
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.4rem' }}>
                        <span style={{ color: 'var(--text-light)', fontWeight: 600, fontSize: '0.75rem' }}>Turnover</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.85rem' }} title={formatTurnover(gst.aggregateTurnover)}>
                            {formatTurnover(gst.aggregateTurnover)}
                        </span>
                    </div>
                </div>

                {/* Column 2: GST Compliance (Middle) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderRight: '1px solid var(--border-color)', paddingRight: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary-color)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                        GST Compliance
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>GST - status:</span>
                        <span style={{ 
                            fontWeight: 700,
                            color: gst.gstStatus === 'Active' ? 'var(--success-color)' : 'var(--danger-color)',
                            backgroundColor: gst.gstStatus === 'Active' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px'
                        }}>
                            {gst.gstStatus || 'N/A'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>GSTR 1 delay:</span>
                        <span style={{ fontWeight: 700, color: gst.delayCountGstr1 > 0 ? 'var(--danger-color)' : 'var(--text-dark)' }}>
                            {gst.delayCountGstr1 !== null ? gst.delayCountGstr1 : '0'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>GSTR 3B delay:</span>
                        <span style={{ fontWeight: 700, color: gst.delayCountGstr3b > 0 ? 'var(--danger-color)' : 'var(--text-dark)' }}>
                            {gst.delayCountGstr3b !== null ? gst.delayCountGstr3b : '0'}
                        </span>
                    </div>
                    <div style={{ marginTop: 'auto', paddingTop: '0.4rem', fontSize: '0.68rem', color: 'var(--text-light)', borderTop: '1px dashed var(--border-color)', lineHeight: 1.3 }}>
                        Last updated: {gst.scoreCalculatedAt ? new Date(gst.scoreCalculatedAt).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                    </div>
                </div>

                {/* Column 3: GSTR-7 Compliance (Right) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary-color)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>GSTR7 Compliance</span>
                        {(gst.categoryName?.toLowerCase() === 'scrap' || (gst.gstr7Status && gst.gstr7Status !== 'NA')) && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); setShowTimeline(!showTimeline); }}
                                title="View Month-wise Filing"
                                style={{ 
                                    background: 'var(--primary-color)', 
                                    border: 'none', 
                                    cursor: 'pointer', 
                                    padding: '0.2rem 0.3rem', 
                                    color: 'white', 
                                    borderRadius: '4px', 
                                    display: 'flex', 
                                    alignItems: 'center',
                                    gap: '0.2rem'
                                }}
                            >
                                <History size={12} />
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>Business:</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{gst.categoryName || 'N/A'}</span>
                    </div>

                    {gst.categoryName?.toLowerCase() === 'scrap' || (gst.gstr7Status && gst.gstr7Status !== 'NA') ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>Status:</span>
                                <span style={{ fontWeight: 700, color: 'var(--success-color)' }}>applicable</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>Filling status:</span>
                                <Gstr7Badge status={gst.gstr7Status} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>If delayed:</span>
                                <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{gst.gstr7DelayCount || 0} times</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>Missed count:</span>
                                <span style={{ fontWeight: 700, color: gst.gstr7MissedCount > 0 ? 'var(--danger-color)' : 'var(--text-dark)' }}>{gst.gstr7MissedCount || 0}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>Last filling month:</span>
                                <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{formatPeriod(gst.gstr7LastReturnPeriod) || '—'}</span>
                            </div>
                            <div style={{ marginTop: 'auto', paddingTop: '0.4rem', fontSize: '0.7rem', color: 'var(--text-light)', borderTop: '1px dashed var(--border-color)' }}>
                                Last updated: {gst.gstr7LastUpdated ? new Date(gst.gstr7LastUpdated).toLocaleDateString('en-IN') : '—'}
                            </div>
                        </>
                    ) : (
                        <div style={{ background: '#f3f4f6', color: '#6b7280', padding: '0.5rem', borderRadius: '6px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.5rem' }}>
                            Not Applicable
                        </div>
                    )}
                </div>
            </div>

            {/* Expandable Timeline Section */}
            {showTimeline && (
                <div onClick={(e) => e.stopPropagation()}>
                    <Gstr7Timeline gstin={gst.gstin} onClose={() => setShowTimeline(false)} />
                </div>
            )}
        </div>
    );
};

export default GstCard;

