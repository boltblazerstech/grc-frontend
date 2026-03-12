import React, { useState, useMemo } from 'react';
import { X, Save, Edit2, AlertCircle, Play, RefreshCw, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { apiClient } from '../api/apiClient';

const getScoreColor = (score) => {
    if (score === null || score === undefined) return '';
    if (score > 80) return 'score-red';
    if (score > 50) return 'score-yellow';
    return 'score-green';
};

const GstDetailsModal = ({ gst, onClose, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isEditingFiling, setIsEditingFiling] = useState(false);
    const [formData, setFormData] = useState({ ...gst });
    const [loading, setLoading] = useState(false);
    const [scoreOverride, setScoreOverride] = useState('');
    const [showOverride, setShowOverride] = useState(false);
    const [error, setError] = useState('');
    const [showBreakdown, setShowBreakdown] = useState(false);

    const breakdown = useMemo(() => {
        const gstr1Delays = gst.delayCountGstr1;
        const gstr3bDelays = gst.delayCountGstr3b;
        const turnover = gst.aggregateTurnover;

        const gstr1Points = (gstr1Delays !== null && gstr1Delays > 1) ? 13.0 : 0;
        const gstr3bPoints = (gstr3bDelays !== null && gstr3bDelays > 1) ? 9.75 : 0;

        let turnoverPoints = 0;
        let turnoverBracket = 'N/A';
        if (turnover !== null && turnover !== undefined) {
            if (turnover < 5) { turnoverPoints = 6.5; turnoverBracket = '< 5 Cr'; }
            else if (turnover < 50) { turnoverPoints = 5.0; turnoverBracket = '5 - 50 Cr'; }
            else if (turnover <= 100) { turnoverPoints = 3.0; turnoverBracket = '50 - 100 Cr'; }
            else { turnoverPoints = 1.0; turnoverBracket = '> 100 Cr'; }
        }

        const rawScore = gstr1Points + gstr3bPoints + turnoverPoints;
        const multiplier = 1.53;
        const finalScore = Math.round(rawScore * multiplier);

        return { gstr1Points, gstr3bPoints, turnoverPoints, turnoverBracket, rawScore, multiplier, finalScore };
    }, [gst]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveDetails = async () => {
        setLoading(true);
        setError('');
        try {
            const payload = {
                ...formData,
                aggregateTurnover: formData.aggregateTurnover ? parseFloat(formData.aggregateTurnover) : null,
                delayCountGstr1: formData.delayCountGstr1 ? parseInt(formData.delayCountGstr1) : null,
                delayCountGstr3b: formData.delayCountGstr3b ? parseInt(formData.delayCountGstr3b) : null
            };
            await apiClient.updateDetails(gst.gstin, payload);
            const updated = await apiClient.getDetailByGstin(gst.gstin);
            onUpdate(updated);
            setIsEditing(false);
        } catch (err) {
            setError(err.message || 'Failed to update details');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveFilingAndRecalc = async () => {
        setLoading(true);
        setError('');
        try {
            const payload = {
                ...formData,
                aggregateTurnover: formData.aggregateTurnover !== '' ? parseFloat(formData.aggregateTurnover) : null,
                delayCountGstr1: formData.delayCountGstr1 !== '' ? parseInt(formData.delayCountGstr1) : null,
                delayCountGstr3b: formData.delayCountGstr3b !== '' ? parseInt(formData.delayCountGstr3b) : null
            };
            await apiClient.updateDetails(gst.gstin, payload);
            // Recalculate score after updating filing details
            await apiClient.calculateScore(gst.gstin);
            const updated = await apiClient.getDetailByGstin(gst.gstin);
            onUpdate(updated);
            setIsEditingFiling(false);
        } catch (err) {
            setError(err.message || 'Failed to save & recalculate');
        } finally {
            setLoading(false);
        }
    };

    const handleRecalculate = async () => {
        setLoading(true);
        setError('');
        try {
            await apiClient.calculateScore(gst.gstin);
            const updated = await apiClient.getDetailByGstin(gst.gstin);
            onUpdate(updated);
        } catch (err) {
            setError(err.message || 'Failed to recalculate score');
        } finally {
            setLoading(false);
        }
    };

    const handleRefetchApi = async () => {
        setLoading(true);
        setError('');
        try {
            await apiClient.fetchGstDetails([gst.gstin]); // This triggers external fetch & save
            // The backend /fetch API might not return the updated object directly, so we fetch it again
            const updated = await apiClient.getDetailByGstin(gst.gstin);
            onUpdate(updated);
        } catch (err) {
            setError(err.message || 'Failed to refetch data from GST API');
        } finally {
            setLoading(false);
        }
    };

    const handleOverrideScore = async () => {
        if (!scoreOverride || isNaN(scoreOverride)) {
            setError('Please enter a valid numeric score');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const updated = await apiClient.overrideScore(gst.gstin, parseInt(scoreOverride));
            onUpdate(updated);
            setShowOverride(false);
            setScoreOverride('');
        } catch (err) {
            setError(err.message || 'Failed to override score');
        } finally {
            setLoading(false);
        }
    };

    const startEditingFiling = () => {
        setFormData({ ...gst });
        setIsEditingFiling(true);
    };

    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete GSTIN: ${gst.gstin}? This action cannot be undone.`)) {
            setLoading(true);
            try {
                await apiClient.deleteGstDetail(gst.gstin);
                onDelete(gst.gstin);
                onClose();
            } catch (err) {
                setError(err.message || 'Failed to delete GST record');
                setLoading(false);
            }
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2>{gst.gstin} Details</h2>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button 
                            className="btn btn-sm" 
                            style={{ padding: '0.4rem', color: 'var(--danger-color)', background: 'transparent', border: '1px solid var(--danger-color)' }}
                            onClick={handleDelete}
                            title="Delete GST Record"
                            disabled={loading}
                        >
                            <Trash2 size={18} />
                        </button>
                        <button className="close-btn" onClick={onClose}><X size={24} /></button>
                    </div>
                </div>

                <div className="modal-body">
                    {error && (
                        <div style={{ color: 'var(--danger-color)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertCircle size={18} /> {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div className="card" style={{ padding: '1rem' }}>
                            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Current Score</h3>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span className={`score-badge ${getScoreColor(gst.grcScore)}`} style={{ fontSize: '2rem', minWidth: '80px' }}>
                                    {gst.grcScore !== null ? gst.grcScore : 'N/A'}
                                </span>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>Version: {gst.scoreVersion}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                                        {gst.scoreCalculatedAt ? new Date(gst.scoreCalculatedAt).toLocaleString() : 'Never'}
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-secondary" onClick={handleRecalculate} disabled={loading} style={{ flex: 1, justifyContent: 'center' }} title="Recalculate score using local data">
                                    {loading ? <span className="spinner"></span> : <><Play size={16} /> Recalc</>}
                                </button>
                                <button className="btn btn-primary" onClick={handleRefetchApi} disabled={loading} style={{ flex: 1, justifyContent: 'center' }} title="Fetch fresh data from GST API & Recalculate">
                                    {loading ? <span className="spinner"></span> : <><RefreshCw size={16} /> Refetch API</>}
                                </button>
                                <button className="btn btn-secondary" onClick={() => setShowOverride(!showOverride)} disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
                                    Override
                                </button>
                            </div>

                            {showOverride && (
                                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="number"
                                        className="form-control"
                                        placeholder="New Score"
                                        value={scoreOverride}
                                        onChange={e => setScoreOverride(e.target.value)}
                                    />
                                    <button className="btn btn-primary" onClick={handleOverrideScore} disabled={loading}>Set</button>
                                </div>
                            )}
                        </div>

                        <div className="card" style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                                <h3>Business Details</h3>
                                {!isEditing && (
                                    <button className="btn btn-secondary" onClick={() => { setFormData({ ...gst }); setIsEditing(true); }} style={{ padding: '0.2rem 0.5rem' }}>
                                        <Edit2 size={16} /> Edit
                                    </button>
                                )}
                            </div>

                            {isEditing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div className="input-group">
                                        <label>Trade Name</label>
                                        <input className="form-control" name="tradeName" value={formData.tradeName || ''} onChange={handleInputChange} />
                                    </div>
                                    <div className="input-group">
                                        <label>Legal Name</label>
                                        <input className="form-control" name="legalName" value={formData.legalName || ''} onChange={handleInputChange} />
                                    </div>
                                    <div className="input-group">
                                        <label>Address</label>
                                        <textarea className="form-control" name="address" value={formData.address || ''} onChange={handleInputChange} rows={3} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                        <button className="btn btn-secondary" onClick={() => setIsEditing(false)} disabled={loading}>Cancel</button>
                                        <button className="btn btn-primary" onClick={handleSaveDetails} disabled={loading}>
                                            {loading ? <span className="spinner" style={{ width: '16px', height: '16px' }}></span> : <><Save size={16} /> Save</>}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className="detail-row"><span className="detail-label">Trade Name:</span> <span className="detail-value">{gst.tradeName || 'N/A'}</span></div>
                                    <div className="detail-row"><span className="detail-label">Legal Name:</span> <span className="detail-value">{gst.legalName || 'N/A'}</span></div>
                                    <div className="detail-row"><span className="detail-label">Address:</span> <span className="detail-value" style={{ textAlign: 'right', maxWidth: '60%' }}>{gst.address || 'N/A'}</span></div>
                                    <div className="detail-row"><span className="detail-label">Status:</span> <span className="detail-value">{gst.gstStatus || 'N/A'}</span></div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card" style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            <h3>Filing & Turnover Details</h3>
                            {!isEditingFiling && (
                                <button className="btn btn-secondary" onClick={startEditingFiling} style={{ padding: '0.2rem 0.5rem' }}>
                                    <Edit2 size={16} /> Edit
                                </button>
                            )}
                        </div>

                        {isEditingFiling ? (
                            <div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div className="input-group">
                                        <label>Turnover (Cr)</label>
                                        <input type="number" step="0.01" className="form-control" name="aggregateTurnover" value={formData.aggregateTurnover ?? ''} onChange={handleInputChange} />
                                    </div>
                                    <div className="input-group">
                                        <label>Status</label>
                                        <input className="form-control" name="gstStatus" value={formData.gstStatus || ''} onChange={handleInputChange} />
                                    </div>
                                    <div className="input-group">
                                        <label>GSTR-1 Delay Count</label>
                                        <input type="number" className="form-control" name="delayCountGstr1" value={formData.delayCountGstr1 ?? ''} onChange={handleInputChange} />
                                    </div>
                                    <div className="input-group">
                                        <label>GSTR-3B Delay Count</label>
                                        <input type="number" className="form-control" name="delayCountGstr3b" value={formData.delayCountGstr3b ?? ''} onChange={handleInputChange} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                    <button className="btn btn-secondary" onClick={() => setIsEditingFiling(false)} disabled={loading}>Cancel</button>
                                    <button className="btn btn-primary" onClick={handleSaveFilingAndRecalc} disabled={loading}>
                                        {loading ? <span className="spinner" style={{ width: '16px', height: '16px' }}></span> : <><RefreshCw size={16} /> Save & Recalculate</>}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div>
                                    <div className="detail-row"><span className="detail-label">Aggregate Turnover:</span> <span className="detail-value">{gst.aggregateTurnover ? `₹${gst.aggregateTurnover} Cr` : 'N/A'}</span></div>
                                    <div className="detail-row"><span className="detail-label">GSTR-1 Delays:</span> <span className="detail-value">{gst.delayCountGstr1 !== null ? gst.delayCountGstr1 : 'N/A'}</span></div>
                                    <div className="detail-row"><span className="detail-label">GSTR-3B Delays:</span> <span className="detail-value">{gst.delayCountGstr3b !== null ? gst.delayCountGstr3b : 'N/A'}</span></div>
                                </div>
                                <div>
                                    <div className="detail-row"><span className="detail-label">Reg Date:</span> <span className="detail-value">{gst.registrationDate || 'N/A'}</span></div>
                                    <div className="detail-row"><span className="detail-label">GST Type:</span> <span className="detail-value">{gst.gstType || 'N/A'}</span></div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="card breakdown-card" style={{ padding: 0 }}>
                        <button
                            className="breakdown-toggle"
                            onClick={() => setShowBreakdown(!showBreakdown)}
                        >
                            <h3 style={{ margin: 0 }}>Score Calculation Breakdown</h3>
                            {showBreakdown ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>

                        {showBreakdown && (
                            <div className="breakdown-body">
                                <table className="breakdown-table">
                                    <thead>
                                        <tr>
                                            <th>Rule</th>
                                            <th>Input</th>
                                            <th>Condition</th>
                                            <th style={{ textAlign: 'right' }}>Points</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>GSTR-1 Filing Delay</td>
                                            <td>{gst.delayCountGstr1 !== null ? `${gst.delayCountGstr1} delays` : 'N/A'}</td>
                                            <td>{gst.delayCountGstr1 !== null ? (gst.delayCountGstr1 > 1 ? '> 1 → 13.0 pts' : '≤ 1 → 0 pts') : '—'}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{breakdown.gstr1Points.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td>GSTR-3B Filing Delay</td>
                                            <td>{gst.delayCountGstr3b !== null ? `${gst.delayCountGstr3b} delays` : 'N/A'}</td>
                                            <td>{gst.delayCountGstr3b !== null ? (gst.delayCountGstr3b > 1 ? '> 1 → 9.75 pts' : '≤ 1 → 0 pts') : '—'}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{breakdown.gstr3bPoints.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td>Turnover</td>
                                            <td>{gst.aggregateTurnover ? `₹${gst.aggregateTurnover} Cr` : 'N/A'}</td>
                                            <td>{breakdown.turnoverBracket}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{breakdown.turnoverPoints.toFixed(2)}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                <div className="breakdown-summary">
                                    <div className="breakdown-row">
                                        <span>Raw Score</span>
                                        <span>{breakdown.gstr1Points.toFixed(2)} + {breakdown.gstr3bPoints.toFixed(2)} + {breakdown.turnoverPoints.toFixed(2)} = <strong>{breakdown.rawScore.toFixed(2)}</strong></span>
                                    </div>
                                    <div className="breakdown-row">
                                        <span>Multiplier</span>
                                        <span>× {breakdown.multiplier}</span>
                                    </div>
                                    <div className="breakdown-row breakdown-final">
                                        <span>Calculated Score</span>
                                        <span className={`score-badge score-badge-sm ${getScoreColor(breakdown.finalScore)}`}>{breakdown.finalScore}</span>
                                    </div>
                                    {gst.grcScore !== null && gst.grcScore !== breakdown.finalScore && (
                                        <div className="breakdown-row" style={{ color: 'var(--warning-color)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                                            <span>⚠ Actual score ({gst.grcScore}) differs — may have been manually overridden</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GstDetailsModal;
