import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { Save, ChevronDown, ChevronUp, FileText, Settings, Plus, History, Sparkles, ClipboardList, Copy, Check, X } from 'lucide-react';
import Gstr7ReviewPage from './Gstr7ReviewPage';
import GstCard from './GstCard';

// ── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
    const cfg = {
        'Regular without delay': { bg: '#d4edda', color: '#155724', label: '✓ Regular' },
        'Regular with Delay':    { bg: '#fff3cd', color: '#856404', label: '⚠ Regular with delay' },
        'Missed':                { bg: '#f8d7da', color: '#721c24', label: '✕ Missed' },
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
    const [pendingReviews, setPendingReviews] = useState([]);
    const [approvingReviewId, setApprovingReviewId] = useState(null);
    const [rejectingReviewId, setRejectingReviewId] = useState(null);

    // Manual entry state
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [manualStatus, setManualStatus] = useState('Regular without delay');
    const [manualDelayCount, setManualDelayCount] = useState(0);
    const [manualMissedCount, setManualMissedCount] = useState(0);
    const [savingManual, setSavingManual] = useState(false);

    const savedUser = JSON.parse(localStorage.getItem('grc_user') || '{}');
    const isSuperAdmin = savedUser.role === 'super_admin';

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        const loadData = async () => {
            try {
                const hist = await apiClient.getGstr7FilingDetails(gstin);
                setHistory(hist);
                // Only fetch reviews if super_admin and no history
                if (isSuperAdmin && (!hist || hist.length === 0)) {
                    const reviews = await apiClient.getReviewsForGstin(gstin);
                    setPendingReviews(reviews.filter(r => r.status === 'PENDING'));
                }
            } catch {
                setHistory([]);
            } finally {
                setLoadingHistory(false);
            }
        };
        loadData();
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
        setParsing(true);
        setPreview(null);
        setErr('');
        try {
            const data = await apiClient.parseGstr7Filing(gstin, text);
            if (!data || !data.items || data.items.length === 0) { 
                showMsg('AI could not extract any records. Check the pasted text.', true); 
                return; 
            }
            setPreview(data);
        } catch (e) { 
            showMsg('AI parsing failed: ' + e.message, true); 
        }
        finally { setParsing(false); }
    };

    const handleSave = async () => {
        if (!preview || !preview.items) return;
        setSaving(true);
        try {
            const records = preview.items.map(p => ({ returnPeriod: p.returnPeriod, dateOfFiling: p.dateOfFiling }));
            await apiClient.saveGstr7Filing(gstin, records);
            const updated = await apiClient.getGstr7FilingDetails(gstin);
            setHistory(updated);
            setPreview(null);
            setText('');
            showMsg('Filing history saved and status recalculated.');
            if (onSaved) onSaved();
            onClose();
        } catch (e) {
            showMsg('Save failed: ' + e.message, true);
        } finally {
            setSaving(false);
        }
    };
    const handleSaveManual = async () => {
        setSavingManual(true);
        try {
            await apiClient.updateGstr7Status(
                gstin,
                manualStatus,
                manualStatus === 'Regular with Delay' ? parseInt(manualDelayCount || 0, 10) : 0,
                manualStatus === 'Missed' ? parseInt(manualMissedCount || 0, 10) : 0
            );
            showMsg('Status saved successfully!');
            if (onSaved) onSaved();
            setShowManualEntry(false);
            onClose();
        } catch (e) { showMsg('Save failed: ' + e.message, true); }
        finally { setSavingManual(false); }
    };

    const handleApproveReview = async (review) => {
        setApprovingReviewId(review.id);
        try {
            const records = JSON.parse(review.recordsJson || '[]');
            await apiClient.approveReview(review.id, records);
            setPendingReviews(prev => prev.filter(r => r.id !== review.id));
            const updated = await apiClient.getGstr7FilingDetails(gstin);
            setHistory(updated);
            showMsg('Review approved and filing saved successfully!');
            if (onSaved) onSaved();
        } catch (e) { showMsg('Approval failed: ' + e.message, true); }
        finally { setApprovingReviewId(null); }
    };

    const handleRejectReview = async (id) => {
        setRejectingReviewId(id);
        try {
            await apiClient.rejectReview(id);
            setPendingReviews(prev => prev.filter(r => r.id !== id));
            showMsg('Review rejected and removed.');
        } catch (e) { showMsg('Rejection failed: ' + e.message, true); }
        finally { setRejectingReviewId(null); }
    };

    const fmtPeriod = (rp) => {
        const ym = rp ? rp.split('-') : [];
        return ym.length === 2
            ? new Date(+ym[0], +ym[1] - 1).toLocaleString('default', { month: 'long' }) + ' ' + ym[0].substring(2)
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
                                                    {r.status === 'Regular without delay' ? '✓ Regular' : r.status === 'Regular with Delay' ? '⚠ Regular with delay' : r.status === 'Missed' ? '✕ Missed' : r.status || '—'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : pendingReviews.length > 0 ? (
                        /* ── Pending Review Section (super_admin only, no history) ── */
                        <div style={{ marginBottom: '1.5rem' }}>
                            {pendingReviews.map(review => {
                                const records = (() => { try { return JSON.parse(review.recordsJson || '[]'); } catch { return []; } })();
                                return (
                                    <div key={review.id} style={{ border: '1.5px solid #f59e0b', borderRadius: '10px', overflow: 'hidden', marginBottom: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1rem', backgroundColor: '#fef3c7' }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                ⏳ PENDING REVIEW — submitted by <strong>{review.submittedBy || 'user'}</strong>
                                            </span>
                                            <span style={{ fontSize: '0.72rem', color: '#b45309' }}>{review.createdAt ? new Date(review.createdAt).toLocaleString() : ''}</span>
                                        </div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#fffbeb' }}>
                                                    {['Period', 'Filed On'].map(h => (
                                                        <th key={h} style={{ padding: '0.4rem 0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', color: '#92400e', textTransform: 'uppercase' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {records.map((r, i) => (
                                                    <tr key={r.returnPeriod} style={{ borderBottom: '1px solid #fde68a', backgroundColor: i % 2 === 0 ? 'white' : '#fffbeb' }}>
                                                        <td style={{ padding: '0.4rem 0.75rem', fontWeight: 600 }}>{fmtPeriod(r.returnPeriod)}</td>
                                                        <td style={{ padding: '0.4rem 0.75rem' }}>{r.dateOfFiling || <span style={{ fontStyle: 'italic', color: 'var(--text-light)' }}>Not Filed</span>}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div style={{ display: 'flex', gap: '0.5rem', padding: '0.6rem 0.75rem', backgroundColor: '#fffbeb', borderTop: '1px solid #fde68a' }}>
                                            <button
                                                onClick={() => handleApproveReview(review)}
                                                disabled={approvingReviewId === review.id}
                                                style={{ padding: '0.35rem 0.9rem', fontSize: '0.78rem', fontWeight: 600, background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                {approvingReviewId === review.id ? <><span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }}></span>Approving...</> : '✓ Approve & Save'}
                                            </button>
                                            <button
                                                onClick={() => handleRejectReview(review.id)}
                                                disabled={rejectingReviewId === review.id}
                                                style={{ padding: '0.35rem 0.9rem', fontSize: '0.78rem', fontWeight: 600, background: 'transparent', color: '#ef4444', border: '1.5px solid #ef4444', borderRadius: '6px', cursor: 'pointer' }}
                                            >
                                                {rejectingReviewId === review.id ? 'Rejecting...' : '✕ Reject'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
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
                                {parsing ? <><span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></span>Submitting...</> : <><Sparkles size={15} />Submit</>}
                            </button>
                        </div>

                        {/* ── Fill Manually (fallback) ── */}
                        <div style={{ marginTop: '1rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.9rem' }}>
                            <button
                                onClick={() => setShowManualEntry(v => !v)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1.5px solid #6b7280', borderRadius: '8px', padding: '0.4rem 0.9rem', fontSize: '0.82rem', fontWeight: 600, color: '#374151', cursor: 'pointer', transition: 'all 0.15s' }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                {showManualEntry ? 'Hide Manual Entry' : 'Fill Manually (AI Fallback)'}
                            </button>

                            {showManualEntry && (
                                <div style={{ marginTop: '0.9rem', backgroundColor: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '10px', padding: '1rem 1.25rem' }}>
                                    <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.9rem' }}>
                                        ✎ Manual Entry — Set Status Directly
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                        {/* Filing Status */}
                                        <div style={{ flex: 1, minWidth: '180px' }}>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>Filing Status</label>
                                            <select
                                                value={manualStatus}
                                                onChange={e => setManualStatus(e.target.value)}
                                                style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.84rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer' }}
                                            >
                                                <option value="Regular without delay">✓ Regular without delay</option>
                                                <option value="Regular with Delay">⚠ Regular with Delay</option>
                                                <option value="Missed">✕ Missed</option>
                                                <option value="NA">N/A</option>
                                            </select>
                                        </div>
                                        {/* Delay Count — always visible */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>Delay Count</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={manualDelayCount}
                                                onChange={e => setManualDelayCount(e.target.value)}
                                                style={{ width: '90px', padding: '0.45rem 0.6rem', fontSize: '0.84rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: 'white' }}
                                            />
                                        </div>
                                        {/* Missed Count — always visible */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>Missed Count</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={manualMissedCount}
                                                onChange={e => setManualMissedCount(e.target.value)}
                                                style={{ width: '90px', padding: '0.45rem 0.6rem', fontSize: '0.84rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: 'white' }}
                                            />
                                        </div>
                                        {/* Save */}
                                        <button
                                            onClick={handleSaveManual}
                                            disabled={savingManual}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.45rem 1.1rem', fontSize: '0.84rem', fontWeight: 700, backgroundColor: '#0f766e', color: 'white', border: 'none', borderRadius: '8px', cursor: savingManual ? 'not-allowed' : 'pointer', opacity: savingManual ? 0.7 : 1, transition: 'opacity 0.15s', whiteSpace: 'nowrap' }}
                                        >
                                            {savingManual
                                                ? <><span className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }}></span>Saving...</>
                                                : <><Save size={14} />Save Manual Entry</>}
                                        </button>
                                    </div>
                                </div>
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
                                                            {p.status === 'Regular without delay' ? '✓ Regular' : p.status === 'Regular with Delay' ? '⚠ Regular with delay' : p.status === 'Missed' ? '✕ Missed' : p.status || '—'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                                    <button onClick={() => setPreview(null)} style={{ background: 'none', border: '1px solid #9ca3af', padding: '0.4rem 0.9rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600, color: '#4b5563' }}>Cancel</button>
                                    <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.4rem 1.1rem', backgroundColor: '#1d4ed8', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                                        {saving ? <><span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }}></span>Saving...</> : <><Save size={14} />Confirm & Save</>}
                                    </button>
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
                    <button
                        className="btn btn-secondary"
                        onClick={async () => {
                            if (!text.trim()) return;
                            try {
                                await apiClient.parseAndSaveGstr7FilingAsync(gstin, text);
                                onClose(); // Close out of this section
                            } catch (e) {
                                showMsg('Async Start Failed: ' + e.message, true);
                            }
                        }}
                        disabled={parsing || !text.trim()}
                        style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem', backgroundColor: '#eef2f6', color: '#333' }}
                    >
                        <Save size={14} style={{ marginRight: '5px' }} /> Close & Auto Save (Background)
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

// ── Module-level cache (survives re-navigation without page refresh) ──────────
let _cachedPans = null;

// ── Main component ────────────────────────────────────────────────────────────

const Gstr7Management = ({ isTab }) => {
    const { state } = useLocation();
    const initialSearchQuery = state?.searchQuery || '';
    const savedUser = JSON.parse(localStorage.getItem('grc_user') || '{}');
    const isSuperAdmin = savedUser.role === 'super_admin';

    const [activeTab, setActiveTab] = useState('pans');
    const [pansData, setPansData] = useState(_cachedPans || []);
    const [loading, setLoading] = useState(!_cachedPans);
    const [error, setError] = useState(null);
    const [expandedPans, setExpandedPans] = useState(new Set());
    const [editState, setEditState] = useState({});
    const [savingTdsStatus, setSavingTdsStatus] = useState(null);
    const [savingGstd, setSavingGstd] = useState(null);
    const [savingGstinRow, setSavingGstinRow] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');
    const [sortEligibleFirst, setSortEligibleFirst] = useState(true);
    const [sortByNewest, setSortByNewest] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state for filing history
    const [modalGstin, setModalGstin] = useState(null);

    // Modal state for GST Card
    const [cardModalGstin, setCardModalGstin] = useState(null);
    const [cardModalData, setCardModalData] = useState(null);
    const [loadingCard, setLoadingCard] = useState(false);

    const handleOpenCardModal = async (gstin) => {
        setCardModalGstin(gstin);
        setLoadingCard(true);
        try {
            const data = await apiClient.getGstDetailsAdmin(gstin);
            setCardModalData(data);
        } catch (err) {
            console.error('Failed to load card details', err);
        } finally {
            setLoadingCard(false);
        }
    };
    const [copiedPans, setCopiedPans] = useState({});
    const [highlightedPan, setHighlightedPan] = useState(null);
    const rowRefs = React.useRef({});

    const handleCopyPan = (e, pan) => {
        e.stopPropagation();
        navigator.clipboard.writeText(pan);
        setCopiedPans(prev => ({ ...prev, [pan]: true }));
        setTimeout(() => setCopiedPans(prev => ({ ...prev, [pan]: false })), 2000);
    };

    const sortedPansData = React.useMemo(() => {
        let data;
        if (highlightedPan) {
            // Freeze sort order while a row is highlighted (prevents row from jumping)
            data = [...pansData].sort((a, b) => a.panNumber.localeCompare(b.panNumber));
        } else if (sortByNewest) {
            data = [...pansData].sort((a, b) => {
                const getMaxDate = (panObj) => {
                    let max = 0;
                    (panObj.gstins || []).forEach(g => {
                        if (g.createdAt) {
                            const t = new Date(g.createdAt).getTime();
                            if (t > max) max = t;
                        }
                    });
                    return max;
                };
                return getMaxDate(b) - getMaxDate(a); // newest first
            });
        } else if (sortEligibleFirst) {
            data = [...pansData].sort((a, b) => {
                const aVal = a.isApplicable ? 1 : 0;
                const bVal = b.isApplicable ? 1 : 0;
                if (aVal !== bVal) return bVal - aVal; // Eligible first
                return a.panNumber.localeCompare(b.panNumber); // then alphabetical
            });
        } else {
            data = pansData;
        }
        // Apply search filter (PAN or any GSTIN, Trade Name, Legal Name)
        if (!searchQuery.trim()) return data;
        const q = searchQuery.trim().toUpperCase();
        return data.filter(panObj =>
            panObj.panNumber?.toUpperCase().includes(q) ||
            (panObj.gstins || []).some(g => 
                g.gstin?.toUpperCase().includes(q) ||
                g.tradeName?.toUpperCase().includes(q) ||
                g.legalName?.toUpperCase().includes(q)
            )
        );
    }, [pansData, sortEligibleFirst, sortByNewest, highlightedPan, searchQuery]);

    useEffect(() => { fetchAll(); }, []);

    useEffect(() => {
        if (initialSearchQuery) {
            setSearchQuery(initialSearchQuery);
            setExpandedPans(new Set([initialSearchQuery]));
            setHighlightedPan(initialSearchQuery);
            setTimeout(() => {
                rowRefs.current[initialSearchQuery]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 600);
        }
    }, [initialSearchQuery]);

    const fetchAll = async (showLoader = true) => {
        try {
            if (showLoader && !_cachedPans) setLoading(true);
            const pans = await apiClient.getPanGstr7Data();
            console.log('[GSTR7] Total PANs:', pans.length, '| Applicable:', pans.filter(p => p.isApplicable).map(p => p.panNumber));
            _cachedPans = pans;
            setPansData(pans);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const showSuccess = (msg) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const isValidGstin = (gstin) =>
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.toUpperCase());

    const isValidGstd = (gstd) =>
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]D[0-9A-Z]$/.test(gstd.toUpperCase());

    const getGstdValidationMessage = (gstd) => {
        if (!gstd) return '';
        const val = gstd.toUpperCase();
        if (val.length !== 15) return "Must be exactly 15 characters.";
        if (!/^[0-9]{2}/.test(val)) return "First two characters must be numbers (State Code).";
        if (!/^[0-9]{2}[A-Z]{5}/.test(val)) return "Characters 3-7 must be letters (PAN).";
        if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}/.test(val)) return "Characters 8-11 must be numbers.";
        if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]/.test(val)) return "Character 12 must be a letter.";
        if (val.charAt(13) !== 'D') return "The 14th character (second to last) must be 'D'.";
        if (!isValidGstd(val)) return "Invalid TDS no format.";
        return '';
    };

    // ── TDS Status toggle ────────────────────────────────────────────────────

    const handleSetTdsStatus = async (pan, isApplicable) => {
        // Optimistic UI update
        setPansData(prev => prev.map(p => p.panNumber === pan ? { ...p, isApplicable } : p));

        try {
            setSavingTdsStatus(pan);
            setError(null);
            setHighlightedPan(pan);
            setSortEligibleFirst(false);

            await apiClient.setTdsApplicable(pan, isApplicable);
            showSuccess(`TDS Status ${isApplicable ? 'enabled' : 'disabled'} for PAN ${pan}`);
            await fetchAll(false);

            setTimeout(() => {
                rowRefs.current[pan]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        } catch (err) {
            setError('Failed to update TDS status: ' + err.message);
            fetchAll(false);
            setHighlightedPan(null);
        } finally {
            setSavingTdsStatus(null);
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
                            status: g.gstr7Status || 'NA',
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
                            status: g.gstr7Status || 'NA',
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
            if (newGstd !== '' && !isValidGstd(newGstd)) throw new Error(`Invalid TDS no format. Must end with 'D' followed by one character.`);
            setSavingGstd(gstin);
            setError(null);
            await apiClient.markUnmarkGstd(gstin, newGstd);
            showSuccess(`TDS no saved for ${gstin}`);
            fetchAll(false);
        } catch (err) { setError('Failed to save TDS no: ' + err.message); }
        finally { setSavingGstd(null); }
    };

    const handleSaveGstinRow = async (pan, g) => {
        try {
            const gState = editState[pan]?.gstins[g.gstin];
            const currentGstd = g.gstdNo || '';
            const newGstd = gState.gstdNo.trim().toUpperCase();
            if (newGstd !== '' && !isValidGstd(newGstd)) throw new Error(`Invalid TDS no format: "${newGstd}". Must end with 'D' followed by one character.`);
            setSavingGstinRow(g.gstin);
            setError(null);
            if (currentGstd !== newGstd) await apiClient.markUnmarkGstd(g.gstin, newGstd);
            
            await apiClient.updateGstr7Status(
                g.gstin, gState.status,
                gState.status === 'Regular with Delay' ? parseInt(gState.delayCount || 0, 10) : 0,
                gState.status === 'Missed' ? parseInt(gState.missedCount || 0, 10) : 0
            );
            showSuccess(`Saved GSTR-7 config for ${g.gstin}`);
            fetchAll(false);
        } catch (err) { setError(err.message); }
        finally { setSavingGstinRow(null); }
    };


    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner"></div></div>;
    }

    if (activeTab === 'reviews' && isSuperAdmin) {
        return (
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button
                        onClick={() => setActiveTab('pans')}
                        style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', background: 'transparent', color: 'var(--text-light)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                    >
                        ← Back to PAN Management
                    </button>
                    <h3 style={{ margin: 0, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ClipboardList size={20} /> GSTR-7 Pending Reviews
                    </h3>
                </div>
                <Gstr7ReviewPage />
            </div>
        );
    }

    return (
        <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                {!isTab ? (
                    <h3 style={{ margin: 0, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Settings size={22} /> GSTR-7 Management
                    </h3>
                ) : <div />}
                
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {pansData.length > 0 && (
                        <>
                            <button 
                                onClick={() => {
                                    setSortEligibleFirst(!sortEligibleFirst);
                                    if (!sortEligibleFirst) setSortByNewest(false);
                                }}
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: sortEligibleFirst ? '#eff6ff' : 'white', color: 'var(--primary-color)', border: '1px solid var(--primary-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {sortEligibleFirst ? '✓ Eligible at Top' : 'Sort: Eligible at Top'}
                            </button>
                            <button 
                                onClick={() => {
                                    setSortByNewest(!sortByNewest);
                                    if (!sortByNewest) setSortEligibleFirst(false);
                                }}
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: sortByNewest ? '#eff6ff' : 'white', color: 'var(--primary-color)', border: '1px solid var(--primary-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {sortByNewest ? '✓ Newest First' : 'Sort: Newest First'}
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
                    {isSuperAdmin && (
                        <button
                            onClick={() => setActiveTab('reviews')}
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', borderColor: '#7c3aed', color: '#5b21b6' }}
                        >
                            <ClipboardList size={14} style={{ marginRight: '6px' }} />
                            Pending Reviews
                        </button>
                    )}
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

            {(
                /* ─── PAN list view ─── */
                <div className="card">
                    {/* ── Search bar ── */}
                    <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input
                                id="gstr7-search"
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search by PAN, GSTIN, Trade or Legal Name…"
                                style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '2.1rem', paddingRight: searchQuery ? '2rem' : '0.75rem', paddingTop: '0.4rem', paddingBottom: '0.4rem', fontSize: '0.85rem', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none', backgroundColor: 'var(--bg-alt-color)', color: 'var(--text-color)', transition: 'border-color 0.2s' }}
                                onFocus={e => e.target.style.borderColor = 'var(--primary-color)'}
                                onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', fontSize: '1rem', lineHeight: 1, padding: 0 }} title="Clear">✕</button>
                            )}
                        </div>
                        {searchQuery && (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 500 }}>
                                {sortedPansData.length} result{sortedPansData.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <div className="gst-table-wrapper" style={{ overflowX: 'auto' }}>
                        <table className="gst-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '50px' }}>#</th>
                                    <th>PAN Number</th>
                                    <th style={{ minWidth: '220px', textAlign: 'left' }}>GSTINs</th>
                                    <th style={{ width: '160px' }}>TDS Status</th>
                                    <th style={{ width: '180px' }}>TDS No.</th>
                                    <th style={{ width: '140px' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedPansData.map((panObj, index) => {
                                    const isExpanded = expandedPans.has(panObj.panNumber);
                                    const currentState = editState[panObj.panNumber];

                                    return (
                                        <React.Fragment key={panObj.panNumber}>
                                            <tr 
                                                ref={el => rowRefs.current[panObj.panNumber] = el}
                                                style={{ 
                                                    backgroundColor: highlightedPan === panObj.panNumber 
                                                        ? '#e0f2fe' 
                                                        : isExpanded ? 'rgba(37,150,190,0.06)' : (index % 2 === 0 ? 'transparent' : 'var(--bg-alt-color)'),
                                                    transition: 'background-color 0.5s ease',
                                                    boxShadow: highlightedPan === panObj.panNumber ? 'inset 3px 0 0 var(--primary-color)' : 'none'
                                                }}>
                                                <td style={{ color: 'var(--text-light)', fontWeight: 500 }}>{index + 1}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <div style={{ fontWeight: 600, fontFamily: "'Roboto Mono', monospace", fontSize: '0.85rem' }}>{panObj.panNumber}</div>
                                                        <button
                                                            className="ghost-btn"
                                                            onClick={(e) => handleCopyPan(e, panObj.panNumber)}
                                                            title="Copy PAN"
                                                            style={{ padding: '0.15rem', color: 'var(--text-light)', display: 'inline-flex', border: 'none', background: 'transparent', cursor: 'pointer' }}
                                                        >
                                                            {copiedPans[panObj.panNumber] ? <Check size={13} color="var(--success-color)" /> : <Copy size={13} />}
                                                        </button>
                                                    </div>
                                                    {panObj.companyName && (
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }} title={panObj.companyName}>
                                                            {panObj.companyName}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ verticalAlign: 'top', paddingTop: '0.5rem' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                                        {/* Count badge when PAN has multiple GSTINs */}
                                                        {panObj.gstins.length > 1 && (
                                                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '-0.2rem' }}>
                                                                {panObj.gstins.length} GSTINs
                                                            </div>
                                                        )}
                                                        {/* Show ALL GSTINs; highlight the one(s) matching search */}
                                                        {panObj.gstins.map(g => {
                                                            const isMatch = searchQuery.trim() &&
                                                                g.gstin?.toUpperCase().includes(searchQuery.trim().toUpperCase());
                                                            return (
                                                                <div key={g.gstin} style={{
                                                                    display: 'flex', flexDirection: 'column',
                                                                    padding: '0.4rem 0.6rem',
                                                                    border: isMatch ? '1.5px solid var(--primary-color)' : '1px solid var(--border-color)',
                                                                    borderRadius: '6px',
                                                                    background: isMatch ? 'rgba(37,150,190,0.08)' : 'white',
                                                                    transition: 'background 0.2s, border-color 0.2s'
                                                                }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                                                                        <span 
                                                                            onClick={() => handleOpenCardModal(g.gstin)}
                                                                            title="View Details"
                                                                            style={{ 
                                                                                fontWeight: 600, 
                                                                                fontFamily: "'Roboto Mono', monospace", 
                                                                                fontSize: '0.8rem', 
                                                                                color: isMatch ? 'var(--primary-color)' : 'var(--primary-color)',
                                                                                cursor: 'pointer',
                                                                                textDecoration: 'underline',
                                                                                textUnderlineOffset: '2px'
                                                                            }}
                                                                        >{g.gstin}</span>
                                                                        {isMatch && <span style={{ fontSize: '0.65rem', backgroundColor: 'var(--primary-color)', color: 'white', padding: '0.05rem 0.35rem', borderRadius: '8px', fontWeight: 700 }}>match</span>}
                                                                        <button className="ghost-btn" onClick={(e) => handleCopyPan(e, g.gstin)} title="Copy GSTIN" style={{ padding: '0.15rem', color: 'var(--text-light)', border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex' }}>
                                                                            {copiedPans[g.gstin] ? <Check size={13} color="var(--success-color)" /> : <Copy size={13} />}
                                                                        </button>
                                                                    </div>
                                                                    {g.tradeName && g.tradeName !== panObj.companyName && <div style={{ fontSize: '0.75rem', color: 'var(--text-color)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }} title={g.tradeName}>{g.tradeName}</div>}
                                                                    {g.legalName && g.legalName !== panObj.companyName && g.legalName !== g.tradeName && <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }} title={g.legalName}>{g.legalName}</div>}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                        <button
                                                            onClick={() => handleSetTdsStatus(panObj.panNumber, true)}
                                                            disabled={savingTdsStatus === panObj.panNumber}
                                                            style={{
                                                                padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 700,
                                                                borderRadius: '20px',
                                                                border: panObj.isApplicable === true ? '2px solid #16a34a' : '1.5px solid var(--border-color)',
                                                                backgroundColor: panObj.isApplicable === true ? '#16a34a' : 'transparent',
                                                                color: panObj.isApplicable === true ? 'white' : 'var(--text-color)',
                                                                cursor: savingTdsStatus === panObj.panNumber ? 'not-allowed' : 'pointer',
                                                                transition: 'all 0.15s ease',
                                                                opacity: savingTdsStatus === panObj.panNumber ? 0.6 : 1
                                                            }}>
                                                            {panObj.isApplicable === true ? '✓ Yes' : 'Yes'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleSetTdsStatus(panObj.panNumber, false)}
                                                            disabled={savingTdsStatus === panObj.panNumber}
                                                            style={{
                                                                padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 700,
                                                                borderRadius: '20px',
                                                                border: panObj.isApplicable === false ? '2px solid #dc2626' : '1.5px solid var(--border-color)',
                                                                backgroundColor: panObj.isApplicable === false ? '#dc2626' : 'transparent',
                                                                color: panObj.isApplicable === false ? 'white' : 'var(--text-color)',
                                                                cursor: savingTdsStatus === panObj.panNumber ? 'not-allowed' : 'pointer',
                                                                transition: 'all 0.15s ease',
                                                                opacity: savingTdsStatus === panObj.panNumber ? 0.6 : 1
                                                            }}>
                                                            {panObj.isApplicable === false ? '✓ No' : 'No'}
                                                        </button>
                                                    </div>
                                                </td>
                                                <td>
                                                    {(() => {
                                                        const tdsNos = [...new Set(
                                                            (panObj.gstins || [])
                                                                .map(g => g.gstdNo)
                                                                .filter(no => no && no.trim() !== '')
                                                        )];
                                                        if (panObj.isApplicable && tdsNos.length > 0) {
                                                            return (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                                                    {tdsNos.map(tdsNo => (
                                                                        <div key={tdsNo} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                            <span style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-color)' }}>
                                                                                {tdsNo}
                                                                            </span>
                                                                            <button
                                                                                className="ghost-btn"
                                                                                onClick={(e) => handleCopyPan(e, tdsNo)}
                                                                                title="Copy TDS No"
                                                                                style={{ padding: '0.15rem', color: 'var(--text-light)', display: 'inline-flex', border: 'none', background: 'transparent', cursor: 'pointer' }}
                                                                            >
                                                                                {copiedPans[tdsNo] ? <Check size={13} color="var(--success-color)" /> : <Copy size={13} />}
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
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
                                                            GSTR-7 Not Required
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>

                                            {/* Expanded GSTR-7 Config Panel */}
                                            {isExpanded && currentState && (
                                                <tr>
                                                    <td colSpan="6" style={{ padding: 0, borderBottom: '2px solid #ef4444' }}>
                                                        <div style={{ backgroundColor: '#f8fbfd', padding: '1.25rem 1.5rem', borderLeft: '3px solid #ef4444' }}>
                                                            <div style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                                                <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#b91c1c' }}>
                                                                    GSTR-7 Configuration — PAN {panObj.panNumber}
                                                                </h4>
                                                            </div>

                                                            {/* GSTIN sub-table */}
                                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                                <thead>
                                                                    <tr style={{ backgroundColor: 'rgba(37,150,190,0.08)' }}>
                                                                        {['GSTIN', 'TDS no', 'Filing Status', 'Delay Count', 'Missed Count', 'Last Updated', 'Action', 'History'].map((h, i) => (
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
                                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                                                <input 
                                                                                                    type="text" 
                                                                                                    className="form-control" 
                                                                                                    placeholder="Enter TDS no" 
                                                                                                    value={currentGstd} 
                                                                                                    onChange={e => handleGstinChange(panObj.panNumber, g.gstin, 'gstdNo', e.target.value)}
                                                                                                    style={{ width: '150px', padding: '0.35rem 0.5rem', fontSize: '0.83rem', fontFamily: "'Roboto Mono', monospace", border: (currentGstd !== '' && !isValidGstd(currentGstd)) ? '2px solid #ef4444' : '1px solid var(--border-color)' }}
                                                                                                />
                                                                                                {currentGstd !== savedGstd && (
                                                                                                    <button className="btn btn-primary" onClick={() => handleSaveGstd(panObj.panNumber, g.gstin)} disabled={savingGstd === g.gstin || (currentGstd !== '' && !isValidGstd(currentGstd))} title="Confirm & Save" style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}>
                                                                                                        <Save size={13} />
                                                                                                    </button>
                                                                                                )}
                                                                                            </div>
                                                                                            {currentGstd !== '' && !isValidGstd(currentGstd) && (
                                                                                                <span style={{ color: '#ef4444', fontSize: '0.65rem', lineHeight: 1.1, maxWidth: '180px' }}>{getGstdValidationMessage(currentGstd)}</span>
                                                                                            )}
                                                                                        </div>
                                                                                    </td>
                                                                                    <td style={{ padding: '0.75rem' }}>
                                                                                        {hasGstd ? (
                                                                                            <select className="form-control" value={gState.status} onChange={e => handleGstinChange(panObj.panNumber, g.gstin, 'status', e.target.value)} style={{ width: '130px', padding: '0.35rem 0.5rem', fontSize: '0.83rem' }}>
                                                                                                <option value="Regular without delay">✅ Regular</option>
                                                                                                <option value="Regular with Delay">⚠️ Regular with delay</option>
                                                                                                <option value="Missed">❌ Missed</option>
                                                                                            </select>
                                                                                        ) : (
                                                                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontStyle: 'italic' }}>Mark as TDS no first</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td style={{ padding: '0.75rem' }}>
                                                                                        {g.gstr7Status === 'NA' ? (
                                                                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 600 }}>NA</span>
                                                                                        ) : hasGstd && gState.status === 'Regular with Delay' ? (
                                                                                            <input type="number" className="form-control" min="0" value={gState.delayCount} onChange={e => handleGstinChange(panObj.panNumber, g.gstin, 'delayCount', e.target.value)} style={{ width: '70px', padding: '0.35rem 0.5rem', fontSize: '0.83rem' }} />
                                                                                        ) : (
                                                                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{g.gstr7DelayCount ?? '—'}</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td style={{ padding: '0.75rem' }}>
                                                                                        {g.gstr7Status === 'NA' ? (
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
                                                                                        <button
                                                                                            className="btn btn-primary"
                                                                                            onClick={() => handleSaveGstinRow(panObj.panNumber, g)}
                                                                                            disabled={savingGstinRow === g.gstin || !hasGstd}
                                                                                            title={!hasGstd ? 'Mark as TDS no first' : 'Save Configuration'}
                                                                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', whiteSpace: 'nowrap', opacity: !hasGstd ? 0.4 : 1, cursor: !hasGstd ? 'not-allowed' : 'pointer' }}
                                                                                        >
                                                                                            {savingGstinRow === g.gstin
                                                                                                ? <><span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px', marginRight: '4px' }}></span>Saving...</>
                                                                                                : <><Save size={13} style={{ marginRight: '4px' }} />Save Config</>}
                                                                                        </button>
                                                                                    </td>
                                                                                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                                                                        <button
                                                                                            title={!hasGstd ? 'Mark as TDS no first' : 'Import / View Filing History'}
                                                                                            onClick={() => hasGstd && setModalGstin(g.gstin)}
                                                                                            disabled={!hasGstd}
                                                                                            style={{
                                                                                                padding: '0.3rem 0.65rem', fontSize: '0.78rem', borderRadius: '4px',
                                                                                                border: `1.5px solid ${hasGstd ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                                                                                backgroundColor: 'transparent',
                                                                                                color: hasGstd ? 'var(--primary-color)' : 'var(--text-light)',
                                                                                                cursor: hasGstd ? 'pointer' : 'not-allowed',
                                                                                                opacity: hasGstd ? 1 : 0.4,
                                                                                                display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap'
                                                                                            }}
                                                                                        >
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

            {/* ── GST Card Modal ── */}
            {cardModalGstin && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={() => { setCardModalGstin(null); setCardModalData(null); }}>
                    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setCardModalGstin(null); setCardModalData(null); }} style={{ position: 'absolute', top: '-12px', right: '-12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <X size={16} color="#64748b" />
                        </button>
                        <div style={{ width: '800px', maxWidth: '95vw' }}>
                            {loadingCard ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem', background: 'white', borderRadius: '12px' }}>
                                    <div className="spinner" style={{ width: '32px', height: '32px', borderWidth: '3px' }}></div>
                                    <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>Loading Vendor Profile...</div>
                                </div>
                            ) : cardModalData ? (
                                <GstCard gst={cardModalData} />
                            ) : (
                                <div style={{ color: '#ef4444', textAlign: 'center', padding: '2rem', background: 'white', borderRadius: '12px' }}>Failed to load data.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '12px' }}>
                Build Version: 1.1.0 - GSTR7 Sync Fix
            </div>
        </div>
    );
};

export default Gstr7Management;
