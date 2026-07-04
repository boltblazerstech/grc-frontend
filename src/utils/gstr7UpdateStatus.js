// Tracks whether a vendor's GSTR-7 details have ever been updated (imported/saved/reviewed),
// independent of the actual filing status value (Regular / Delay / Missed / NA).
export const getGstr7UpdateStatus = (gst) => {
    if (!gst || !gst.gstr7LastUpdated) {
        return { label: 'Not Updated', bg: '#fef9c3', color: '#854d0e', border: '#fde047' };
    }
    return { label: 'Updated', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' };
};
