import React, { useState } from 'react';
import { Save, RefreshCw, AlertCircle } from 'lucide-react';
import { apiClient } from '../api/apiClient';

const REQUIRED_LABEL_STYLE = { color: 'var(--danger-color)', marginLeft: '2px' };

const GstQuickEditRow = ({ gst, getScoreColor, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        gstStatus: gst.gstStatus || '',
        gstType: gst.gstType || '',
        registrationDate: gst.registrationDate || '',
        aggregateTurnover: gst.aggregateTurnover || 0,
        delayCountGstr1: gst.delayCountGstr1 || 0,
        delayCountGstr3b: gst.delayCountGstr3b || 0
    });

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
        <div className="card quick-edit-card" style={{ marginBottom: '1rem', padding: '0' }}>
            {/* Header Row */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-color-alt)'
            }}>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', cursor: 'pointer' }} onClick={() => onUpdate({ ...gst, _openModal: true })}>
                    <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{gst.gstin}</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>{gst.tradeName || gst.legalName || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-light)' }}>
                         {gst.scoreCalculatedAt ? new Date(gst.scoreCalculatedAt).toLocaleString() : 'Never'}
                         {gst.updatedBy && <div style={{ fontSize: '0.7rem', color: 'var(--primary-color)' }}>By: {gst.updatedBy}</div>}
                    </div>
                    <span className={`score-badge score-badge-sm ${getScoreColor(gst.grcScore)}`}>
                        {gst.grcScore !== null ? gst.grcScore : '-'}
                    </span>
                </div>
            </div>

            {/* Editable Fields Grid */}
            <div style={{ padding: '1rem' }}>
                {error && (
                    <div style={{ color: 'var(--danger-color)', marginBottom: '0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={14} /> {error}
                    </div>
                )}
                
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
                    gap: '1rem',
                    alignItems: 'end'
                }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem' }}>Status</label>
                        <select className="form-control form-control-sm" name="gstStatus" value={formData.gstStatus} onChange={handleInputChange}>
                            <option value="Active">Active</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem' }}>Type</label>
                        <select className="form-control form-control-sm" name="gstType" value={formData.gstType} onChange={handleInputChange}>
                            <option value="Private Limited Company">Private</option>
                            <option value="Public Limited Company">Public</option>
                            <option value="Proprietorship">Proprietorship</option>
                        </select>
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem' }}>Reg. Date</label>
                        <input type="date" className="form-control form-control-sm" name="registrationDate" value={toInputDate(formData.registrationDate)} onChange={handleInputChange} />
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem' }}>Turnover (Cr)</label>
                        <input type="number" step="0.01" className="form-control form-control-sm" name="aggregateTurnover" value={formData.aggregateTurnover} onChange={handleInputChange} />
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem' }}>GSTR-1 Delays</label>
                        <input type="number" min="0" className="form-control form-control-sm" name="delayCountGstr1" value={formData.delayCountGstr1} onChange={handleInputChange} />
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem' }}>GSTR-3B Delays</label>
                        <input type="number" min="0" className="form-control form-control-sm" name="delayCountGstr3b" value={formData.delayCountGstr3b} onChange={handleInputChange} />
                    </div>

                    <button 
                        className="btn btn-primary btn-sm" 
                        onClick={handleSave} 
                        disabled={loading}
                        style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
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
