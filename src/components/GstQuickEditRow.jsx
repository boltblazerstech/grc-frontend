import React, { useState } from 'react';
import { Save, RefreshCw, AlertCircle, Eye, Copy, Check } from 'lucide-react';
import { apiClient } from '../api/apiClient';

const REQUIRED_LABEL_STYLE = { color: 'var(--danger-color)', marginLeft: '2px' };

const GstQuickEditRow = ({ gst, getScoreColor, onUpdate, index }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        gstStatus: gst.gstStatus || '',
        gstType: gst.gstType || '',
        registrationDate: gst.registrationDate || '',
        aggregateTurnover: gst.aggregateTurnover || '',
        delayCountGstr1: gst.delayCountGstr1 || 0,
        delayCountGstr3b: gst.delayCountGstr3b || 0
    });
    const [copied, setCopied] = useState(false);

    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(gst.gstin);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setLoading(true);
        setError('');
        try {
            const payload = {
                ...formData,
                delayCountGstr1: parseInt(formData.delayCountGstr1 || 0),
                delayCountGstr3b: parseInt(formData.delayCountGstr3b || 0),
            };
            // updateDetails already triggers recalculation and returns full object
            const updated = await apiClient.updateDetails(gst.gstin, payload);
            onUpdate(updated);
        } catch (err) {
            setError(err.message || 'Failed to update/recalculate');
        } finally {
            setLoading(false);
        }
    };

    const toInputDate = (val) => {
        if (!val) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
        try { return new Date(val).toISOString().split('T')[0]; }
        catch { return ''; }
    };

    return (
        <div className="card quick-edit-card" style={{ marginBottom: '0.3rem', padding: '0' }}>
            {/* Header Row */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.2rem 0.5rem',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-color-alt)'
            }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-light)', fontWeight: 600, fontSize: '0.8rem', width: '20px' }}>{index}.</span>
                    <span style={{ fontWeight: 600, color: 'var(--primary-color)', fontSize: '0.9rem' }}>{gst.gstin}</span>
                    <button 
                        className="ghost-btn" 
                        onClick={handleCopy}
                        title="Copy GSTIN"
                        style={{ padding: '0.2rem', color: 'var(--text-light)', display: 'inline-flex' }}
                    >
                        {copied ? <Check size={14} color="var(--success-color)" /> : <Copy size={14} />}
                    </button>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginLeft: '0.5rem' }}>{gst.tradeName || gst.legalName || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-light)' }}>
                         {gst.scoreCalculatedAt ? new Date(gst.scoreCalculatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Never'}
                         {gst.source && <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginTop: '1px' }}>Source: <span style={{ fontWeight: 500 }}>{gst.source}</span></div>}
                         {gst.updatedBy && <div style={{ fontSize: '0.7rem', color: 'var(--primary-color)' }}>By: {gst.updatedBy}</div>}
                    </div>
                    <span className={`score-badge score-badge-sm ${getScoreColor(gst.grcScore)}`}>
                        {gst.grcScore !== null ? gst.grcScore : '-'}
                    </span>
                    <button 
                         className="btn btn-sm btn-secondary" 
                         onClick={() => onUpdate({ ...gst, _openModal: true })}
                         title="View Full Details"
                         style={{ padding: '0.3rem' }}
                    >
                         <Eye size={18} />
                    </button>
                </div>
            </div>

            {/* Editable Fields Grid */}
            <div style={{ padding: '0.35rem 0.5rem' }}>
                {error && (
                    <div style={{ color: 'var(--danger-color)', marginBottom: '0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={14} /> {error}
                    </div>
                )}
                
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
                    gap: '0.4rem',
                    alignItems: 'end'
                }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.7rem', marginBottom: '2px', display: 'block' }}>Status</label>
                        <select className="form-control form-control-sm" name="gstStatus" value={formData.gstStatus} onChange={handleInputChange}>
                            <option value="Active">Active</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.7rem', marginBottom: '2px', display: 'block' }}>Type</label>
                        <select className="form-control form-control-sm" name="gstType" value={formData.gstType} onChange={handleInputChange}>
                            <option value="Private Limited Company">Private</option>
                            <option value="Public Limited Company">Public</option>
                            <option value="Partnership">Partnership</option>
                            <option value="Proprietorship">Proprietorship</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.7rem', marginBottom: '2px', display: 'block' }}>Reg. Date</label>
                        <input type="date" className="form-control form-control-sm" name="registrationDate" value={toInputDate(formData.registrationDate)} onChange={handleInputChange} />
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.7rem', marginBottom: '2px', display: 'block' }}>Turnover (Cr)</label>
                        <input type="number" step="0.01" className="form-control form-control-sm" name="aggregateTurnover" value={formData.aggregateTurnover} onChange={handleInputChange} />
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.7rem', marginBottom: '2px', display: 'block' }}>GSTR-1 Delays</label>
                        <input type="number" min="0" className="form-control form-control-sm" name="delayCountGstr1" value={formData.delayCountGstr1} onChange={handleInputChange} style={{ padding: '0.2rem 0.4rem' }} />
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.7rem', marginBottom: '2px', display: 'block' }}>GSTR-3B Delays</label>
                        <input type="number" min="0" className="form-control form-control-sm" name="delayCountGstr3b" value={formData.delayCountGstr3b} onChange={handleInputChange} style={{ padding: '0.2rem 0.4rem' }} />
                    </div>

                    <button 
                        className="btn btn-primary btn-sm" 
                        onClick={handleSave} 
                        disabled={loading}
                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                        title="Recalculate Score"
                    >
                        {loading ? <span className="spinner" style={{ width: '16px', height: '16px' }} /> : <RefreshCw size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GstQuickEditRow;
