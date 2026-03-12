import React from 'react';

const getScoreColor = (score) => {
    if (score === null || score === undefined) return '';
    if (score > 80) return 'score-red';
    if (score > 50) return 'score-yellow';
    return 'score-green';
};

const GstCard = ({ gst, onClick, isNew, isFirstFetch }) => {
    return (
        <div
            className={`card gst-card ${isFirstFetch ? 'first-fetch-item' : isNew ? 'new-item' : ''}`}
            onClick={() => onClick(gst)}
            style={{ cursor: 'pointer', position: 'relative' }}
        >
            <div className="gst-card-header" style={{ paddingRight: '20px' }}>
                <div>
                    <div className="gst-title">
                        {gst.gstin}
                        {isFirstFetch && <span className="first-fetch-badge">NEW</span>}
                    </div>
                    <div className="gst-subtitle">{gst.tradeName || gst.legalName || 'N/A'}</div>
                </div>
                <div className={`score-badge ${getScoreColor(gst.grcScore)}`} title={`Version: ${gst.scoreVersion}`}>
                    {gst.grcScore !== null ? gst.grcScore : '-'}
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
