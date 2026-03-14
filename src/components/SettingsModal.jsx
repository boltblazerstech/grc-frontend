import React, { useState, useEffect } from 'react';
import { X, Save, RefreshCw, AlertCircle, RotateCcw } from 'lucide-react';
import { apiClient } from '../api/apiClient';

// Group the flat config list into logical sections for display
const SECTIONS = [
    {
        title: 'Rule 1 — GST Type',
        max: 'TYPE_MAX',
        keys: [
            { key: 'TYPE_MAX',          label: 'Max Score',                  hint: 'Maximum points for this rule' },
            { key: 'TYPE_PUBLIC_MULT',  label: 'Public Limited Multiplier',  hint: '0.0 = safest' },
            { key: 'TYPE_PRIVATE_MULT', label: 'Private Limited Multiplier', hint: '0.25' },
            { key: 'TYPE_PARTNER_MULT', label: 'Partnership Multiplier',     hint: '0.5' },
            { key: 'TYPE_PROPR_MULT',   label: 'Proprietorship Multiplier',  hint: '1.0 = riskiest' },
            { key: 'TYPE_OTHER_MULT',   label: 'Other Type Multiplier',      hint: '1.0' },
        ]
    },
    {
        title: 'Rule 2 — Registration Date',
        max: 'REG_MAX',
        keys: [
            { key: 'REG_MAX',      label: 'Max Score',            hint: '' },
            { key: 'REG_LT1_MULT',  label: '< 1 year Multiplier', hint: '' },
            { key: 'REG_1TO3_MULT', label: '1–3 years Multiplier', hint: '' },
            { key: 'REG_3TO5_MULT', label: '3–5 years Multiplier', hint: '' },
            { key: 'REG_GT5_MULT',  label: '> 5 years Multiplier', hint: '' },
        ]
    },
    {
        title: 'Rule 3 — Turnover',
        max: 'TRN_MAX',
        keys: [
            { key: 'TRN_MAX',          label: 'Max Score',             hint: '' },
            { key: 'TRN_LT50_MULT',    label: '< 50 Cr Multiplier',   hint: '' },
            { key: 'TRN_50TO100_MULT', label: '50–100 Cr Multiplier', hint: '' },
            { key: 'TRN_GT100_MULT',   label: '> 100 Cr Multiplier',  hint: '' },
        ]
    },
    {
        title: 'Rule 4 — GSTN Status',
        max: 'STS_MAX',
        keys: [
            { key: 'STS_MAX',         label: 'Max Score',              hint: '' },
            { key: 'STS_ACTIVE_MULT', label: 'Active Multiplier',      hint: '0.0 = safe' },
            { key: 'STS_CANCEL_MULT', label: 'Cancelled Multiplier',   hint: '1.0 = risky' },
        ]
    },
    {
        title: 'Rule 5 — GSTR-1 Filing',
        max: 'G1_MAX',
        keys: [
            { key: 'G1_MAX',        label: 'Max Score',             hint: '' },
            { key: 'G1_THRESHOLD',  label: 'Delay Threshold',       hint: 'delays > this = risky' },
            { key: 'G1_OK_MULT',    label: 'On-time Multiplier',    hint: '0.0 = safe' },
            { key: 'G1_DELAY_MULT', label: 'Delayed Multiplier',    hint: '1.0 = risky' },
        ]
    },
    {
        title: 'Rule 6 — GSTR-3B Filing',
        max: 'G3B_MAX',
        keys: [
            { key: 'G3B_MAX',        label: 'Max Score',            hint: '' },
            { key: 'G3B_THRESHOLD',  label: 'Delay Threshold',      hint: 'delays > this = risky' },
            { key: 'G3B_OK_MULT',    label: 'On-time Multiplier',   hint: '0.0 = safe' },
            { key: 'G3B_DELAY_MULT', label: 'Delayed Multiplier',   hint: '1.0 = risky' },
        ]
    }
];

const COLOR_SECTION = {
    title: 'Score Color Coding (Dashboard)',
    keys: [
        { key: 'COLOR_RED_THRESHOLD',    label: 'Red Threshold (> value)',    hint: 'e.g. 30' },
        { key: 'COLOR_YELLOW_THRESHOLD', label: 'Yellow Threshold (> value)', hint: 'e.g. 20' },
    ]
};

const SettingsModal = ({ onClose, onRecalculateAll, isRecalculating }) => {
    const [configMap, setConfigMap]   = useState({});
    const [editMap, setEditMap]       = useState({});
    const [loading, setLoading]       = useState(true);
    const [savingRules, setSavingRules] = useState(false);
    const [savingColors, setSavingColors] = useState(false);
    const [error, setError]           = useState('');
    const [success, setSuccess]       = useState('');

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        setLoading(true);
        setError('');
        try {
            const list = await apiClient.getRuleConfig();
            const map = {};
            list.forEach(item => { map[item.configKey] = item.configValue; });
            setConfigMap(map);
            setEditMap({ ...map });
        } catch (err) {
            setError(err.message || 'Failed to load rule config');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (key, value) => {
        setEditMap(prev => ({ ...prev, [key]: value }));
        setSuccess('');
    };

    const handleSave = async (keys) => {
        const isColor = keys.some(k => k.startsWith('COLOR_'));
        if (isColor) setSavingColors(true);
        else setSavingRules(true);

        setError('');
        setSuccess('');
        try {
            const payload = {};
            keys.forEach(k => {
                const val = parseFloat(editMap[k]);
                if (!isNaN(val)) payload[k] = val;
            });

            const updated = await apiClient.updateRuleConfig(payload);
            const map = {};
            updated.forEach(item => { map[item.configKey] = item.configValue; });
            
            // Merge updated values into both maps
            const newConfigMap = { ...configMap, ...payload };
            setConfigMap(newConfigMap);
            setSuccess(isColor ? 'Color thresholds updated!' : 'Rule multipliers updated!');
        } catch (err) {
            setError(err.message || 'Failed to save settings');
        } finally {
            if (isColor) setSavingColors(false);
            else setSavingRules(false);
        }
    };

    const handleReset = () => {
        setEditMap({ ...configMap });
        setSuccess('');
        setError('');
    };

    // Total max score preview
    const totalMax = SECTIONS.reduce((sum, s) => {
        const max = parseFloat(editMap[s.max] ?? 0);
        return sum + (isNaN(max) ? 0 : max);
    }, 0);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <div>
                        <h2>⚙ Rule Settings</h2>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '2px' }}>
                            Total max score: <strong style={{ color: totalMax === 100 ? 'var(--success-color, #22c55e)' : 'var(--warning-color)' }}>{totalMax}</strong> / 100
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}><X size={24} /></button>
                </div>

                {/* Body */}
                <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
                    {error && (
                        <div style={{ color: 'var(--danger-color)', marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}
                    {success && (
                        <div style={{ color: '#22c55e', marginBottom: '1rem', background: 'rgba(34,197,94,0.1)', padding: '0.6rem 1rem', borderRadius: '6px', fontSize: '0.9rem' }}>
                            ✓ {success}
                        </div>
                    )}

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                            <span className="spinner" style={{ width: '32px', height: '32px', borderWidth: '3px' }} />
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Rules Group */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--primary-color)', paddingBottom: '0.5rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--primary-color)' }}>Factor Multipliers</h3>
                                    <button 
                                        className="btn btn-primary" 
                                        onClick={() => handleSave(SECTIONS.flatMap(s => s.keys.map(k => k.key)))}
                                        disabled={savingRules}
                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                    >
                                        {savingRules ? <span className="spinner" style={{ width: '14px', height: '14px' }} /> : <><Save size={14} /> Update Rule Settings</>}
                                    </button>
                                </div>
                                {SECTIONS.map(section => (
                                    <div key={section.title} className="card" style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                                            <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{section.title}</h4>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                                                Max Points: <strong>{editMap[section.max] ?? '—'}</strong>
                                            </span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                                            {section.keys.map(({ key, label, hint }) => (
                                                <div key={key} className="input-group" style={{ margin: 0 }}>
                                                    <label style={{ fontSize: '0.8rem', marginBottom: '2px' }}>
                                                        {label}
                                                        {hint && <span style={{ color: 'var(--text-light)', marginLeft: '4px' }}>({hint})</span>}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        className="form-control"
                                                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.9rem' }}
                                                        value={editMap[key] ?? ''}
                                                        onChange={e => handleChange(key, e.target.value)}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Color Group */}
                            <div className="card" style={{ padding: '1.25rem', border: '1px solid var(--primary-color)', backgroundColor: 'rgba(37, 150, 190, 0.03)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid var(--primary-color)', paddingBottom: '0.5rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--primary-color)' }}>Dashboard Color Thresholds</h3>
                                    <button 
                                        className="btn btn-primary" 
                                        onClick={() => handleSave(COLOR_SECTION.keys.map(k => k.key))}
                                        disabled={savingColors}
                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                    >
                                        {savingColors ? <span className="spinner" style={{ width: '14px', height: '14px' }} /> : <><Save size={14} /> Update color settings</>}
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    {COLOR_SECTION.keys.map(({ key, label, hint }) => (
                                        <div key={key} className="input-group" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>{label}</label>
                                            <input
                                                type="number"
                                                className="form-control"
                                                value={editMap[key] ?? ''}
                                                onChange={e => handleChange(key, e.target.value)}
                                            />
                                            <small style={{ color: 'var(--text-light)' }}>{hint}</small>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', flexShrink: 0, flexWrap: 'wrap' }}>
                    <button
                        className="btn btn-primary"
                        onClick={() => { onRecalculateAll(); }}
                        disabled={isRecalculating || savingRules || savingColors}
                        title="Recalculate all GRC scores using current rule settings"
                        style={{ gap: '0.4rem' }}
                    >
                        {isRecalculating ? <><span className="spinner" style={{ width: '14px', height: '14px' }} /> Recalculating...</> : <><RefreshCw size={15} /> Recalculate All</>}
                    </button>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary" onClick={handleReset} disabled={savingRules || savingColors}>
                            <RotateCcw size={15} /> Reset All
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
