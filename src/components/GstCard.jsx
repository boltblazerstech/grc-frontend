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

    const yearPart = years > 0 ? `${years} yr${years > 1 ? 's' : ''}` : '';
    const monthPart = months > 0 ? `${months} mo${months > 1 ? 's' : ''}` : '';
    
    if (!yearPart && !monthPart) return 'New';
    return `${yearPart}${yearPart && monthPart ? ' ' : ''}${monthPart}`.trim();
};

const getScoreColor = (score, thresholds) => {
    if (score === null || score === undefined) return '';
    const red = thresholds?.COLOR_RED_THRESHOLD ?? 30;
    const yellow = thresholds?.COLOR_YELLOW_THRESHOLD ?? 20;
    if (score > red) return 'score-red';
    if (score > yellow) return 'score-yellow';
    return 'score-green';
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
            style={{ position: 'relative' }}
        >
            <div className="gst-card-header" style={{ paddingRight: '20px' }}>
                <div>
                    <div className="gst-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>#{index}</span>
                        {gst.gstin}
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
                    <div className="gst-subtitle">{gst.tradeName || gst.legalName || 'N/A'}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                    <div className={`score-badge ${getScoreColor(gst.grcScore, thresholds)}`} style={{ fontSize: '1rem', minWidth: '45px', padding: '0.3rem 0.5rem' }}>
                        {gst.grcScore !== null ? gst.grcScore : '-'}
                    </div>
                </div>
            </div>

            <div className="gst-details-preview" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1rem' }}>
                <div className="detail-row">
                    <span className="detail-label">Status:</span>
                    <span className="detail-value" style={{ color: gst.gstStatus === 'Active' ? 'var(--success-color)' : 'var(--danger-color)' }}>
                        {gst.gstStatus || 'N/A'}
                    </span>
                </div>
                <div className="detail-row">
                    <span className="detail-label">Turnover:</span>
                    <span className="detail-value">
                        {(!gst.aggregateTurnover || gst.aggregateTurnover === "0" || gst.aggregateTurnover === 0) ? 'N/A' : `${gst.aggregateTurnover} Cr`}
                    </span>
                </div>
                <div className="detail-row">
                    <span className="detail-label">Age:</span>
                    <span className="detail-value">{calculateAge(gst.registrationDate)}</span>
                </div>
                <div className="detail-row">
                    <span className="detail-label">Type:</span>
                    <span className="detail-value" title={gst.gstType}>{gst.gstType || 'N/A'}</span>
                </div>

                <div className="detail-row">
                    <span className="detail-label">GSTR-1:</span>
                    <span className="detail-value">{gst.delayCountGstr1 !== null ? gst.delayCountGstr1 : 'N/A'}</span>
                </div>
                <div className="detail-row">
                    <span className="detail-label">GSTR-3B:</span>
                    <span className="detail-value">{gst.delayCountGstr3b !== null ? gst.delayCountGstr3b : 'N/A'}</span>
                </div>
            </div>
        </div>
    );
};

export default GstCard;
