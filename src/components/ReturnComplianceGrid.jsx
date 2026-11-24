import React, { useMemo } from 'react';

/**
 * Normalizes and checks if a rolling month item matches any token in a delayed months string.
 */
function checkMonthMatch(delayedStr, monthObj) {
  if (!delayedStr || typeof delayedStr !== 'string') return false;
  const tokens = delayedStr.split(/[,;]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
  if (tokens.length === 0) return false;

  const targetName = (monthObj.name || '').toLowerCase();
  const targetYear = monthObj.year ? String(monthObj.year) : '';

  return tokens.some(token => {
    // If token includes year (e.g. "sep 2025" or "sep 25")
    if (token.includes(targetYear) || (targetYear.length === 4 && token.includes(targetYear.slice(-2)))) {
      return token.includes(targetName) || token.startsWith(targetName.slice(0, 3));
    }
    // If token is just a bare month name (e.g. "sep", "oct")
    if (!/\d{2,4}/.test(token)) {
      // Matches if current year
      if (monthObj.isCurrentYear) {
        return token.includes(targetName) || token.startsWith(targetName.slice(0, 3));
      }
    }
    return false;
  });
}

export default function ReturnComplianceGrid({ gst, compact = false }) {
  if (!gst) return null;

  // Compute rolling 12 months (oldest to newest: 11 months ago to current month)
  const rolling12Months = useMemo(() => {
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const list = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(curYear, curMonth - i, 1);
      const y = d.getFullYear();
      const mIdx = d.getMonth();
      const name = monthNames[mIdx];
      const isCurrentYear = y === curYear;
      const label = isCurrentYear ? name : `${name} '${String(y).slice(-2)}`;
      const fullLabel = `${name} ${y}`;

      list.push({
        name,
        year: y,
        monthIndex: mIdx,
        isCurrentYear,
        label,
        fullLabel
      });
    }
    return list;
  }, []);

  const delayedGstr1 = gst.delayedMonthsGstr1 || '';
  const delayedGstr3b = gst.delayedMonthsGstr3b || '';
  const isCancelled = (gst.gstStatus || '').toLowerCase() === 'cancelled';
  const hasGstd = gst.tdsApplicable === true && !!gst.gstdNo;
  const gstr7Status = (gst.gstr7Status || '').trim();

  // Status resolver for GSTR-1
  const getGstr1Status = (m) => {
    if (isCancelled) return 'missing';
    if (checkMonthMatch(delayedGstr1, m)) return 'delayed';
    return 'on_time';
  };

  // Status resolver for GSTR-3B
  const getGstr3bStatus = (m) => {
    if (isCancelled) return 'missing';
    if (checkMonthMatch(delayedGstr3b, m)) return 'delayed';
    return 'on_time';
  };

  // Status resolver for GSTR-7
  const getGstr7Status = (m) => {
    if (!hasGstd) return 'na';
    if (gstr7Status === 'NA' || !gstr7Status) return 'na';
    if (gstr7Status.toLowerCase().includes('missed') || gst.gstr7MissedCount > 0) {
      // Highlight the most recent missed months
      return 'missing';
    }
    if (gstr7Status.toLowerCase().includes('delay') || gst.gstr7DelayCount > 0) {
      return 'delayed';
    }
    return 'on_time';
  };

  const getTileStyle = (status) => {
    switch (status) {
      case 'on_time': // 🟢 Green
        return {
          background: '#dcfce7',
          color: '#15803d',
          border: '1px solid #86efac',
          titleText: 'Filed on time (Regular)'
        };
      case 'delayed': // 🟠 Orange
        return {
          background: '#ffedd5',
          color: '#c2410c',
          border: '1px solid #fdba74',
          titleText: 'Delayed Filing'
        };
      case 'missing': // 🔴 Red
        return {
          background: '#fee2e2',
          color: '#b91c1c',
          border: '1px solid #fca5a5',
          titleText: 'Missing / Not Filed'
        };
      default: // ⚪ N/A
        return {
          background: '#f1f5f9',
          color: '#94a3b8',
          border: '1px solid #e2e8f0',
          titleText: 'Not Applicable / NA'
        };
    }
  };

  const rows = [
    { name: 'GSTR-1', resolver: getGstr1Status, count: gst.delayCountGstr1 ?? 0 },
    { name: 'GSTR-3B', resolver: getGstr3bStatus, count: gst.delayCountGstr3b ?? 0 },
    { name: 'GSTR-7', resolver: getGstr7Status, count: gst.gstr7DelayCount ?? 0, na: !hasGstd }
  ];

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: compact ? '0.65rem 0.85rem' : '1rem 1.15rem',
        marginTop: '0.85rem'
      }}
    >
      {/* Title & Legend Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '0.75rem',
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: '0.5rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            12-Month Filing Compliance
          </span>
          <span style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>
            ({rolling12Months[0]?.fullLabel} — {rolling12Months[11]?.fullLabel})
          </span>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.68rem', fontWeight: 700 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#16a34a' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#22c55e' }} />
            On Time
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#ea580c' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f97316' }} />
            Delayed
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#dc2626' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#ef4444' }} />
            Missing
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#94a3b8' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#cbd5e1' }} />
            N/A
          </span>
        </div>
      </div>

      {/* Grid Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {rows.map(row => (
          <div
            key={row.name}
            style={{
              display: 'grid',
              gridTemplateColumns: '70px 1fr',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {/* Return Label */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#334155' }}>
                {row.name}
              </span>
              <span style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 600 }}>
                {row.na ? 'Not Reg.' : `${row.count} delay${row.count === 1 ? '' : 's'}`}
              </span>
            </div>

            {/* 12 Month Blocks */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(12, 1fr)',
                gap: '0.3rem'
              }}
            >
              {rolling12Months.map(m => {
                const status = row.resolver(m);
                const tile = getTileStyle(status);
                return (
                  <div
                    key={m.fullLabel}
                    title={`${row.name} — ${m.fullLabel}: ${tile.titleText}`}
                    style={{
                      background: tile.background,
                      color: tile.color,
                      border: tile.border,
                      borderRadius: '5px',
                      padding: compact ? '0.2rem 0' : '0.35rem 0',
                      textAlign: 'center',
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      userSelect: 'none',
                      transition: 'transform 0.15s',
                      cursor: 'default'
                    }}
                  >
                    {m.label}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
