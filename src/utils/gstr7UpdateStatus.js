// Tracks whether a vendor's GSTR-7 details have ever been updated (imported/saved/reviewed).
// Returns null when the badge shouldn't be shown at all (processed with a real, non-NA status —
// the existing filing-status badge already covers that case).
export const getGstr7UpdateStatus = (gst) => {
    if (!gst || !gst.gstr7LastUpdated) {
        return { label: 'Not Updated', bg: '#fef9c3', color: '#854d0e', border: '#fde047' };
    }
    if (gst.gstr7Status === 'NA') {
        return { label: 'Updated', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' };
    }
    return null;
};
