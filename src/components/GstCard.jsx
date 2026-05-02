import React, { useState } from 'react';
import { Eye, Copy, Check, AlertCircle } from 'lucide-react';
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

const Gstr7Badge = ({ status }) => {
    let bg = '#f3f4f6';
    let color = '#374151';
    let text = status || 'N/A';

    if (status === 'Regular without delay') {
        bg = '#d1fae5'; color = '#047857'; text = 'Regular';
    } else if (status === 'Regular with Delay') {
        bg = '#fef3c7'; color = '#b45309'; text = 'Delayed';
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
                        {isFirstFetch && <span className="first-fetch-badge">NEW</span>}
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
                gridTemplateColumns: '1.2fr 1fr 1fr', 
                gap: '1rem',
                fontSize: '0.8rem'
            }}>
                {/* Column 1: Basic Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>Status:</span>
                        <span style={{ 
                            fontWeight: 700,
                            color: gst.gstStatus === 'Active' ? 'var(--success-color)' : 'var(--danger-color)' 
                        }}>
                            {gst.gstStatus || 'N/A'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>Type:</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-dark)' }} title={gst.gstType}>
                            {formatGstType(gst.gstType)}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>Age:</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{calculateAge(gst.registrationDate)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>Turnover:</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-dark)', textAlign: 'right', maxWidth: '100px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={formatTurnover(gst.aggregateTurnover)}>
                            {formatTurnover(gst.aggregateTurnover)}
                        </span>
                    </div>
                </div>

                {/* Column 2: Delay Count */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-dark)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                        Delay Count
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>GSTR-1</span>
                        <span style={{ 
                            background: gst.delayCountGstr1 > 0 ? '#fee2e2' : '#f3f4f6', 
                            color: gst.delayCountGstr1 > 0 ? '#b91c1c' : '#374151', 
                            padding: '0.15rem 0.5rem', 
                            borderRadius: '4px', 
                            fontWeight: 700, 
                            fontSize: '0.75rem' 
                        }}>
                            {gst.delayCountGstr1 !== null ? gst.delayCountGstr1 : 'N/A'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>GSTR-3B</span>
                        <span style={{ 
                            background: gst.delayCountGstr3b > 0 ? '#fee2e2' : '#f3f4f6', 
                            color: gst.delayCountGstr3b > 0 ? '#b91c1c' : '#374151', 
                            padding: '0.15rem 0.5rem', 
                            borderRadius: '4px', 
                            fontWeight: 700, 
                            fontSize: '0.75rem' 
                        }}>
                            {gst.delayCountGstr3b !== null ? gst.delayCountGstr3b : 'N/A'}
                        </span>
                    </div>
                </div>

                {/* Column 3: GSTR-7 Compliance */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-dark)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                        GSTR-7 Compliance
                    </div>
                    <div>
                        <Gstr7Badge status={gst.gstr7Status} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>Missed:</span>
                        <span style={{ 
                            fontWeight: 700, 
                            color: gst.gstr7MissedCount > 0 ? '#b91c1c' : '#059669', 
                            fontSize: '0.8rem' 
                        }}>
                            {gst.gstr7MissedCount ?? 0}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>Last Filed:</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.75rem' }}>
                            {gst.gstr7LastUpdated ? new Date(gst.gstr7LastUpdated).toLocaleString('en-IN', { month: 'short', year: 'numeric' }) : 'N/A'}
                        </span>
                    </div>
                    {gst.gstr7Status !== 'NA' && gst.gstr7Status !== 'Processing' && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowTimeline(!showTimeline); }}
                            style={{ 
                                marginTop: '0.2rem',
                                fontSize: '0.7rem', 
                                color: 'var(--primary-color)', 
                                background: 'none', 
                                border: '1px solid var(--primary-color)',
                                borderRadius: '4px',
                                padding: '0.2rem 0.4rem',
                                cursor: 'pointer',
                                fontWeight: 600,
                                textAlign: 'center',
                                transition: 'all 0.2s ease'
                            }}>
                            {showTimeline ? 'Hide History Timeline' : 'View History Timeline'}
                        </button>
                    )}
                </div>
            </div>

            <div style={{ height: '1px', background: 'var(--border-color)', opacity: 0.5 }}></div>

            {/* Footer Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-light)' }}>
                <span>
                    Updated: {gst.scoreCalculatedAt ? new Date(gst.scoreCalculatedAt).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                </span>
                <button 
                    onClick={(e) => { e.stopPropagation(); onClick(gst); }}
                    style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: 'var(--primary-color)', 
                        fontWeight: 700, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.3rem',
                        cursor: 'pointer',
                        padding: '0.2rem'
                    }}
                >
                    <Eye size={14} /> View Details
                </button>
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

