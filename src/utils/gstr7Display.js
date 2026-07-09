// Computes the "GSTR 7" and "Status" display values for a vendor, based on:
// - tdsApplicable: true/false/null|undefined (TDS Status toggle set on the gstr7-master page;
//   null/undefined means the toggle has never been tapped for this vendor's PAN)
// - gstdNo: TDS/GSTD number string, or falsy if not filled in yet
// - gstr7Status: 'NA' | 'Regular without delay' | 'Regular with Delay' | 'Missed' | null
// - gstr7DelayCount / gstr7MissedCount: numbers
//
// All eight cases:
//  1. tdsApplicable not set        -> GSTR7 "To Be Updated"  / Status "To Be Updated" (yellow)
//  2. tdsApplicable = No           -> GSTR7 "Not Registered" / Status "N/A" (gray)
//  3. tdsApplicable = Yes, no TDS# -> GSTR7 "Registered"     / Status "N/A" (gray)
//  4. Yes + TDS#, no filing yet    -> GSTR7 <TDS number>     / Status "N/A" (gray)
//  5-8. Yes + TDS# + filing data   -> GSTR7 <TDS number>     / Status <computed text/color>

const YELLOW = { bg: '#fef9c3', color: '#854d0e', border: '#fde047' };
const GRAY = { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' };
const RED = { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
const ORANGE = { bg: '#fff7ed', color: '#d97706', border: '#fed7aa' };
const GREEN = { bg: '#dcfce7', color: '#16a34a', border: '#bbf7d0' };

export function getGstr7Display(gst) {
    const tdsApplicable = gst?.tdsApplicable;
    const gstdNo = gst?.gstdNo;
    const status = gst?.gstr7Status ? gst.gstr7Status.trim() : '';
    const missedCount = gst?.gstr7MissedCount ?? 0;
    const delayCount = gst?.gstr7DelayCount ?? 0;

    // Case 1: TDS Status has never been set
    if (tdsApplicable === null || tdsApplicable === undefined) {
        return {
            gstr7: { text: 'To Be Updated', ...YELLOW },
            status: { text: 'To Be Updated', ...YELLOW },
        };
    }

    // Case 2: TDS Status = No
    if (tdsApplicable === false) {
        return {
            gstr7: { text: 'Not Registered', ...RED },
            status: { text: 'N/A', ...GRAY },
        };
    }

    // Case 3: TDS Status = Yes, but TDS/GSTD number not filled in yet
    if (!gstdNo) {
        return {
            gstr7: { text: 'Registered', ...GRAY },
            status: { text: 'N/A', ...GRAY },
        };
    }

    // Case 4: TDS number filled in, but no filing details entered/imported yet
    if (!status || status === 'NA') {
        return {
            gstr7: { text: gstdNo, ...GREEN },
            status: { text: 'N/A', ...GRAY },
        };
    }

    // Cases 5-8: real filing details present
    let statusText;
    let statusColors;
    if (missedCount > 0 && delayCount > 0) {
        statusText = `${missedCount} missed and ${delayCount} delayed`;
        statusColors = RED;
    } else if (status === 'Missed' || missedCount > 0) {
        statusText = `${missedCount} missed`;
        statusColors = RED;
    } else if (status === 'Regular with Delay' || delayCount > 0) {
        statusText = `Regular with ${delayCount} delay${delayCount === 1 ? '' : 's'}`;
        statusColors = ORANGE;
    } else {
        statusText = 'Regular with no delays';
        statusColors = GREEN;
    }

    return {
        gstr7: { text: gstdNo, ...GREEN },
        status: { text: statusText, ...statusColors },
    };
}
