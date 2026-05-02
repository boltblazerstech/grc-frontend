import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { Save, ChevronDown, ChevronUp, FileText, Settings, Plus, Trash2, Tag, History, Sparkles } from 'lucide-react';

// ── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
    const cfg = {
        'Regular without delay': { bg: '#d4edda', color: '#155724', label: '✓ Regular' },
        'Regular with Delay':    { bg: '#fff3cd', color: '#856404', label: '⚠ Delayed' },
        'Missed':                { bg: '#f8d7da', color: '#721c24', label: '✕ Missed' },
        'Processing':            { bg: '#e0f2fe', color: '#0369a1', label: '⟳ Processing' },
        'NA':                    { bg: '#f3f4f6', color: '#6b7280', label: 'N/A' },
    }[status] || { bg: '#e2e3e5', color: '#383d41', label: status || '—' };
    return (
        <span style={{
            backgroundColor: cfg.bg, color: cfg.color,
            padding: '0.2rem 0.55rem', borderRadius: '12px',
            fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap'
        }}>
            {cfg.label}
        </span>
    );
};

// ── Filing History Modal ───────────────────────────────────────────────────────

const FilingModal = ({ gstin, onClose, onSaved }) => {
    const [text, setText] = useState('');
    const [parsing, setParsing] = useState(false);
    const [preview, setPreview] = useState(null);
    const [saving, setSaving] = useState(false);
    const [history, setHistory] = useState(null);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [err, setErr] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        apiClient.getGstr7FilingDetails(gstin)
            .then(data => setHistory(data))
            .catch(() => setHistory([]))
            .finally(() => setLoadingHistory(false));
        return () => { document.body.style.overflow = ''; };
    }, [gstin]);

    const showMsg = (msg, isErr = false) => {
        if (isErr) {
            setErr(msg);
            setSuccessMsg('');
        } else {
            setSuccessMsg(msg);
            setErr('');
            setTimeout(() => { setSuccessMsg(''); }, 4000);
        }
    };

    const handleParse = async () => {
        if (!text.trim()) return;
        setParsing(true); setPreview(null); setErr('');
        try {
            const data = await apiClient.parseGstr7Filing(gstin, text);
            if (!data || !data.items || data.items.length === 0) { showMsg('AI could not extract any records. Check the pasted text.', true); return; }
            setPreview(data);
        } catch (e) { showMsg('AI parsing failed: ' + e.message, true); }
        finally { setParsing(false); }
    };

    const handleSave = async () => {
        if (!preview) return;
        setSaving(true);
        try {
            const records = preview.items.map(p => ({ returnPeriod: p.returnPeriod, dateOfFiling: p.dateOfFiling }));
            const res = await apiClient.saveGstr7Filing(gstin, records);
            
            if (res && res.status === 'submitted_for_review') {
                setPreview(null); setText('');
                showMsg('Submitted to Super Admin for review successfully!');
            } else {
                const updated = await apiClient.getGstr7FilingDetails(gstin);
                setHistory(updated);
                setPreview(null); setText('');
                showMsg('Filing history saved! Status & delay count recalculated.');
                if (onSaved) onSaved();
            }
        } catch (e) { showMsg('Save failed: ' + e.message, true); }
        finally { setSaving(false); }
    };

    const fmtPeriod = (rp) => {
        const ym = rp ? rp.split('-') : [];
        return ym.length === 2
            ? new Date(+ym[0], +ym[1] - 1).toLocaleString('default', { month: 'short' }) + ' ' + ym[0]
            : rp;
    };

    const statusColor = s => ({ 'Regular without delay': '#155724', 'Regular with Delay': '#856404', Missed: '#721c24' }[s] || '#383d41');
    const statusBg   = s => ({ 'Regular without delay': '#d4edda', 'Regular with Delay': '#fff3cd', Missed: '#f8d7da' }[s] || '#e2e3e5');

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ background: 'white', borderRadius: '12px', width: '92%', maxWidth: '860px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
                    <div>
                        <h4 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <History size={17} /> Filing History Import
                        </h4>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-light)', fontFamily: "'Roboto Mono', monospace" }}>{gstin}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: 'var(--text-light)', lineHeight: 1 }}>✕</button>
                </div>

                {/* Scrollable body */}
                <div style={{ overflowY: 'auto', padding: '1.25rem 1.5rem', flex: 1 }}>
                    {err && <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '0.6rem 0.9rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.84rem' }}>{err}</div>}
                    {successMsg && <div style={{ backgroundColor: '#d4edda', color: '#155724', padding: '0.6rem 0.9rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.84rem' }}>{successMsg}</div>}

                    {/* ── Stored history ── */}
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        Stored Filing History (Last 12 Months)
                    </p>
                    {loadingHistory ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem' }}><div className="spinner" style={{ width: '22px', height: '22px' }}></div></div>
                    ) : history && history.length > 0 ? (
                        <div style={{ overflowX: 'auto', marginBottom: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                                <thead>
                                    <tr style={{ backgroundColor: 'rgba(37,150,190,0.08)' }}>
                                        {['Period', 'Filed On', 'Status'].map(h => (
                                            <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', color: 'var(--text-light)', textTransform: 'uppercase' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((r, i) => (
                                        <tr key={r.id} style={{ borderBottom: '1px solid #eef2f6', backgroundColor: i % 2 === 0 ? 'white' : '#f8fcff' }}>
                                            <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600 }}>{fmtPeriod(r.returnPeriod)}</td>
                                            <td style={{ padding: '0.45rem 0.75rem' }}>{r.dateOfFiling || <span style={{ fontStyle: 'italic', color: 'var(--text-light)' }}>Not Filed</span>}</td>
                                            <td style={{ padding: '0.45rem 0.75rem' }}>
                                                <span style={{ backgroundColor: statusBg(r.status), color: statusColor(r.status), padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                    {r.status === 'Regular without delay' ? '✓ Regular' : r.status === 'Regular with Delay' ? '⚠ Delayed' : r.status === 'Missed' ? '✕ Missed' : r.status || '—'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ backgroundColor: '#f8f9fa', border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', marginBottom: '1.5rem' }}>
                            <History size={28} style={{ color: 'var(--text-light)', marginBottom: '0.5rem' }} />
                            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-light)' }}>No filing history yet. Import below.</p>
                        </div>
                    )}

                    {/* ── Paste & Parse ── */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                            {history && history.length > 0 ? '↻ Update — Paste New Table' : '＋ Import — Paste Table from GST Portal'}
                        </p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: '0.75rem' }}>
                            Go to GST portal → GSTR-7 returns → copy the filing history table and paste it below. Gemini AI will parse it automatically.
                        </p>
                        <textarea
                            value={text}
                            onChange={e => setText(e.target.value)}
                            rows={6}
                            placeholder={`Paste copied table here, e.g.:\n2025-2026\tMarch\t27/04/2026\tFiled\n2025-2026\tFebruary\t18/03/2026\tFiled\n2025-2026\tJanuary\t16/02/2026\tFiled`}
                            style={{ width: '100%', boxSizing: 'border-box', fontFamily: "'Roboto Mono', monospace", fontSize: '0.82rem', padding: '0.7rem 0.9rem', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fafafa', resize: 'vertical', marginBottom: '0.9rem' }}
                        />

                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button className="btn btn-primary" onClick={handleParse} disabled={parsing || !text.trim()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {parsing ? <><span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></span>Parsing with AI...</> : <><Sparkles size={15} />Parse with AI</>}
                            </button>
                            {preview && (
                                <>
                                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#28a745', borderColor: '#28a745' }}>
                                        {saving ? <><span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></span>Saving...</> : <><Save size={15} />Confirm & Save</>}
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => setPreview(null)} style={{ fontSize: '0.83rem' }}>Discard Preview</button>
                                </>
                            )}
                        </div>

                        {/* Preview table */}
                        {preview && (
                            <div style={{ marginTop: '1.25rem' }}>
                                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                    ✦ AI Preview — {preview.items.length} period(s) · Review then save
                                </p>
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', padding: '0.75rem', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #93c5fd' }}>
                                    <div>
                                        <span style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 600, textTransform: 'uppercase' }}>Final Status</span>
                                        <div style={{ marginTop: '2px' }}><StatusBadge status={preview.summaryStatus} /></div>
                                    </div>
                                    <div style={{ borderLeft: '1px solid #93c5fd', paddingLeft: '1rem' }}>
                                        <span style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 600, textTransform: 'uppercase' }}>Delay Count</span>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e40af' }}>{preview.delayCount}</div>
                                    </div>
                                    <div style={{ borderLeft: '1px solid #93c5fd', paddingLeft: '1rem' }}>
                                        <span style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 600, textTransform: 'uppercase' }}>Missed Count</span>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#b91c1c' }}>{preview.missedCount}</div>
                                    </div>
                                </div>
                                <div style={{ border: '1.5px solid #93c5fd', borderRadius: '8px', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#eff6ff' }}>
                                                {['Period', 'Filed On', 'Status'].map(h => (
                                                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', color: '#1d4ed8', textTransform: 'uppercase' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {preview.items.map((p, i) => (
                                                <tr key={p.returnPeriod} style={{ borderBottom: '1px solid #dbeafe', backgroundColor: i % 2 === 0 ? 'white' : '#f0f7ff' }}>
                                                    <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600 }}>{p.returnPeriodLabel || fmtPeriod(p.returnPeriod)}</td>
                                                    <td style={{ padding: '0.45rem 0.75rem' }}>{p.dateOfFiling || <span style={{ fontStyle: 'italic', color: 'var(--text-light)' }}>Not Filed</span>}</td>
                                                    <td style={{ padding: '0.45rem 0.75rem' }}>
                                                        <span style={{ backgroundColor: statusBg(p.status), color: statusColor(p.status), padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                            {p.status === 'Regular without delay' ? '✓ Regular' : p.status === 'Regular with Delay' ? '⚠ Delayed' : p.status === 'Missed' ? '✕ Missed' : p.status || '—'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// kept for backward compat — no longer used as inline
const FilingHistorySection = ({ gstin, onClose }) => {

    const [text, setText] = useState('');
    const [parsing, setParsing] = useState(false);
    const [preview, setPreview] = useState(null);
    const [saving, setSaving] = useState(false);
    const [history, setHistory] = useState(null);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [err, setErr] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        apiClient.getGstr7FilingDetails(gstin)
            .then(data => setHistory(data))
            .catch(() => setHistory([]))
            .finally(() => setLoadingHistory(false));
    }, [gstin]);

    const showMsg = (msg, isErr = false) => {
        if (isErr) setErr(msg); else setSuccessMsg(msg);
        setTimeout(() => { setErr(''); setSuccessMsg(''); }, 4000);
    };

    const handleParse = async () => {
        if (!text.trim()) return;
        setParsing(true);
        setPreview(null);
        setErr('');
        try {
            const data = await apiClient.parseGstr7Filing(gstin, text);
            setPreview(data);
        } catch (e) {
            showMsg('AI parsing failed: ' + e.message, true);
        } finally {
            setParsing(false);
        }
    };

    const handleSave = async () => {
        if (!preview) return;
        setSaving(true);
        try {
            const records = preview.map(p => ({ returnPeriod: p.returnPeriod, dateOfFiling: p.dateOfFiling }));
            await apiClient.saveGstr7Filing(gstin, records);
            const updated = await apiClient.getGstr7FilingDetails(gstin);
            setHistory(updated);
            setPreview(null);
            setText('');
            showMsg('Filing history saved and status recalculated.');
        } catch (e) {
            showMsg('Save failed: ' + e.message, true);
        } finally {
            setSaving(false);
        }
    };

    const sectionStyle = {
        backgroundColor: '#f0f7fb',
        border: '1px solid #c8e0ef',
        borderRadius: '6px',
        padding: '1.25rem',
        margin: '0.5rem 0'
    };

    return (
        <div style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h5 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '0.9rem' }}>
                    <History size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                    Filing History — {gstin}
                </h5>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-light)' }}>✕</button>
            </div>

            {err && <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '0.5rem 0.75rem', borderRadius: '4px', marginBottom: '0.75rem', fontSize: '0.83rem' }}>{err}</div>}
            {successMsg && <div style={{ backgroundColor: '#d4edda', color: '#155724', padding: '0.5rem 0.75rem', borderRadius: '4px', marginBottom: '0.75rem', fontSize: '0.83rem' }}>{successMsg}</div>}

            {/* ── Saved history ── */}
            {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '1rem' }}><div className="spinner" style={{ width: '20px', height: '20px' }}></div></div>
            ) : history && history.length > 0 ? (
                <div style={{ marginBottom: '1.5rem' }}>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: '0.5rem', fontWeight: 600 }}>STORED FILING HISTORY</p>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ backgroundColor: 'rgba(37,150,190,0.1)' }}>
                                    {['Period', 'Due Date', 'Filed On', 'Status', 'Delay (days)'].map(h => (
                                        <th key={h} style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', color: 'var(--text-light)', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((r, i) => {
                                    const ym = r.returnPeriod ? r.returnPeriod.split('-') : [];
                                    const monthLabel = ym.length === 2
                                        ? new Date(+ym[0], +ym[1] - 1).toLocaleString('default', { month: 'short' }) + ' ' + ym[0]
                                        : r.returnPeriod;
                                    return (
                                        <tr key={r.id} style={{ borderBottom: '1px solid #dde8f0', backgroundColor: i % 2 === 0 ? 'white' : '#f8fcff' }}>
                                            <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600 }}>{monthLabel}</td>
                                            <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-light)' }}>{r.dueDate || '—'}</td>
                                            <td style={{ padding: '0.4rem 0.6rem' }}>{r.dateOfFiling || <span style={{ fontStyle: 'italic', color: 'var(--text-light)' }}>Not Filed</span>}</td>
                                            <td style={{ padding: '0.4rem 0.6rem' }}><StatusBadge status={r.status} /></td>
                                            <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>{r.delayDays > 0 ? <span style={{ color: '#856404', fontWeight: 600 }}>{r.delayDays}</span> : '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', fontStyle: 'italic', marginBottom: '1rem' }}>No filing history imported yet.</p>
            )}

            {/* ── Import section ── */}
            <div style={{ borderTop: history && history.length > 0 ? '1px dashed #c8e0ef' : 'none', paddingTop: history && history.length > 0 ? '1rem' : 0 }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 600, marginBottom: '0.5rem' }}>
                    {history && history.length > 0 ? 'UPDATE FILING HISTORY' : 'IMPORT FILING HISTORY'}
                </p>
                <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={5}
                    placeholder={`Paste GSTR-7 filing table here (copy from GST portal, PDF, or spreadsheet).\nExample:\nApr 2024  10-05-2024  08-05-2024\nMay 2024  10-06-2024  Not Filed`}
                    style={{
                        width: '100%', boxSizing: 'border-box', fontFamily: 'monospace',
                        fontSize: '0.82rem', padding: '0.6rem 0.75rem',
                        border: '1px solid var(--border-color)', borderRadius: '4px',
                        backgroundColor: 'white', resize: 'vertical', marginBottom: '0.75rem'
                    }}
                />
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <button
                        className="btn btn-primary"
                        onClick={handleParse}
                        disabled={parsing || !text.trim()}
                        style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}
                    >
                        {parsing
                            ? <><span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px', marginRight: '6px' }}></span>Parsing...</>
                            : <><Sparkles size={14} style={{ marginRight: '5px' }} />Parse with AI</>}
                    </button>
                    {preview && (
                        <button
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={saving}
                            style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem', backgroundColor: '#28a745', borderColor: '#28a745' }}
                        >
                            {saving
                                ? <><span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px', marginRight: '6px' }}></span>Saving...</>
                                : <><Save size={14} style={{ marginRight: '5px' }} />Confirm & Save</>}
                        </button>
                    )}
                    {preview && (
                        <button className="btn btn-secondary" onClick={() => setPreview(null)} style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}>
                            Clear Preview
                        </button>
                    )}
                </div>
            </div>

            {/* ── Preview table ── */}
            {preview && (
                <div style={{ marginTop: '1rem' }}>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 600, marginBottom: '0.5rem' }}>
                        AI PREVIEW — {preview.length} period(s) found. Review and confirm.
                    </p>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ backgroundColor: 'rgba(37,150,190,0.1)' }}>
                                    {['Period', 'Due Date', 'Filed On', 'Status', 'Delay (days)'].map(h => (
                                        <th key={h} style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', color: 'var(--text-light)', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {preview.map((p, i) => (
                                    <tr key={p.returnPeriod} style={{ borderBottom: '1px solid #dde8f0', backgroundColor: i % 2 === 0 ? 'white' : '#f8fcff' }}>
                                        <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600 }}>{p.returnPeriodLabel}</td>
                                        <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-light)' }}>{p.dueDate || '—'}</td>
                                        <td style={{ padding: '0.4rem 0.6rem' }}>{p.dateOfFiling || <span style={{ fontStyle: 'italic', color: 'var(--text-light)' }}>Not Filed</span>}</td>
                                        <td style={{ padding: '0.4rem 0.6rem' }}><StatusBadge status={p.status} /></td>
                                        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>{p.delayDays > 0 ? <span style={{ color: '#856404', fontWeight: 600 }}>{p.delayDays}</span> : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────────

const Gstr7Management = () => {
    const [pansData, setPansData] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedPans, setExpandedPans] = useState(new Set());
    const [editState, setEditState] = useState({});
    const [savingCategory, setSavingCategory] = useState(null);
    const [savingGstd, setSavingGstd] = useState(null);
    const [savingGstinRow, setSavingGstinRow] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');
    const [showManage, setShowManage] = useState(false);
    const [sortEligibleFirst, setSortEligibleFirst] = useState(true);

    // Modal state for filing history
    const [modalGstin, setModalGstin] = useState(null);

    // Manage view state
    const [expandedCategory, setExpandedCategory] = useState(null);
    const [newCatName, setNewCatName] = useState('');
    const [newCatDesc, setNewCatDesc] = useState('');
    const [savingNewCat, setSavingNewCat] = useState(false);
    const [newCodeInputs, setNewCodeInputs] = useState({});
    const [newCodeDescInputs, setNewCodeDescInputs] = useState({});
    const [savingCode, setSavingCode] = useState(null);

    const sortedPansData = React.useMemo(() => {
        if (!sortEligibleFirst) return pansData;
        return [...pansData].sort((a, b) => {
            const aVal = a.isApplicable ? 1 : 0;
            const bVal = b.isApplicable ? 1 : 0;
            if (aVal !== bVal) return bVal - aVal; // Eligible first
            return a.panNumber.localeCompare(b.panNumber); // then alphabetical
        });
    }, [pansData, sortEligibleFirst]);

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async (showLoader = true) => {
        try {
            if (showLoader) setLoading(true);
            const [pans, cats] = await Promise.all([
                apiClient.getPanGstr7Data(),
                apiClient.getHsnCategories()
            ]);
            setPansData(pans);
            setCategories(cats);
        } catch (err) {
            setError(err.message);
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    const showSuccess = (msg) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const isValidGstin = (gstin) =>
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.toUpperCase());

    // ── Category assignment ──────────────────────────────────────────────────

    const handleToggleCategory = async (pan, categoryId) => {
        const panObj = pansData.find(p => p.panNumber === pan);
        const newCategoryId = panObj && panObj.categoryId === categoryId ? null : categoryId;
        try {
            setSavingCategory(pan);
            setError(null);
            await apiClient.assignCategoryToPan(pan, newCategoryId);
            showSuccess(newCategoryId ? `Category assigned to PAN ${pan}` : `Category removed from PAN ${pan}`);
            fetchAll(false);
        } catch (err) {
            setError('Failed to update category: ' + err.message);
        } finally {
            setSavingCategory(null);
        }
    };

    // ── Expand PAN / GSTIN config ────────────────────────────────────────────

    const handleExpand = (panObj) => {
        setExpandedPans(prev => {
            const next = new Set(prev);
            if (next.has(panObj.panNumber)) {
                next.delete(panObj.panNumber);
            } else {
                next.add(panObj.panNumber);
                if (!editState[panObj.panNumber]) {
                    const initialState = { gstins: {} };
                    panObj.gstins.forEach(g => {
                        initialState.gstins[g.gstin] = {
                            gstdNo: g.gstdNo || '',
                            status: g.gstr7Status || 'Processing',
                            delayCount: g.gstr7DelayCount ?? 0,
                            missedCount: g.gstr7MissedCount ?? 0
                        };
                    });
                    setEditState(s => ({ ...s, [panObj.panNumber]: initialState }));
                }
            }
            return next;
        });
    };

    const handleExpandAll = () => {
        const newExpanded = new Set();
        const newEditState = { ...editState };
        pansData.forEach(panObj => {
            if (panObj.isApplicable) {
                newExpanded.add(panObj.panNumber);
                if (!newEditState[panObj.panNumber]) {
                    const initialState = { gstins: {} };
                    panObj.gstins.forEach(g => {
                        initialState.gstins[g.gstin] = {
                            gstdNo: g.gstdNo || '',
                            status: g.gstr7Status || 'Processing',
                            delayCount: g.gstr7DelayCount ?? 0,
                            missedCount: g.gstr7MissedCount ?? 0
                        };
                    });
                    newEditState[panObj.panNumber] = initialState;
                }
            }
        });
        setEditState(newEditState);
        setExpandedPans(newExpanded);
    };

    const handleCollapseAll = () => {
        setExpandedPans(new Set());
    };

    const handleGstinChange = (pan, gstin, field, val) => {
        setEditState(prev => ({
            ...prev,
            [pan]: { ...prev[pan], gstins: { ...prev[pan].gstins, [gstin]: { ...prev[pan].gstins[gstin], [field]: val } } }
        }));
    };

    const handleSaveGstd = async (pan, gstin) => {
        try {
            const gState = editState[pan]?.gstins[gstin];
            const newGstd = gState.gstdNo.trim().toUpperCase();
            if (newGstd !== '' && !isValidGstin(newGstd)) throw new Error(`Invalid GSTD format.`);
            setSavingGstd(gstin);
            setError(null);
            await apiClient.markUnmarkGstd(gstin, newGstd);
            showSuccess(`GSTD No. saved for ${gstin}`);
            fetchAll(false);
        } catch (err) { setError('Failed to save GSTD: ' + err.message); }
        finally { setSavingGstd(null); }
    };

    const handleSaveGstinRow = async (pan, g) => {
        try {
            const gState = editState[pan]?.gstins[g.gstin];
            const currentGstd = g.gstdNo || '';
            const newGstd = gState.gstdNo.trim().toUpperCase();
            if (newGstd !== '' && !isValidGstin(newGstd)) throw new Error(`Invalid GSTD format: "${newGstd}".`);
            setSavingGstinRow(g.gstin);
            setError(null);
            if (currentGstd !== newGstd) await apiClient.markUnmarkGstd(g.gstin, newGstd);
            if (newGstd) {
                await apiClient.updateGstr7Status(
                    g.gstin, gState.status,
                    gState.status === 'Regular with Delay' ? parseInt(gState.delayCount || 0, 10) : 0,
                    gState.status === 'Missed' ? parseInt(gState.missedCount || 0, 10) : 0
                );
            }
            showSuccess(`Saved GSTR-7 config for ${g.gstin}`);
            fetchAll(false);
        } catch (err) { setError(err.message); }
        finally { setSavingGstinRow(null); }
    };

    const toggleFilingSection = (gstin) => {
        setOpenFilingGstins(prev => {
            const next = new Set(prev);
            if (next.has(gstin)) next.delete(gstin); else next.add(gstin);
            return next;
        });
    };

    // ── Manage categories ────────────────────────────────────────────────────

    const handleAddCategory = async () => {
        if (!newCatName.trim()) return;
        try {
            setSavingNewCat(true);
            await apiClient.addHsnCategory(newCatName.trim(), newCatDesc.trim());
            setNewCatName(''); setNewCatDesc('');
            showSuccess('Category added');
            fetchAll(false);
        } catch (err) { setError('Failed to add category: ' + err.message); }
        finally { setSavingNewCat(false); }
    };

    const handleDeleteCategory = async (id, name) => {
        if (!window.confirm(`Delete category "${name}"? All its HSN codes will also be removed.`)) return;
        try {
            await apiClient.deleteHsnCategory(id);
            showSuccess('Category deleted');
            fetchAll(false);
        } catch (err) { setError('Failed to delete category: ' + err.message); }
    };

    const handleAddCode = async (categoryId) => {
        const code = (newCodeInputs[categoryId] || '').trim();
        const desc = (newCodeDescInputs[categoryId] || '').trim();
        if (!code) return;
        try {
            setSavingCode(categoryId);
            await apiClient.addCodeToCategory(categoryId, code, desc);
            setNewCodeInputs(prev => ({ ...prev, [categoryId]: '' }));
            setNewCodeDescInputs(prev => ({ ...prev, [categoryId]: '' }));
            showSuccess(`HSN code ${code} added`);
            fetchAll(false);
        } catch (err) { setError('Failed to add code: ' + err.message); }
        finally { setSavingCode(null); }
    };

    const handleRemoveCode = async (categoryId, hsnCode) => {
        if (!window.confirm(`Remove HSN code ${hsnCode}?`)) return;
        try {
            await apiClient.removeCodeFromCategory(categoryId, hsnCode);
            showSuccess(`HSN code ${hsnCode} removed`);
            fetchAll(false);
        } catch (err) { setError('Failed to remove code: ' + err.message); }
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner"></div></div>;
    }

    return (
        <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Settings size={22} /> GSTR-7 Management
                </h3>
                
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {!showManage && pansData.length > 0 && (
                        <>
                            <button 
                                onClick={() => setSortEligibleFirst(!sortEligibleFirst)}
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: sortEligibleFirst ? '#eff6ff' : 'white', color: 'var(--primary-color)', border: '1px solid var(--primary-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {sortEligibleFirst ? '✓ Eligible at Top' : 'Sort: Eligible at Top'}
                            </button>
                            <div style={{ display: 'flex', border: '1px solid var(--primary-color)', borderRadius: '6px', overflow: 'hidden' }}>
                                <button 
                                    onClick={handleExpandAll}
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: expandedPans.size > 0 ? 'var(--primary-color)' : 'white', color: expandedPans.size > 0 ? 'white' : 'var(--primary-color)', border: 'none', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>
                                    Expanded
                                </button>
                                <button 
                                    onClick={handleCollapseAll}
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: expandedPans.size === 0 ? 'var(--primary-color)' : 'white', color: expandedPans.size === 0 ? 'white' : 'var(--primary-color)', border: 'none', cursor: 'pointer', fontWeight: 600, borderLeft: '1px solid var(--primary-color)', transition: 'all 0.2s' }}>
                                    Collapsed
                                </button>
                            </div>
                        </>
                    )}
                    <button className="btn btn-secondary" onClick={() => setShowManage(!showManage)}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                        <Settings size={14} style={{ marginRight: '6px' }} />
                        {showManage ? 'Back to PANs' : 'Manage HSN Categories'}
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ color: 'white', backgroundColor: 'var(--danger-color)', padding: '0.75rem 1rem', borderRadius: 'var(--border-radius)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    {error}
                </div>
            )}
            {successMsg && (
                <div style={{ color: 'white', backgroundColor: 'var(--success-color)', padding: '0.75rem 1rem', borderRadius: 'var(--border-radius)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    {successMsg}
                </div>
            )}

            {showManage ? (
                /* ─── Manage HSN Categories ─── */
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h4 style={{ marginTop: 0, color: 'var(--primary-color)' }}>HSN Categories</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '1.5rem' }}>
                        Group HSN codes into named categories. Each PAN is assigned one category covering all its codes.
                    </p>

                    <div style={{ backgroundColor: 'var(--bg-alt-color)', padding: '1rem', borderRadius: 'var(--border-radius)', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem' }}>Category Name</label>
                            <input type="text" className="form-control" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Scrap" />
                        </div>
                        <div style={{ flex: 2 }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem' }}>Description (Optional)</label>
                            <input type="text" className="form-control" value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)} placeholder="Enter description" />
                        </div>
                        <button className="btn btn-primary" onClick={handleAddCategory} disabled={savingNewCat || !newCatName.trim()} style={{ height: '38px' }}>
                            <Plus size={16} /> Add Category
                        </button>
                    </div>

                    {categories.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)', fontStyle: 'italic' }}>No categories yet. Add one above.</div>
                    ) : categories.map(cat => {
                        const isOpen = expandedCategory === cat.id;
                        return (
                            <div key={cat.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', marginBottom: '0.75rem', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', cursor: 'pointer', backgroundColor: isOpen ? 'rgba(37,150,190,0.07)' : 'var(--bg-alt-color)', borderBottom: isOpen ? '1px solid var(--border-color)' : 'none' }}
                                    onClick={() => setExpandedCategory(isOpen ? null : cat.id)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <Tag size={15} style={{ color: 'var(--primary-color)' }} />
                                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{cat.name}</span>
                                        <span style={{ backgroundColor: 'var(--primary-color)', color: 'white', padding: '0.1rem 0.5rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600 }}>
                                            {(cat.codes || []).length} codes
                                        </span>
                                        {cat.description && <span style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>— {cat.description}</span>}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <button className="btn btn-danger" onClick={e => { e.stopPropagation(); handleDeleteCategory(cat.id, cat.name); }} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                                            <Trash2 size={13} /> Delete
                                        </button>
                                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </div>
                                {isOpen && (
                                    <div style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                                            {(cat.codes || []).length === 0
                                                ? <span style={{ fontSize: '0.82rem', color: 'var(--text-light)', fontStyle: 'italic' }}>No codes yet.</span>
                                                : cat.codes.map(code => (
                                                    <div key={code.hsnCode} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'rgba(37,150,190,0.1)', border: '1px solid rgba(37,150,190,0.3)', borderRadius: '6px', padding: '0.3rem 0.6rem' }}>
                                                        <span style={{ fontWeight: 700, fontSize: '0.85rem', fontFamily: "'Roboto Mono', monospace" }}>{code.hsnCode}</span>
                                                        {code.description && <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{code.description}</span>}
                                                        <button onClick={() => handleRemoveCode(cat.id, code.hsnCode)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color)', padding: 0, lineHeight: 1 }} title="Remove"><Trash2 size={12} /></button>
                                                    </div>
                                                ))}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, marginBottom: '0.25rem' }}>HSN Code</label>
                                                <input type="text" className="form-control" value={newCodeInputs[cat.id] || ''} onChange={e => setNewCodeInputs(prev => ({ ...prev, [cat.id]: e.target.value }))} placeholder="e.g. 7205" style={{ width: '110px', padding: '0.3rem 0.55rem', fontSize: '0.85rem' }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, marginBottom: '0.25rem' }}>Description (Optional)</label>
                                                <input type="text" className="form-control" value={newCodeDescInputs[cat.id] || ''} onChange={e => setNewCodeDescInputs(prev => ({ ...prev, [cat.id]: e.target.value }))} placeholder="Enter description" style={{ padding: '0.3rem 0.55rem', fontSize: '0.85rem' }} />
                                            </div>
                                            <button className="btn btn-primary" onClick={() => handleAddCode(cat.id)} disabled={savingCode === cat.id || !(newCodeInputs[cat.id] || '').trim()} style={{ padding: '0.3rem 0.75rem', fontSize: '0.82rem', height: '34px' }}>
                                                <Plus size={14} /> Add Code
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* ─── PAN list view ─── */
                <div className="card">
                    <div className="gst-table-wrapper" style={{ overflowX: 'auto' }}>
                        <table className="gst-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '50px' }}>#</th>
                                    <th>PAN Number</th>
                                    <th style={{ width: '80px', textAlign: 'center' }}>GSTINs</th>
                                    <th>HSN Category</th>
                                    <th style={{ width: '140px' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedPansData.map((panObj, index) => {
                                    const isExpanded = expandedPans.has(panObj.panNumber);
                                    const currentState = editState[panObj.panNumber];
                                    const assignedCategoryId = panObj.categoryId || null;

                                    return (
                                        <React.Fragment key={panObj.panNumber}>
                                            <tr style={{ backgroundColor: isExpanded ? 'rgba(37,150,190,0.06)' : (index % 2 === 0 ? 'transparent' : 'var(--bg-alt-color)') }}>
                                                <td style={{ color: 'var(--text-light)', fontWeight: 500 }}>{index + 1}</td>
                                                <td style={{ fontWeight: 600, fontFamily: "'Roboto Mono', monospace", fontSize: '0.85rem' }}>{panObj.panNumber}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span style={{ backgroundColor: 'var(--primary-color)', color: 'white', padding: '0.15rem 0.55rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>
                                                        {panObj.gstins.length}
                                                    </span>
                                                </td>
                                                <td>
                                                    {categories.length === 0
                                                        ? <span style={{ fontSize: '0.82rem', color: 'var(--text-light)', fontStyle: 'italic' }}>No categories configured</span>
                                                        : (
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                                                                {categories
                                                                    .filter(cat => assignedCategoryId ? cat.id === assignedCategoryId : true)
                                                                    .map(cat => {
                                                                    const isActive = assignedCategoryId === cat.id;
                                                                    return (
                                                                        <button key={cat.id}
                                                                            onClick={() => handleToggleCategory(panObj.panNumber, cat.id)}
                                                                            disabled={savingCategory === panObj.panNumber}
                                                                            title={(cat.codes || []).length > 0 ? `HSN: ${cat.codes.map(c => c.hsnCode).join(', ')}` : 'No codes'}
                                                                            style={{
                                                                                padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: isActive ? 700 : 500,
                                                                                borderRadius: '20px',
                                                                                border: isActive ? '2px solid var(--primary-color)' : '1.5px solid var(--border-color)',
                                                                                backgroundColor: isActive ? 'var(--primary-color)' : 'transparent',
                                                                                color: isActive ? 'white' : 'var(--text-color)',
                                                                                cursor: 'pointer', transition: 'all 0.15s ease'
                                                                            }}>
                                                                            {isActive && '✓ '}{cat.name}
                                                                            {(cat.codes || []).length > 0 && (
                                                                                <span style={{ marginLeft: '4px', fontSize: '0.7rem', opacity: 0.8 }}>
                                                                                    ({cat.codes.map(c => c.hsnCode).join(', ')})
                                                                                </span>
                                                                            )}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                </td>
                                                <td>
                                                    {panObj.isApplicable ? (
                                                        <button className="btn btn-secondary" onClick={() => handleExpand(panObj)} style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>
                                                            <FileText size={14} />
                                                            {isExpanded ? 'Hide' : 'Manage GSTR-7'}
                                                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                        </button>
                                                    ) : (
                                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontStyle: 'italic' }}>
                                                            {panObj.categoryId ? 'GSTR-7 Not Required' : 'Assign Category'}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>

                                            {/* Expanded GSTR-7 Config Panel */}
                                            {isExpanded && currentState && (
                                                <tr>
                                                    <td colSpan="5" style={{ padding: 0, borderBottom: '2px solid var(--primary-color)' }}>
                                                        <div style={{ backgroundColor: '#f8fbfd', padding: '1.25rem 1.5rem', borderLeft: '3px solid var(--primary-color)' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                                                                <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--primary-color)' }}>
                                                                    GSTR-7 Configuration — PAN {panObj.panNumber}
                                                                </h4>
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', backgroundColor: 'var(--new-item-bg)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                                                                    {panObj.categoryName
                                                                        ? `${panObj.categoryName} — HSN: ${(panObj.hsnCodes || []).join(', ')}`
                                                                        : 'GSTD Applicable'}
                                                                </span>
                                                            </div>

                                                            {/* GSTIN sub-table */}
                                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                                <thead>
                                                                    <tr style={{ backgroundColor: 'rgba(37,150,190,0.08)' }}>
                                                                        {['GSTIN', 'GSTD No.', 'Filing Status', 'Delay Count', 'Missed Count', 'Last Updated', 'Action', 'History'].map((h, i) => (
                                                                            <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: i >= 6 ? 'right' : 'left', fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{h}</th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {panObj.gstins.map((g, gi) => {
                                                                        const gState = currentState.gstins[g.gstin];
                                                                        const savedGstd = g.gstdNo ? String(g.gstdNo) : '';
                                                                        const currentGstd = gState.gstdNo ? String(gState.gstdNo) : '';
                                                                        const hasGstd = savedGstd.trim() !== '';

                                                                        return (
                                                                            <React.Fragment key={g.gstin}>
                                                                                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: gi % 2 === 0 ? 'white' : '#fafcfd', verticalAlign: 'middle' }}>
                                                                                    <td style={{ padding: '0.75rem', fontFamily: "'Roboto Mono', monospace", fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary-color)', whiteSpace: 'nowrap' }}>
                                                                                        {g.gstin}
                                                                                    </td>
                                                                                    <td style={{ padding: '0.75rem' }}>
                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                                            <button 
                                                                                                onClick={() => handleGstinChange(panObj.panNumber, g.gstin, 'gstdNo', currentGstd === g.gstin ? '' : g.gstin)}
                                                                                                style={{
                                                                                                    padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 600,
                                                                                                    borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
                                                                                                    backgroundColor: currentGstd === g.gstin ? '#10b981' : 'transparent',
                                                                                                    color: currentGstd === g.gstin ? 'white' : 'var(--primary-color)',
                                                                                                    border: `1.5px solid ${currentGstd === g.gstin ? '#10b981' : 'var(--primary-color)'}`
                                                                                                }}>
                                                                                                {currentGstd === g.gstin ? '✓ Marked as GSTD' : 'Mark as GSTD'}
                                                                                            </button>
                                                                                            {currentGstd !== savedGstd && (
                                                                                                <button className="btn btn-primary" onClick={() => handleSaveGstd(panObj.panNumber, g.gstin)} disabled={savingGstd === g.gstin} title="Confirm & Save" style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}>
                                                                                                    <Save size={13} />
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    </td>
                                                                                    <td style={{ padding: '0.75rem' }}>
                                                                                        {hasGstd ? (
                                                                                            <select className="form-control" value={gState.status} onChange={e => handleGstinChange(panObj.panNumber, g.gstin, 'status', e.target.value)} style={{ width: '130px', padding: '0.35rem 0.5rem', fontSize: '0.83rem' }}>
                                                                                                <option value="Regular without delay">✅ Regular</option>
                                                                                                <option value="Regular with Delay">⚠️ Delayed</option>
                                                                                                <option value="Missed">❌ Missed</option>
                                                                                            </select>
                                                                                        ) : (
                                                                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontStyle: 'italic' }}>Mark as GSTD first</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td style={{ padding: '0.75rem' }}>
                                                                                        {g.gstr7Status === 'Processing' || g.gstr7Status === 'NA' ? (
                                                                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 600 }}>NA</span>
                                                                                        ) : hasGstd && gState.status === 'Regular with Delay' ? (
                                                                                            <input type="number" className="form-control" min="0" value={gState.delayCount} onChange={e => handleGstinChange(panObj.panNumber, g.gstin, 'delayCount', e.target.value)} style={{ width: '70px', padding: '0.35rem 0.5rem', fontSize: '0.83rem' }} />
                                                                                        ) : (
                                                                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{g.gstr7DelayCount ?? '—'}</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td style={{ padding: '0.75rem' }}>
                                                                                        {g.gstr7Status === 'Processing' || g.gstr7Status === 'NA' ? (
                                                                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 600 }}>NA</span>
                                                                                        ) : hasGstd && gState.status === 'Missed' ? (
                                                                                            <input type="number" className="form-control" min="0" value={gState.missedCount} onChange={e => handleGstinChange(panObj.panNumber, g.gstin, 'missedCount', e.target.value)} style={{ width: '70px', padding: '0.35rem 0.5rem', fontSize: '0.83rem' }} />
                                                                                        ) : (
                                                                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{g.gstr7MissedCount ?? '—'}</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td style={{ padding: '0.75rem', fontSize: '0.75rem', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                                                                                        {g.gstr7LastUpdated ? new Date(g.gstr7LastUpdated).toLocaleString() : <span style={{ fontStyle: 'italic' }}>Never</span>}
                                                                                    </td>
                                                                                    <td style={{ padding: '0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                                                        <button className="btn btn-primary" onClick={() => handleSaveGstinRow(panObj.panNumber, g)} disabled={savingGstinRow === g.gstin} style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                                                                            {savingGstinRow === g.gstin
                                                                                                ? <><span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px', marginRight: '4px' }}></span>Saving...</>
                                                                                                : <><Save size={13} style={{ marginRight: '4px' }} />Save Config</>}
                                                                                        </button>
                                                                                    </td>
                                                                                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                                                                        <button
                                                                                            title="Import / View Filing History"
                                                                                            onClick={() => setModalGstin(g.gstin)}
                                                                                            style={{
                                                                                                padding: '0.3rem 0.65rem', fontSize: '0.78rem', borderRadius: '4px',
                                                                                                border: '1.5px solid var(--primary-color)',
                                                                                                backgroundColor: 'transparent', color: 'var(--primary-color)',
                                                                                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap'
                                                                                            }}>
                                                                                            <Plus size={13} /> Import
                                                                                        </button>
                                                                                    </td>
                                                                                </tr>
                                                                            </React.Fragment>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>

                        {pansData.length === 0 && !loading && (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-light)', borderTop: '1px solid var(--border-color)' }}>
                                No PAN records available.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Filing History Modal ── */}
            {modalGstin && (
                <FilingModal
                    gstin={modalGstin}
                    onClose={() => setModalGstin(null)}
                    onSaved={() => fetchAll(false)}
                />
            )}
        </div>
    );
};

export default Gstr7Management;
