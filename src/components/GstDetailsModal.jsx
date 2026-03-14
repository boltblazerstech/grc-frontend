import React, { useState, useEffect } from 'react';
import { X, Save, Edit2, AlertCircle, ChevronDown, ChevronUp, Trash2, RefreshCw } from 'lucide-react';
import { apiClient } from '../api/apiClient';

const getScoreColor = (score, thresholds) => {
    if (score === null || score === undefined) return '';
    const red = thresholds?.COLOR_RED_THRESHOLD ?? 30;
    const yellow = thresholds?.COLOR_YELLOW_THRESHOLD ?? 20;
    if (score > red) return 'score-red';
    if (score > yellow) return 'score-yellow';
    return 'score-green';
};

// Mappings for max score config keys based on rule names
const RULE_MAX_MAP = {
    "GST Type": "TYPE_MAX",
    "Registration Date": "REG_MAX",
    "Turnover": "TRN_MAX",
    "GSTN Status": "STS_MAX",
    "GSTR-1 Filing": "G1_MAX",
    "GSTR-3B Filing": "G3B_MAX"
};

// Simplified labels for conditions
const getConditionLabel = (ruleName, gst) => {
    switch (ruleName) {
        case "GST Type": return gst.gstType?.toLowerCase().includes('proprietor') ? 'Proprietorship' : 'Company';
        case "Registration Date": 
            if (!gst.registrationDate) return 'N/A';
            const years = new Date().getFullYear() - new Date(gst.registrationDate).getFullYear();
            return `${gst.registrationDate} (${years}+ yrs)`;
        case "Turnover": return `${gst.aggregateTurnover || 0} Cr`;
        case "GSTN Status": return gst.gstStatus || 'N/A';
        case "GSTR-1 Filing": return `${gst.delayCountGstr1 || 0} delays`;
        case "GSTR-3B Filing": return `${gst.delayCountGstr3b || 0} delays`;
        default: return '—';
    }
};

const REQUIRED_LABEL_STYLE = { color: 'var(--danger-color)', marginLeft: '2px' };

const GstDetailsModal = ({ gst, onClose, onUpdate, onDelete, currentUser, thresholds }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({ ...gst });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [ruleConfig, setRuleConfig] = useState({});

    // Fetch full data and rule config on mount
    useEffect(() => {
        const loadFullData = async () => {
            setLoading(true);
            try {
                // Fetch fresh data (with breakdown) from single-item API
                const fullGst = await apiClient.getDetailByGstin(gst.gstin);
                setFormData(fullGst);
                
                // Also fetch config
                const configList = await apiClient.getRuleConfig();
                const configMap = {};
                configList.forEach(item => configMap[item.configKey] = item.configValue);
                setRuleConfig(configMap);
            } catch (err) {
                console.error("Failed to load full GST data:", err);
                setError("Partial data loaded. Some details may be missing.");
            } finally {
                setLoading(false);
            }
        };

        loadFullData();
    }, [gst.gstin]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const validateForm = () => {
        if (!formData.gstStatus) return 'Status is required';
        if (!formData.gstType) return 'Type is required';
        if (!formData.registrationDate) return 'Registration Date is required';
        if (formData.delayCountGstr1 === '' || formData.delayCountGstr1 === null || formData.delayCountGstr1 === undefined)
            return 'GSTR-1 Delay Count is required';
        if (formData.delayCountGstr3b === '' || formData.delayCountGstr3b === null || formData.delayCountGstr3b === undefined)
            return 'GSTR-3B Delay Count is required';
        if (!formData.aggregateTurnover) return 'Aggregate Turnover is required';
        return null;
    };

    const handleSave = async () => {
        const validationError = validateForm();
        if (validationError) { setError(validationError); return; }
        setLoading(true);
        setError('');
        try {
            const payload = {
                tradeName: formData.tradeName || null,
                legalName: formData.legalName || null,
                address: formData.address || null,
                gstStatus: formData.gstStatus,
                gstType: formData.gstType,
                registrationDate: formData.registrationDate,
                aggregateTurnover: formData.aggregateTurnover,
                delayCountGstr1: parseInt(formData.delayCountGstr1),
                delayCountGstr3b: parseInt(formData.delayCountGstr3b),
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


    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete GSTIN: ${gst.gstin}? This cannot be undone.`)) {
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

    const toInputDate = (val) => {
        if (!val) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
        try { return new Date(val).toISOString().split('T')[0]; }
        catch { return ''; }
    };

    const getMaxForRule = (ruleName) => {
        const keys = RULE_MAX_MAP[ruleName];
        if (!keys) return '—';
        if (Array.isArray(keys)) {
            return keys.reduce((sum, k) => sum + (ruleConfig[k] || 0), 0) || '—';
        }
        return ruleConfig[keys] || '—';
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2>{gst.gstin} Details</h2>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {currentUser?.role === 'SUPER_ADMIN' && (
                            <button
                                className="btn btn-sm"
                                style={{ padding: '0.4rem', color: 'var(--danger-color)', background: 'transparent', border: '1px solid var(--danger-color)' }}
                                onClick={handleDelete}
                                title="Delete GST Record"
                                disabled={loading}
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                        <button className="close-btn" onClick={onClose}><X size={24} /></button>
                    </div>
                </div>

                <div className="modal-body">
                    {error && (
                        <div style={{ color: 'var(--danger-color)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertCircle size={18} /> {error}
                        </div>
                    )}

                    <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>GRC Score</h3>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className={`score-badge ${getScoreColor(gst.grcScore, thresholds)}`} style={{ fontSize: '2rem', minWidth: '80px' }}>
                                {gst.grcScore !== null && gst.grcScore !== undefined ? gst.grcScore : 'N/A'}
                            </span>
                            <div style={{ textAlign: 'right' }}>
                                {gst.updatedBy && <div style={{ fontSize: '0.9rem', color: 'var(--primary-color)', fontWeight: 500 }}>Updated By: {gst.updatedBy}</div>}
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                                    {gst.scoreCalculatedAt ? new Date(gst.scoreCalculatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Never'}
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-primary" onClick={handleRecalculate} disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
                                {loading ? <span className="spinner" style={{ width: '16px', height: '16px' }} /> : <><RefreshCw size={15} /> Recalculate</>}
                            </button>
                        </div>
                    </div>

                    <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            <h3>GST Details</h3>
                            {!isEditing && (
                                <button className="btn btn-secondary" onClick={() => { setFormData({ ...gst }); setIsEditing(true); setError(''); }} style={{ padding: '0.2rem 0.75rem' }}>
                                    <Edit2 size={14} /> Edit
                                </button>
                            )}
                        </div>

                        {isEditing ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                                    <div className="input-group">
                                        <label>Status<span style={REQUIRED_LABEL_STYLE}>*</span></label>
                                        <select className="form-control" name="gstStatus" value={formData.gstStatus || ''} onChange={handleInputChange}>
                                            <option value="">— Select —</option>
                                            <option value="Active">Active</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label>Type<span style={REQUIRED_LABEL_STYLE}>*</span></label>
                                        <select className="form-control" name="gstType" value={formData.gstType || ''} onChange={handleInputChange}>
                                            <option value="">— Select —</option>
                                            <option value="Private Limited Company">Private</option>
                                            <option value="Public Limited Company">Public</option>
                                            <option value="Partnership">Partnership</option>
                                            <option value="Proprietorship">Proprietorship</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label>Registration Date<span style={REQUIRED_LABEL_STYLE}>*</span></label>
                                        <input type="date" className="form-control" name="registrationDate" value={toInputDate(formData.registrationDate)} onChange={handleInputChange} />
                                    </div>
                                    <div className="input-group">
                                        <label>Aggregate Turnover (Cr)<span style={REQUIRED_LABEL_STYLE}>*</span></label>
                                        <input type="number" step="0.01" className="form-control" name="aggregateTurnover" value={formData.aggregateTurnover ?? ''} onChange={handleInputChange} />
                                    </div>
                                    <div className="input-group">
                                        <label>GSTR-1 Delay Count<span style={REQUIRED_LABEL_STYLE}>*</span></label>
                                        <input type="number" min="0" className="form-control" name="delayCountGstr1" value={formData.delayCountGstr1 ?? ''} onChange={handleInputChange} />
                                    </div>
                                    <div className="input-group">
                                        <label>GSTR-3B Delay Count<span style={REQUIRED_LABEL_STYLE}>*</span></label>
                                        <input type="number" min="0" className="form-control" name="delayCountGstr3b" value={formData.delayCountGstr3b ?? ''} onChange={handleInputChange} />
                                    </div>
                                </div>
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
                                    <textarea className="form-control" name="address" value={formData.address || ''} onChange={handleInputChange} rows={2} />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                    <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
                                    <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                                        {loading ? <span className="spinner" style={{ width: '16px' }} /> : <><Save size={15} /> Save & Recalculate</>}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 2rem' }}>
                                <div className="detail-row"><span className="detail-label">Trade Name:</span><span className="detail-value">{gst.tradeName || 'N/A'}</span></div>
                                <div className="detail-row"><span className="detail-label">Legal Name:</span><span className="detail-value">{gst.legalName || 'N/A'}</span></div>
                                <div className="detail-row"><span className="detail-label">Status:</span><span className="detail-value">{gst.gstStatus || 'N/A'}</span></div>
                                <div className="detail-row"><span className="detail-label">Type:</span><span className="detail-value">{gst.gstType || 'N/A'}</span></div>
                                <div className="detail-row"><span className="detail-label">Reg. Date:</span><span className="detail-value">{gst.registrationDate || 'N/A'}</span></div>
                                <div className="detail-row"><span className="detail-label">Turnover:</span><span className="detail-value">{gst.aggregateTurnover ? `${gst.aggregateTurnover} Cr` : 'N/A'}</span></div>
                                <div className="detail-row"><span className="detail-label">GSTR-1 Delays:</span><span className="detail-value">{gst.delayCountGstr1 ?? 'N/A'}</span></div>
                                <div className="detail-row"><span className="detail-label">GSTR-3B Delays:</span><span className="detail-value">{gst.delayCountGstr3b ?? 'N/A'}</span></div>
                            </div>
                        )}
                    </div>

                    <div className="card breakdown-card" style={{ padding: 0 }}>
                        <button className="breakdown-toggle" onClick={() => setShowBreakdown(!showBreakdown)}>
                            <h3 style={{ margin: 0 }}>Score Breakdown</h3>
                            {showBreakdown ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                        {showBreakdown && (
                            <div className="breakdown-body" style={{ overflowX: 'auto' }}>
                                {gst.scoreBreakdown ? (
                                    <table className="breakdown-table">
                                        <thead>
                                            <tr>
                                                <th>Rule</th>
                                                <th>Context</th>
                                                <th style={{ textAlign: 'right' }}>Score</th>
                                                <th style={{ textAlign: 'right' }}>Max</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(gst.scoreBreakdown).map(([ruleName, score]) => (
                                                <tr key={ruleName}>
                                                    <td style={{ fontWeight: 500 }}>{ruleName}</td>
                                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{getConditionLabel(ruleName, gst)}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{score}</td>
                                                    <td style={{ textAlign: 'right', color: 'var(--text-light)' }}>{getMaxForRule(ruleName)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ borderTop: '2px solid var(--border-color)' }}>
                                                <td colSpan="2" style={{ fontWeight: 'bold' }}>Total Score</td>
                                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{gst.grcScore}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>100</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                ) : (
                                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-light)' }}>
                                        No breakdown available. Please recalculate score.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GstDetailsModal;
