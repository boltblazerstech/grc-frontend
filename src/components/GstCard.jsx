import React, { useState } from 'react';
import { Eye, Copy, Check } from 'lucide-react';

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
                    <button 
                        className="btn btn-sm btn-secondary" 
                        onClick={() => onClick(gst)}
                        title="View Details"
                        style={{ padding: '0.3rem', borderRadius: '50%' }}
                    >
                        <Eye size={18} />
                    </button>
                    <div className={`score-badge ${getScoreColor(gst.grcScore, thresholds)}`} style={{ fontSize: '1rem', minWidth: '45px', padding: '0.3rem 0.5rem' }}>
                        {gst.grcScore !== null ? gst.grcScore : '-'}
                    </div>
                </div>
            </div>

            <div className="gst-details-preview">
                <div className="detail-row">
                    <span className="detail-label">GSTR-1 Delays:</span>
                    <span className="detail-value">{gst.delayCountGstr1 !== null ? gst.delayCountGstr1 : 'N/A'}</span>
                </div>
                <div className="detail-row">
                    <span className="detail-label">GSTR-3B Delays:</span>
                    <span className="detail-value">{gst.delayCountGstr3b !== null ? gst.delayCountGstr3b : 'N/A'}</span>
                </div>
            </div>
        </div>
    );
};

export default GstCard;
