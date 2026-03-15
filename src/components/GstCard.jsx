import React, { useState } from 'react';
import { Eye, Copy, Check } from 'lucide-react';

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
    
    // Adjust logic slightly to match "today - date" accurately for months
    if (today.getDate() < birthDate.getDate()) {
        months--;
        if (months < 0) {
            months = 11;
            // years already handled if needed, but the logic above covers the boundary
        }
    }

    // If 6 months or more, round up to next year
    if (months >= 6) {
        years++;
    }
    
    if (years <= 0) return 'New';
    return `${years} yr${years > 1 ? 's' : ''}`;
};

const getScoreColor = (score, thresholds) => {
    if (score === null || score === undefined) return '';
    const green = thresholds?.COLOR_RED_THRESHOLD ?? 30;   // Renaming for clarity in logic
    const yellow = thresholds?.COLOR_YELLOW_THRESHOLD ?? 20;
    
    if (score > green) return 'score-green';
    if (score >= yellow) return 'score-yellow';
    return 'score-red';
};

const formatGstType = (type) => {
    if (!type) return 'N/A';
    // Get first word only, e.g. "Private Limited Company" -> "Private"
    return type.trim().split(/\s+/)[0];
};

const GstCard = ({ gst, onClick, isNew, isFirstFetch, index, thresholds }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(gst.gstin);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div
            className={`card gst-card ${isFirstFetch ? 'first-fetch-item' : isNew ? 'new-item' : ''}`}
            style={{ 
                position: 'relative',
                padding: '0.85rem 1rem',
                transition: 'transform 0.2s, box-shadow 0.2s',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem'
            }}
        >
            <div className="gst-card-header" style={{ padding: 0, border: 0, marginBottom: 0 }}>
                <div style={{ flex: 1 }}>
                    <div className="gst-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--text-light)', fontSize: '0.8rem', fontWeight: 600 }}>#{index}</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.5px', color: 'var(--primary-color)' }}>{gst.gstin}</span>
                        <button 
                            className="ghost-btn" 
                            onClick={handleCopy}
                            title="Copy GSTIN"
                            style={{ padding: '0.2rem', color: 'var(--text-light)', display: 'inline-flex' }}
                        >
                            {copied ? <Check size={14} color="var(--success-color)" /> : <Copy size={14} />}
                        </button>
                        {isFirstFetch && <span className="first-fetch-badge">NEW</span>}
                    </div>
                    <div className="gst-subtitle" style={{ 
                        fontSize: '0.9rem', 
                        color: 'var(--text-color)', 
                        opacity: 0.8,
                        fontWeight: 500,
                        lineHeight: 1.3,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                    }}>
                        {gst.tradeName || gst.legalName || 'N/A'}
                    </div>
                </div>
                <div className={`score-badge ${getScoreColor(gst.grcScore, thresholds)}`} style={{ 
                    fontSize: '1rem', 
                    fontWeight: 700,
                    minWidth: '34px', 
                    height: '34px',
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

            <div style={{ height: '1px', background: 'var(--border-color)', opacity: 0.3 }}></div>

            <div className="gst-details-preview" style={{ 
                display: 'grid', 
                gridTemplateColumns: '1.2fr 1fr', 
                gap: '0.4rem 0.5rem',
                fontSize: '0.8rem'
            }}>
                <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '1rem' }}>
                    <span className="detail-label" style={{ color: 'var(--text-light)', fontWeight: 500 }}>Status:</span>
                    <span className="detail-value" style={{ 
                        fontWeight: 600,
                        color: gst.gstStatus === 'Active' ? 'var(--success-color)' : 'var(--danger-color)' 
                    }}>
                        {gst.gstStatus || 'N/A'}
                    </span>
                </div>
                <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="detail-label" style={{ color: 'var(--text-light)', fontWeight: 500 }}>Turnover:</span>
                    <span className="detail-value" style={{ fontWeight: 600 }}>
                        {(!gst.aggregateTurnover || gst.aggregateTurnover === "0" || gst.aggregateTurnover === 0) 
                            ? 'N/A' 
                            : `${gst.aggregateTurnover} Cr+`}
                    </span>
                </div>
                
                <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '1rem' }}>
                    <span className="detail-label" style={{ color: 'var(--text-light)', fontWeight: 500 }}>Age:</span>
                    <span className="detail-value" style={{ fontWeight: 600 }}>{calculateAge(gst.registrationDate)}</span>
                </div>
                <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="detail-label" style={{ color: 'var(--text-light)', fontWeight: 500 }}>Type:</span>
                    <span className="detail-value" style={{ fontWeight: 600 }} title={gst.gstType}>
                        {formatGstType(gst.gstType)}
                    </span>
                </div>

                <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '1rem' }}>
                    <span className="detail-label" style={{ color: 'var(--text-light)', fontWeight: 500 }}>GSTR-1:</span>
                    <span className="detail-value" style={{ fontWeight: 600 }}>{gst.delayCountGstr1 !== null ? gst.delayCountGstr1 : 'N/A'}</span>
                </div>
                <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="detail-label" style={{ color: 'var(--text-light)', fontWeight: 500 }}>GSTR-3B:</span>
                    <span className="detail-value" style={{ fontWeight: 600 }}>{gst.delayCountGstr3b !== null ? gst.delayCountGstr3b : 'N/A'}</span>
                </div>
            </div>

            <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px dashed var(--border-color)', fontSize: '0.7rem', color: 'var(--text-light)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Updated:</span>
                <span>{gst.scoreCalculatedAt ? new Date(gst.scoreCalculatedAt).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
            </div>
        </div>
    );
};

export default GstCard;
