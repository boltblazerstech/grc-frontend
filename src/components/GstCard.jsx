import React, { useState } from 'react';
import { Eye, Copy, Check, AlertCircle, History, Building2, Calendar, User, IndianRupee, ShieldCheck, FileText, Lightbulb, Info, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import Gstr7Timeline from './Gstr7Timeline';

const calculateAge = (dateString) => {
    if (!dateString) return 'N/A';
    const birthDate = new Date(dateString);
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) { years--; months += 12; }
    if (today.getDate() < birthDate.getDate()) { months--; if (months < 0) months = 11; }
    if (months >= 6) years++;
    if (years <= 0) return 'New';
    return `${years} yr${years > 1 ? 's' : ''}`;
};

const formatGstType = (type) => { if (!type) return 'N/A'; return type.trim().split(/\s+/)[0]; };
const formatTurnover = (t) => (!t || t === '0' || t === 0) ? 'N/A' : t;
const formatPeriod = (period) => {
    if (!period) return period;
    const parts = period.split('-');
    if (parts.length === 2) {
        const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
        return `${date.toLocaleString('default', { month: 'long' })} ${parts[0].substring(2)}`;
    }
    return period;
};

const getScoreInfo = (score, thresholds) => {
    if (score === null || score === undefined) return { color: '#6b7280', bg: '#f3f4f6', label: '—', risk: null, cssClass: '' };
    const red = thresholds?.COLOR_RED_THRESHOLD ?? 30;
    const yellow = thresholds?.COLOR_YELLOW_THRESHOLD ?? 20;
    if (score > red) return { color: '#dc2626', bg: '#fee2e2', label: 'High Risk', subLabel: 'Needs Attention', risk: 'high', cssClass: 'score-red' };
    if (score >= yellow) return { color: '#d97706', bg: '#fef3c7', label: 'Moderate Risk', subLabel: 'Monitor Closely', risk: 'moderate', cssClass: 'score-yellow' };
    return { color: '#16a34a', bg: '#dcfce7', label: 'Low Risk', subLabel: 'Looking Good', risk: 'low', cssClass: 'score-green' };
};

const getRiskInsight = (score, thresholds, gst) => {
    if (score === null || score === undefined) return null;
    const red = thresholds?.COLOR_RED_THRESHOLD ?? 30;
    const yellow = thresholds?.COLOR_YELLOW_THRESHOLD ?? 20;
    const d1 = gst.delayCountGstr1 || 0;
    const d3b = gst.delayCountGstr3b || 0;

    if (score > red) {
        const msg = d3b > 0
            ? `${d3b} delay${d3b > 1 ? 's' : ''} in GSTR-3B filing may impact your compliance rating and can attract late fees.`
            : 'High compliance risk. Immediate attention needed.';
        return { msg, bg: '#fffbeb', border: '#fde68a', iconColor: '#d97706', titleColor: '#92400e', textColor: '#78350f' };
    }
    if (score >= yellow) {
        const msg = d1 > 0 || d3b > 0
            ? `Filing delays observed in ${[d1 > 0 ? 'GSTR-1' : '', d3b > 0 ? 'GSTR-3B' : ''].filter(Boolean).join(' & ')}. Compliance score impacted.`
            : 'Moderate compliance risk. Monitor your filings regularly.';
        return { msg, bg: '#fffbeb', border: '#fde68a', iconColor: '#d97706', titleColor: '#92400e', textColor: '#78350f' };
    }
    return { msg: 'Good compliance. No delays observed. Keep filing on time.', bg: '#f0fdf4', border: '#86efac', iconColor: '#16a34a', titleColor: '#166534', textColor: '#14532d' };
};

const DelayBadge = ({ count }) => {
    let statusColor = '#16a34a'; // Green for 0
    let statusBg = '#f0fdf4';
    let Icon = CheckCircle;
    let label = 'No Delay';

    if (count === 1) {
        statusColor = '#d97706'; // Orange/Yellow
        statusBg = '#fff7ed';
        Icon = AlertTriangle;
        label = '1 Return Delayed';
    } else if (count > 1) {
        statusColor = '#dc2626'; // Red
        statusBg = '#fef2f2';
        Icon = AlertCircle;
        label = `${count} Returns Delayed`;
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.2rem' }}>
            <Icon size={18} color={statusColor} style={{ flexShrink: 0 }} />
            <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: '36px', height: '26px', borderRadius: '6px',
                background: statusBg,
                color: statusColor,
                fontWeight: 800, fontSize: '0.85rem',
                border: `1px solid ${statusColor}20`
            }}>{count ?? 0}</div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: statusColor }}>
                {label}
            </span>
        </div>
    );
};

const Gstr7Badge = ({ missedCount = 0, delayCount = 0, isApplicable, rawStatus }) => {
    if (!isApplicable) {
        return <span style={{ background: '#f3f4f6', color: '#9ca3af', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, border: '1px solid #e5e7eb' }}>N/A</span>;
    }
    
    let bg, color, text;
    
    const status = rawStatus ? rawStatus.trim() : "";
    if (missedCount > 0 || status === "Missed") {
        bg = '#fef2f2'; color = '#dc2626';
    } else if (delayCount > 0 || status === "Regular with Delay") {
        bg = '#fff7ed'; color = '#d97706';
    } else {
        bg = '#dcfce7'; color = '#16a34a';
    }

    if (!status || status === "NA") {
        text = "NA";
        bg = '#f3f4f6'; color = '#9ca3af';
    } else if (missedCount > 0 && delayCount > 0) {
        text = `${missedCount} missed and ${delayCount} delayed`;
    } else if (status === "Regular without delay") {
        text = "Regular with no delays";
    } else if (status === "Regular with Delay") {
        text = `Regular with ${delayCount} delay${delayCount === 1 ? '' : 's'}`;
    } else if (status === "Missed") {
        text = `${missedCount} missed`;
    } else {
        text = status;
    }
    return (
        <span style={{ 
            background: bg, color, padding: '0.15rem 0.5rem', borderRadius: '4px', 
            fontSize: '0.7rem', fontWeight: 700, border: `1px solid ${color}20`, 
            whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'right', maxWidth: '70%', lineHeight: '1.2'
        }}>
            {text}
        </span>
    );
};

const SectionHeader = ({ icon: Icon, title, color }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.65rem' }}>
        <div style={{ background: `${color}12`, borderRadius: '6px', padding: '0.35rem', display: 'flex' }}>
            <Icon size={16} color={color} />
        </div>
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{title}</span>
    </div>
);

const InfoRow = ({ icon: Icon, label, value }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0', borderBottom: '1px solid #f8fafc' }}>
        {Icon && (
            <div style={{ background: '#f8fafc', borderRadius: '7px', padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #eef2f6' }}>
                <Icon size={16} color="#3b82f6" />
            </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem', minWidth: 0 }}>
            <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
        </div>
    </div>
);

const GstCard = ({ gst, onClick, isNew, isFirstFetch, index, thresholds }) => {
    const [copied, setCopied] = useState(false);
    const [copiedPan, setCopiedPan] = useState(false);
    const [copiedGstr7, setCopiedGstr7] = useState(false);
    const [showTimeline, setShowTimeline] = useState(false);

    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(gst.gstin);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyPan = (e) => {
        e.stopPropagation();
        const pan = gst.panNumber || (gst.gstin ? gst.gstin.substring(2, 12) : '');
        if (pan) {
            navigator.clipboard.writeText(pan);
            setCopiedPan(true);
            setTimeout(() => setCopiedPan(false), 2000);
        }
    };

    const handleCopyGstr7 = (e) => {
        e.stopPropagation();
        if (gst.gstdNo) {
            navigator.clipboard.writeText(gst.gstdNo);
            setCopiedGstr7(true);
            setTimeout(() => setCopiedGstr7(false), 2000);
        }
    };

    const scoreInfo = getScoreInfo(gst.grcScore, thresholds);
    const riskInsight = getRiskInsight(gst.grcScore, thresholds, gst);
    const isGstr7Applicable = gst.categoryName?.toLowerCase() === 'scrap' || (gst.gstr7Status && gst.gstr7Status !== 'NA');

    return (
        <div
            className={`card gst-card ${isFirstFetch ? 'first-fetch-item' : isNew ? 'new-item' : ''}`}
            style={{
                position: 'relative', padding: 0, overflow: 'hidden',
                border: gst.apiError ? '1px solid #fca5a5' : '1px solid #e5e7eb',
                borderRadius: '12px', backgroundColor: 'white',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                display: 'flex', flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s'
            }}
        >
            {/* ── HEADER ── */}
            <div style={{ padding: '0.75rem 0.85rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                    <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Building2 size={18} color="#3b82f6" />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#111827', lineHeight: 1.2, marginBottom: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {gst.tradeName || gst.legalName || 'N/A'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280' }}>GSTIN: {gst.gstin}</span>
                                <button onClick={handleCopy} title="Copy GSTIN"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem', display: 'inline-flex', color: '#9ca3af' }}>
                                    {copied ? <Check size={11} color="#16a34a" /> : <Copy size={11} />}
                                </button>
                            </div>
                            <span style={{ color: '#d1d5db', fontSize: '0.7rem' }}>|</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280' }}>PAN: {gst.panNumber || (gst.gstin ? gst.gstin.substring(2, 12) : 'N/A')}</span>
                                <button onClick={handleCopyPan} title="Copy PAN"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem', display: 'inline-flex', color: '#9ca3af' }}>
                                    {copiedPan ? <Check size={11} color="#16a34a" /> : <Copy size={11} />}
                                </button>
                            </div>
                            {isFirstFetch && <span style={{ background: '#7c3aed', color: 'white', fontSize: '0.55rem', fontWeight: 800, padding: '0.05rem 0.3rem', borderRadius: '3px' }}>NEW</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {gst.dataSource && (
                                <span style={{
                                    background: gst.dataSource === 'API' ? '#e0e7ff' : '#fef3c7',
                                    color: gst.dataSource === 'API' ? '#3730a3' : '#92400e',
                                    fontSize: '0.58rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '3px'
                                }}>
                                    {gst.dataSource.toUpperCase()}
                                </span>
                            )}
                            {gst.gstdNo && (
                                <span style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', padding: '0.05rem 0.35rem', borderRadius: '3px', fontSize: '0.58rem', fontWeight: 700 }}>
                                    TDS: {gst.gstdNo}
                                </span>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); onClick(gst); }}
                                style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '3px', cursor: 'pointer', padding: '0.05rem 0.35rem', color: '#3b82f6', fontSize: '0.58rem', fontWeight: 700 }}>
                                View Details
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ 
                    flexShrink: 0, 
                    background: 'white', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '12px', 
                    padding: '0.6rem 0.8rem', 
                    minWidth: '165px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.01em' }}>Compliance Risk Score</span>
                        <Info size={12} color="#94a3b8" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: scoreInfo.color, color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: '1.15rem',
                            boxShadow: `0 4px 10px ${scoreInfo.color}40`
                        }}>
                            {gst.grcScore ?? '—'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: scoreInfo.color }}>
                                {scoreInfo.label}
                            </div>
                            <div style={{ fontSize: '0.68rem', fontWeight: 500, color: '#64748b', marginTop: '1px' }}>
                                {scoreInfo.subLabel}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 3-COLUMN BODY ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr 1.1fr', gap: 0, flex: 1 }}>
                {/* Column 1 - VENDOR PROFILE */}
                <div style={{ padding: '0.75rem', borderRight: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                        <div style={{ background: '#eff6ff', padding: '0.35rem', borderRadius: '6px', display: 'flex' }}>
                            <User size={18} color="#3b82f6" />
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#3b82f6', letterSpacing: '0.5px' }}>VENDOR PROFILE</span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        <div style={{ borderBottom: '1px dotted #e2e8f0' }}>
                            <InfoRow icon={Calendar} label="Business Age" value={calculateAge(gst.registrationDate)} />
                        </div>
                        <div style={{ borderBottom: '1px dotted #e2e8f0' }}>
                            <InfoRow icon={User} label="GST Type" value={formatGstType(gst.gstType)} />
                        </div>
                        <div style={{ borderBottom: '1px dotted #e2e8f0' }}>
                            <InfoRow icon={IndianRupee} label="Aggregate Turnover" value={formatTurnover(gst.aggregateTurnover)} />
                        </div>
                        <div style={{ borderBottom: '1px dotted #e2e8f0' }}>
                            <InfoRow icon={CheckCircle} label="Aadhar Verification Status" value={gst.aadhaarValidation || 'N/A'} />
                        </div>
                        <div style={{ borderBottom: '1px dotted #e2e8f0' }}>
                            <InfoRow icon={Building2} label="Core Activity" value={gst.coreActivity || 'N/A'} />
                        </div>
                    </div>
                </div>

                {/* Column 2 - GST COMPLIANCE */}
                <div style={{ padding: '0.75rem', borderRight: '1px solid #f3f4f6', background: '#fcfdfd' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                        <div style={{ background: '#f0fdf4', padding: '0.35rem', borderRadius: '6px', display: 'flex' }}>
                            <ShieldCheck size={18} color="#16a34a" />
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#16a34a', letterSpacing: '0.5px' }}>GST COMPLIANCE</span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        {/* GST Status Section */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px dotted #e2e8f0' }}>
                            <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 700 }}>GST Status</span>
                            <div style={{ 
                                display: 'flex', alignItems: 'center', gap: '0.4rem', 
                                background: gst.gstStatus === 'Active' ? '#f0fdf4' : '#fef2f2',
                                padding: '0.2rem 0.6rem', borderRadius: '20px',
                                border: `1px solid ${gst.gstStatus === 'Active' ? '#bcf0da' : '#fecaca'}`
                            }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: gst.gstStatus === 'Active' ? '#16a34a' : '#dc2626' }}></div>
                                <span style={{ fontWeight: 800, fontSize: '0.72rem', color: gst.gstStatus === 'Active' ? '#166534' : '#991b1b' }}>{gst.gstStatus || 'N/A'}</span>
                            </div>
                        </div>

                        {/* GSTR-1 Section */}
                        <div style={{ padding: '0.6rem 0', borderBottom: '1px dotted #e2e8f0' }}>
                            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, marginBottom: '0.1rem' }}>GSTR-1 Filing Delay</div>
                            <DelayBadge count={gst.delayCountGstr1 ?? 0} />
                        </div>

                        {/* GSTR-3B Section */}
                        <div style={{ padding: '0.6rem 0', borderBottom: '1px dotted #e2e8f0' }}>
                            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, marginBottom: '0.1rem' }}>GSTR-3B Filing Delay</div>
                            <DelayBadge count={gst.delayCountGstr3b ?? 0} />
                        </div>

                        {/* Last Updated Section */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0', color: '#94a3b8' }}>
                             <History size={14} />
                             <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Last Updated</span>
                                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b' }}>
                                    {gst.scoreCalculatedAt 
                                        ? new Date(gst.scoreCalculatedAt).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
                                        : 'Never'}
                                </span>
                             </div>
                        </div>
                    </div>
                </div>

                {/* Column 3 */}
                <div style={{ padding: '0.65rem 0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                        <div style={{ background: '#f5f3ff', padding: '0.35rem', borderRadius: '6px', display: 'flex' }}>
                            <FileText size={18} color="#7c3aed" />
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#7c3aed', letterSpacing: '0.5px' }}>GSTR-7 COMPLIANCE</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px dotted #e2e8f0' }}>
                            <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 700 }}>GSTR 7</span>
                            {isGstr7Applicable && gst.gstdNo ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#16a34a', wordBreak: 'break-all', textAlign: 'right', maxWidth: '100px', lineHeight: '1.2' }}>{gst.gstdNo}</span>
                                    <button onClick={handleCopyGstr7} title="Copy GSTR-7 No."
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem', display: 'inline-flex', color: '#9ca3af' }}>
                                        {copiedGstr7 ? <Check size={11} color="#16a34a" /> : <Copy size={11} />}
                                    </button>
                                </div>
                            ) : (
                                <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#6b7280' }}>NA</span>
                            )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px dotted #e2e8f0' }}>
                            <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 700 }}>Status</span>
                            <Gstr7Badge 
                                missedCount={gst.gstr7MissedCount ?? 0} 
                                delayCount={gst.gstr7DelayCount ?? 0} 
                                isApplicable={isGstr7Applicable} 
                                rawStatus={gst.gstr7Status}
                            />
                        </div>
                        <div style={{ padding: '0.6rem 0', borderBottom: '1px dotted #e2e8f0' }}>
                            {!isGstr7Applicable ? null : (
                                <>
                                    <div style={{ display: 'flex', gap: '1.25rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Missed</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: (!gst.gstr7MissedCount || gst.gstr7MissedCount === 0) ? '#16a34a' : '#dc2626' }}>{gst.gstr7MissedCount || 0}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Delayed</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: (!gst.gstr7DelayCount || gst.gstr7DelayCount === 0) ? '#16a34a' : '#d97706' }}>{gst.gstr7DelayCount || 0}</span>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '0.2rem', paddingTop: '0.4rem', borderTop: '1px dashed #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                            <Calendar size={11} color="#94a3b8" />
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '0.55rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Last Filled Month</span>
                                                <span style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 600 }}>
                                                    {gst.gstr7LastReturnPeriod ? formatPeriod(gst.gstr7LastReturnPeriod) : 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                            <History size={11} color="#94a3b8" />
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '0.55rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Last Updated</span>
                                                <span style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 600 }}>
                                                    {gst.gstr7LastUpdated ? new Date(gst.gstr7LastUpdated).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Never'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* View Monthly Filing button — always visible, disabled if not applicable */}
                        <button
                            onClick={(e) => { e.stopPropagation(); if (isGstr7Applicable) setShowTimeline(!showTimeline); }}
                            title={isGstr7Applicable ? (showTimeline ? 'Hide monthly filing history' : 'View monthly filing history') : 'Only available for GSTR-7 applicable GSTINs'}
                            style={{
                                marginTop: '0.3rem',
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.3rem',
                                padding: '0.35rem 0.5rem',
                                borderRadius: '6px',
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                fontFamily: 'inherit',
                                border: isGstr7Applicable ? '1px solid #c4b5fd' : '1px solid #e5e7eb',
                                background: isGstr7Applicable
                                    ? (showTimeline ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : '#f5f3ff')
                                    : '#f9fafb',
                                color: isGstr7Applicable ? (showTimeline ? 'white' : '#7c3aed') : '#9ca3af',
                                cursor: isGstr7Applicable ? 'pointer' : 'not-allowed',
                                transition: 'all 0.2s ease',
                                boxShadow: isGstr7Applicable && showTimeline ? '0 2px 8px rgba(124,58,237,0.3)' : 'none',
                            }}
                        >
                            <History size={11} />
                            {showTimeline ? 'Hide Filing History' : 'View Monthly Filing'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── TIMELINE ── */}
            {showTimeline && (
                <div onClick={(e) => e.stopPropagation()} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <Gstr7Timeline gstin={gst.gstin} onClose={() => setShowTimeline(false)} />
                </div>
            )}

            {/* ── FOOTER ── */}
            {riskInsight && (
                <div style={{ background: riskInsight.bg, borderTop: `1px solid ${riskInsight.border}`, padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Lightbulb size={12} color={riskInsight.iconColor} />
                    <div style={{ fontSize: '0.65rem', color: riskInsight.textColor, fontWeight: 500, lineHeight: 1.3, flex: 1 }}>
                        <strong style={{ textTransform: 'uppercase', fontSize: '0.58rem', display: 'block' }}>Insight:</strong>
                        {riskInsight.msg}
                    </div>
                </div>
            )}

            <div style={{ borderTop: '1px solid #f3f4f6', padding: '0.35rem 0.75rem', background: '#fafafa', fontSize: '0.58rem', color: '#9ca3af', display: 'flex', justifyContent: 'space-between' }}>
                <span>◎ Auto-fetched from GST Portal</span>
                <span>{gst.scoreCalculatedAt ? new Date(gst.scoreCalculatedAt).toLocaleDateString('en-IN') : ''}</span>
            </div>
        </div>
    );
};

export default GstCard;
