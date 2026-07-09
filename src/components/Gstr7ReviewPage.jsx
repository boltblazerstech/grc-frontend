import React, { useState, useEffect } from "react";
import { apiClient } from "../api/apiClient";
import {
  Check,
  X,
  Sparkles,
  AlertCircle,
  Plus,
  CheckCheck,
  RefreshCw,
  Pencil,
  Trash2,
  LayoutList,
  Maximize2,
  Minimize2,
} from "lucide-react";

const statusStyle = (status) => {
  if (!status) return {};
  if (status === "Regular without delay")
    return { background: "#d4edda", color: "#155724" };
  if (status === "Regular with Delay")
    return { background: "#fff3cd", color: "#856404" };
  if (status === "Missed") return { background: "#f8d7da", color: "#721c24" };
  return { background: "#e2e3e5", color: "#383d41" };
};

const statusLabel = (status) => {
  if (status === "Regular without delay") return "✅ Regular";
  if (status === "Regular with Delay") return "⚠ Regular with delay";
  if (status === "Missed") return "✕ Missed";
  return status || "—";
};

const Gstr7ReviewPage = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actioningId, setActioningId] = useState(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [viewMode, setViewMode] = useState("expanded"); // 'expanded' or 'collapsed'

  // editRecords: { [reviewId]: [ { returnPeriod, dateOfFiling, status }, ... ] }
  const [editRecords, setEditRecords] = useState({});
  // previewItems: { [reviewId]: [ FilingPreviewItem, ... ] } - server-computed, for display
  const [previewItems, setPreviewItems] = useState({});
  // Local overrides for summary: { [reviewId]: { summaryStatus, delayCount, missedCount } }
  const [summaryOverrides, setSummaryOverrides] = useState({});
  // row editing state: { [reviewId]: { [index]: true/false } }
  const [editingFilingDate, setEditingFilingDate] = useState({});

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiClient.getPendingReviews();
      setReviews(data);
      const initialEdits = {};
      const initialPreviews = {};
      const initialSummaries = {};
      data.forEach((r) => {
        initialEdits[r.id] = (r.records || []).map((rec) => ({
          returnPeriod: rec.returnPeriod || "",
          dateOfFiling: rec.dateOfFiling || "",
          status: rec.status || "",
        }));
        initialPreviews[r.id] = r.previewItems || [];
        initialSummaries[r.id] = {
          summaryStatus: r.summaryStatus || "NA",
          delayCount: r.delayCount || 0,
          missedCount: r.missedCount || 0,
        };
      });
      setEditRecords(initialEdits);
      setPreviewItems(initialPreviews);
      setSummaryOverrides(initialSummaries);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (review) => {
    setActioningId(review.id);
    setError("");
    try {
      const records = (editRecords[review.id] || []).map((r) => ({
        returnPeriod: r.returnPeriod,
        dateOfFiling: r.dateOfFiling || null,
        status: r.status || null,
      }));
      const summary = summaryOverrides[review.id] || {};
      await apiClient.approveReview(review.id, {
        records,
        summaryStatus: summary.summaryStatus,
        delayCount: summary.delayCount,
        missedCount: summary.missedCount,
      });
      setSuccess(`✅ Review for ${review.gstin} approved and saved!`);
      setTimeout(() => setSuccess(""), 4000);
      fetchReviews();
    } catch (err) {
      setError("Approval failed: " + err.message);
    } finally {
      setActioningId(null);
    }
  };

  const handleApproveAll = async () => {
    if (
      !window.confirm(
        `Approve all ${reviews.length} pending review(s)? This will save all to the database.`,
      )
    )
      return;
    setApprovingAll(true);
    setError("");
    let failed = 0;
    for (const rev of reviews) {
      try {
        const records = (editRecords[rev.id] || []).map((r) => ({
          returnPeriod: r.returnPeriod,
          dateOfFiling: r.dateOfFiling || null,
          status: r.status || null,
        }));
        const summary = summaryOverrides[rev.id] || {};
        await apiClient.approveReview(rev.id, {
          records,
          summaryStatus: summary.summaryStatus,
          delayCount: summary.delayCount,
          missedCount: summary.missedCount,
        });
      } catch (e) {
        failed++;
      }
    }
    setApprovingAll(false);
    if (failed > 0) {
      setError(`${failed} review(s) failed. The rest were saved.`);
    } else {
      setSuccess(`✅ All ${reviews.length} reviews approved and saved!`);
      setTimeout(() => setSuccess(""), 4000);
    }
    fetchReviews();
  };

  const handleReject = async (id) => {
    if (!window.confirm("Are you sure you want to reject this submission?"))
      return;
    setActioningId(id);
    setError("");
    try {
      await apiClient.rejectReview(id);
      setSuccess("Review rejected.");
      setTimeout(() => setSuccess(""), 3000);
      fetchReviews();
    } catch (err) {
      setError("Rejection failed: " + err.message);
    } finally {
      setActioningId(null);
    }
  };

  const handleFieldChange = (reviewId, index, field, value) => {
    setEditRecords((prev) => {
      const newArr = [...(prev[reviewId] || [])];
      newArr[index] = { ...newArr[index], [field]: value };
      return { ...prev, [reviewId]: newArr };
    });
  };

  const handleRemoveRow = (reviewId, index) => {
    setEditRecords((prev) => {
      const newArr = [...(prev[reviewId] || [])];
      newArr.splice(index, 1);
      return { ...prev, [reviewId]: newArr };
    });
  };

  const handleAddRow = (reviewId) => {
    setEditRecords((prev) => ({
      ...prev,
      [reviewId]: [
        ...(prev[reviewId] || []),
        {
          returnPeriod: "New Row",
          dateOfFiling: "",
          status: "Regular without delay",
        },
      ],
    }));
  };

  const handleSummaryChange = (reviewId, field, value) => {
    setSummaryOverrides((prev) => ({
      ...prev,
      [reviewId]: { ...prev[reviewId], [field]: value },
    }));
  };

  const toggleEditFilingDate = (reviewId, index) => {
    setEditingFilingDate((prev) => {
      const inner = { ...(prev[reviewId] || {}) };
      inner[index] = !inner[index];
      return { ...prev, [reviewId]: inner };
    });
  };

  const fmtDate = (d) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return d;
    }
  };

  const formatPeriod = (period) => {
    if (!period || period === "New Row") return period;
    const parts = period.split("-");
    if (parts.length === 2) {
      const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      const monthName = date.toLocaleString('default', { month: 'long' });
      const yearStr = parts[0].substring(2);
      return `${monthName} ${yearStr}`;
    }
    return period;
  };

  if (loading)
    return (
      <div style={{ padding: "3rem", textAlign: "center" }}>
        <div className="spinner" style={{ margin: "0 auto" }}></div>
        <p style={{ marginTop: "1rem", color: "var(--text-light)" }}>
          Loading reviews...
        </p>
      </div>
    );

  return (
    <div style={{ padding: "2rem" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "var(--primary-color)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Sparkles size={24} /> GSTR-7 Pending Reviews
          {reviews.length > 0 && (
            <span
              style={{
                background: "#dc3545",
                color: "white",
                borderRadius: "12px",
                padding: "0.15rem 0.65rem",
                fontSize: "0.8rem",
                fontWeight: 700,
              }}
            >
              {reviews.length}
            </span>
          )}
        </h2>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {reviews.length > 1 && (
            <button
              className="btn btn-primary"
              onClick={handleApproveAll}
              disabled={approvingAll}
              style={{
                background: "#28a745",
                borderColor: "#28a745",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontWeight: 700,
              }}
            >
              {approvingAll ? (
                <>
                  <div
                    className="spinner"
                    style={{
                      width: "14px",
                      height: "14px",
                      borderWidth: "2px",
                    }}
                  />{" "}
                  Approving All...
                </>
              ) : (
                <>
                  <CheckCheck size={16} /> Approve All ({reviews.length})
                </>
              )}
            </button>
          )}
          <div
            style={{
              display: "flex",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setViewMode("expanded")}
              style={{
                padding: "0.4rem 0.8rem",
                border: "none",
                background:
                  viewMode === "expanded" ? "var(--primary-color)" : "white",
                color: viewMode === "expanded" ? "white" : "var(--text-light)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            >
              <Maximize2 size={14} /> Expanded
            </button>
            <button
              onClick={() => setViewMode("collapsed")}
              style={{
                padding: "0.4rem 0.8rem",
                border: "none",
                background:
                  viewMode === "collapsed" ? "var(--primary-color)" : "white",
                color: viewMode === "collapsed" ? "white" : "var(--text-light)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            >
              <Minimize2 size={14} /> Collapsed
            </button>
          </div>
          <button
            className="btn btn-secondary"
            onClick={fetchReviews}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#f8d7da",
            color: "#721c24",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "1rem",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          style={{
            background: "#d4edda",
            color: "#155724",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "1rem",
            fontSize: "0.9rem",
          }}
        >
          {success}
        </div>
      )}

      {reviews.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "4rem",
            background: "white",
            borderRadius: "12px",
            border: "1px solid var(--border-color)",
          }}
        >
          <Check size={48} color="#28a745" style={{ marginBottom: "1rem" }} />
          <h3 style={{ margin: 0, color: "var(--text-color)" }}>
            All caught up!
          </h3>
          <p style={{ color: "var(--text-light)", marginTop: "0.5rem" }}>
            There are no pending GSTR-7 submissions to review.
          </p>
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          {reviews.map((rev) => {
            const records = editRecords[rev.id] || [];
            const pItems = previewItems[rev.id] || [];
            const previewMap = {};
            pItems.forEach((p) => {
              previewMap[p.returnPeriod] = p;
            });
            const isBusy = actioningId === rev.id || approvingAll;

            return (
              <div
                key={rev.id}
                style={{
                  background: "white",
                  borderRadius: "12px",
                  border: "1px solid var(--border-color)",
                  overflow: "hidden",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                {/* Card Header */}
                <div
                  style={{
                    background:
                      "linear-gradient(135deg, #f0f7ff 0%, #f8f9fa 100%)",
                    padding: "1rem 1.5rem",
                    borderBottom:
                      viewMode === "expanded"
                        ? "1px solid var(--border-color)"
                        : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1.5fr", gap: "1.5rem" }}>
                      {/* Left: Basic Info */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", borderRight: "1px solid var(--border-color)", paddingRight: "1rem" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                            <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--primary-color)", fontFamily: "'Roboto Mono', monospace" }}>
                              {rev.gstin}
                            </h3>
                            {rev.gstdNo && (
                              <span style={{ fontSize: "0.75rem", background: "#dbeafe", color: "#1e40af", padding: "0.1rem 0.5rem", borderRadius: "4px", fontWeight: 700 }}>
                                TDS no: {rev.gstdNo}
                              </span>
                            )}
                          </div>
                          {rev.companyName && (
                            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text-light)", fontWeight: 600 }}>
                              {rev.companyName}
                            </p>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ color: "var(--text-light)", fontWeight: 600, fontSize: "0.7rem" }}>Turnover</span>
                          <span style={{ fontWeight: 700, color: "var(--text-dark)", fontSize: "0.8rem" }}>{rev.aggregateTurnover || "N/A"}</span>
                        </div>
                      </div>

                      {/* Middle: GST Compliance */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", borderRight: "1px solid var(--border-color)", paddingRight: "1rem" }}>
                        <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--primary-color)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "0.1rem" }}>
                          GST Compliance
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem" }}>
                          <span style={{ color: "var(--text-light)", fontWeight: 600 }}>GST Status:</span>
                          <span style={{ 
                            fontWeight: 700, 
                            color: rev.gstStatus === "Active" ? "var(--success-color)" : "var(--danger-color)",
                            backgroundColor: rev.gstStatus === "Active" ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
                            padding: "0 0.4rem",
                            borderRadius: "4px"
                          }}>
                            {rev.gstStatus || "N/A"}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem" }}>
                          <span style={{ color: "var(--text-light)", fontWeight: 600 }}>GSTR 1 delay:</span>
                          <span style={{ fontWeight: 700 }}>{rev.delayCountGstr1 ?? 0}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem" }}>
                          <span style={{ color: "var(--text-light)", fontWeight: 600 }}>GSTR 3B delay:</span>
                          <span style={{ fontWeight: 700 }}>{rev.delayCountGstr3b ?? 0}</span>
                        </div>
                        <div style={{ marginTop: "auto", fontSize: "0.65rem", color: "var(--text-light)", borderTop: "1px dashed var(--border-color)", paddingTop: "0.2rem" }}>
                          Last updated: {rev.lastApiSync ? new Date(rev.lastApiSync).toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}
                        </div>
                      </div>

                      {/* Right: GSTR7 Compliance (Review Controls) */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--primary-color)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "0.1rem" }}>
                          GSTR7 Compliance
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", background: "#fff3cd", color: "#856404", padding: "0.2rem 0.5rem", borderRadius: "6px", fontSize: "0.75rem" }}>
                            <span style={{ fontWeight: 600, marginRight: "6px" }}>⚠ Delay:</span>
                            <input type="number" value={summaryOverrides[rev.id]?.delayCount ?? 0} onChange={(e) => handleSummaryChange(rev.id, "delayCount", parseInt(e.target.value) || 0)} style={{ width: "30px", border: "none", background: "transparent", fontWeight: 700, color: "#856404", outline: "none" }} />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", background: "#f8d7da", color: "#721c24", padding: "0.2rem 0.5rem", borderRadius: "6px", fontSize: "0.75rem" }}>
                            <span style={{ fontWeight: 600, marginRight: "6px" }}>✕ Missed:</span>
                            <input type="number" value={summaryOverrides[rev.id]?.missedCount ?? 0} onChange={(e) => handleSummaryChange(rev.id, "missedCount", parseInt(e.target.value) || 0)} style={{ width: "30px", border: "none", background: "transparent", fontWeight: 700, color: "#721c24", outline: "none" }} />
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", background: "#e2e3e5", color: "#383d41", padding: "0.2rem 0.5rem", borderRadius: "6px", fontSize: "0.75rem" }}>
                          <span style={{ fontWeight: 600, marginRight: "6px" }}>Status:</span>
                          <select value={summaryOverrides[rev.id]?.summaryStatus || "NA"} onChange={(e) => handleSummaryChange(rev.id, "summaryStatus", e.target.value)} style={{ border: "none", background: "transparent", fontWeight: 700, color: "#383d41", outline: "none", cursor: "pointer" }}>
                            <option value="Regular without delay">Regular</option>
                            <option value="Regular with Delay">Regular with delay</option>
                            <option value="Missed">Missed</option>
                            <option value="NA">N/A</option>
                          </select>
                        </div>
                        <div style={{ marginTop: "auto", fontSize: "0.65rem", color: "var(--text-light)" }}>
                          Submitted by <strong>{rev.submittedBy || "Unknown"}</strong> · {fmtDate(rev.submittedAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      alignSelf: "center",
                    }}
                  >
                    <button
                      className="btn btn-primary"
                      onClick={() => handleApprove(rev)}
                      disabled={isBusy}
                      style={{
                        background: "#28a745",
                        borderColor: "#28a745",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem 1rem",
                      }}
                    >
                      {actioningId === rev.id ? (
                        <div
                          className="spinner"
                          style={{
                            width: "14px",
                            height: "14px",
                            borderWidth: "2px",
                          }}
                        />
                      ) : (
                        <Check size={16} />
                      )}
                      Approve & Save
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleReject(rev.id)}
                      disabled={isBusy}
                      style={{
                        color: "#dc3545",
                        borderColor: "#dc3545",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem 1rem",
                      }}
                    >
                      <X size={16} /> Reject
                    </button>
                  </div>
                </div>

                {viewMode === "expanded" && (
                  /* Editable Table */
                  <div style={{ padding: "1.25rem 1.5rem" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-light)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          fontWeight: 600,
                        }}
                      >
                        Edit any value before approving
                      </span>
                      <button
                        onClick={() => handleAddRow(rev.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "0.78rem",
                          padding: "0.3rem 0.7rem",
                          border: "1px dashed var(--primary-color)",
                          borderRadius: "6px",
                          background: "transparent",
                          color: "var(--primary-color)",
                          cursor: "pointer",
                        }}
                      >
                        <Plus size={13} /> Add Row
                      </button>
                    </div>

                    {records.length > 0 ? (
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: "0.85rem",
                        }}
                      >
                        <thead>
                          <tr style={{ background: "#f8f9fa" }}>
                            <th
                              style={{
                                padding: "0.55rem 0.75rem",
                                textAlign: "left",
                                borderBottom: "2px solid var(--border-color)",
                                color: "var(--text-light)",
                                fontSize: "0.72rem",
                                textTransform: "uppercase",
                                width: "36px",
                              }}
                            >
                              #
                            </th>
                            <th
                              style={{
                                padding: "0.55rem 0.75rem",
                                textAlign: "left",
                                borderBottom: "2px solid var(--border-color)",
                                color: "var(--text-light)",
                                fontSize: "0.72rem",
                                textTransform: "uppercase",
                              }}
                            >
                              Return Period
                            </th>
                            <th
                              style={{
                                padding: "0.55rem 0.75rem",
                                textAlign: "left",
                                borderBottom: "2px solid var(--border-color)",
                                color: "var(--text-light)",
                                fontSize: "0.72rem",
                                textTransform: "uppercase",
                              }}
                            >
                              Date of Filing
                            </th>
                            <th
                              style={{
                                padding: "0.55rem 0.75rem",
                                textAlign: "left",
                                borderBottom: "2px solid var(--border-color)",
                                color: "var(--text-light)",
                                fontSize: "0.72rem",
                                textTransform: "uppercase",
                              }}
                            >
                              Status
                            </th>
                            <th
                              style={{
                                padding: "0.55rem 0.75rem",
                                borderBottom: "2px solid var(--border-color)",
                                width: "36px",
                              }}
                            ></th>
                          </tr>
                        </thead>
                        <tbody>
                          {records.map((p, i) => {
                            const preview = previewMap[p.returnPeriod];
                            return (
                              <tr
                                key={i}
                                style={{
                                  borderBottom: "1px solid #f0f0f0",
                                  background: i % 2 === 0 ? "white" : "#fafcfd",
                                }}
                              >
                                <td
                                  style={{
                                    padding: "0.5rem 0.75rem",
                                    color: "var(--text-light)",
                                    fontSize: "0.78rem",
                                  }}
                                >
                                  {i + 1}
                                </td>
                                <td style={{ padding: "0.4rem 0.75rem" }}>
                                  {p.returnPeriod === "New Row" ||
                                  !p.returnPeriod ? (
                                    <input
                                      type="text"
                                      value={p.returnPeriod}
                                      onChange={(e) =>
                                        handleFieldChange(
                                          rev.id,
                                          i,
                                          "returnPeriod",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="YYYY-MM"
                                      style={{
                                        padding: "0.35rem 0.5rem",
                                        border: "1px solid var(--border-color)",
                                        borderRadius: "4px",
                                        fontSize: "0.82rem",
                                        width: "110px",
                                        fontFamily: "'Roboto Mono', monospace",
                                        outline: "none",
                                      }}
                                      autoFocus
                                    />
                                  ) : (
                                    <span
                                      style={{
                                        padding: "0.35rem 0.5rem",
                                        fontSize: "0.82rem",
                                        width: "110px",
                                        fontFamily: "'Roboto Mono', monospace",
                                        color: "var(--text-color)",
                                        fontWeight: 600,
                                      }}
                                    >
                                      {formatPeriod(p.returnPeriod)}
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: "0.4rem 0.75rem" }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.5rem",
                                    }}
                                  >
                                    {editingFilingDate[rev.id]?.[i] ||
                                    !p.dateOfFiling ? (
                                      <input
                                        type="date"
                                        value={p.dateOfFiling}
                                        onChange={(e) =>
                                          handleFieldChange(
                                            rev.id,
                                            i,
                                            "dateOfFiling",
                                            e.target.value,
                                          )
                                        }
                                        style={{
                                          padding: "0.35rem 0.5rem",
                                          border:
                                            "1px solid var(--border-color)",
                                          borderRadius: "4px",
                                          fontSize: "0.82rem",
                                          outline: "none",
                                        }}
                                        autoFocus
                                        onBlur={() => {
                                          if (p.dateOfFiling)
                                            toggleEditFilingDate(rev.id, i);
                                        }}
                                      />
                                    ) : (
                                      <>
                                        <span style={{ fontSize: "0.85rem" }}>
                                          {p.dateOfFiling}
                                        </span>
                                        <button
                                          onClick={() =>
                                            toggleEditFilingDate(rev.id, i)
                                          }
                                          style={{
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            color: "var(--primary-color)",
                                            padding: "0.2rem",
                                          }}
                                        >
                                          <Pencil size={14} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: "0.4rem 0.75rem" }}>
                                  <select
                                    value={
                                      p.status || preview?.status || "Missed"
                                    }
                                    onChange={(e) =>
                                      handleFieldChange(
                                        rev.id,
                                        i,
                                        "status",
                                        e.target.value,
                                      )
                                    }
                                    style={{
                                      padding: "0.3rem 0.5rem",
                                      border: "1px solid var(--border-color)",
                                      borderRadius: "4px",
                                      fontSize: "0.78rem",
                                      fontWeight: 600,
                                      outline: "none",
                                      cursor: "pointer",
                                      ...statusStyle(
                                        p.status || preview?.status || "Missed",
                                      ),
                                    }}
                                  >
                                    <option value="Regular without delay">
                                      Regular
                                    </option>
                                    <option value="Regular with Delay">
                                      Regular with delay
                                    </option>
                                    <option value="Missed">Missed</option>
                                    <option value="NA">N/A</option>
                                  </select>
                                </td>
                                <td
                                  style={{
                                    padding: "0.4rem 0.75rem",
                                    textAlign: "center",
                                  }}
                                >
                                  <button
                                    onClick={() => handleRemoveRow(rev.id, i)}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      color: "#dc3545",
                                      cursor: "pointer",
                                      padding: "0.2rem",
                                      lineHeight: 1,
                                    }}
                                    title="Remove Row"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div
                        style={{
                          padding: "1.5rem",
                          textAlign: "center",
                          color: "var(--text-light)",
                          fontStyle: "italic",
                          border: "1px dashed var(--border-color)",
                          borderRadius: "8px",
                        }}
                      >
                        No records. Use "Add Row" to add data manually.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Gstr7ReviewPage;
