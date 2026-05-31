import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Plus,
  List,
  LayoutGrid,
  Edit3,
  Trash2,
  X,
  AlertCircle,
  RefreshCw,
  Eye,
  Copy,
  Check,
  CloudDownload,
  Download,
  FileText,
  Users,
  ShieldCheck,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { apiClient } from "../api/apiClient";
import GstCard from "./GstCard";
import GstDetailsModal from "./GstDetailsModal";
import GstQuickEditRow from "./GstQuickEditRow";

const getScoreColor = (score, thresholds) => {
  if (score === null || score === undefined) return "";
  const red = thresholds?.COLOR_RED_THRESHOLD ?? 30;
  const yellow = thresholds?.COLOR_YELLOW_THRESHOLD ?? 20;

  if (score > red) return "score-red";
  if (score >= yellow) return "score-yellow";
  return "score-green";
};

// ── New Vendors Modal (Home Page) ─────────────────────────────────────────────────────────────

const gstr7BadgeStyle = (status) => {
  if (!status || status === "NA")
    return { bg: "#f3f4f6", color: "#6b7280" };
  if (status === "Regular without delay")
    return { bg: "#d4edda", color: "#155724" };
  if (status === "Regular with Delay")
    return { bg: "#fff3cd", color: "#856404" };
  if (status === "Missed") return { bg: "#f8d7da", color: "#721c24" };
  return { bg: "#e2e3e5", color: "#383d41" };
};

const gstStatusStyle = (status) => {
  if (status === "Active") return { bg: "#d4edda", color: "#155724" };
  if (status === "Cancelled") return { bg: "#f8d7da", color: "#721c24" };
  return { bg: "#f3f4f6", color: "#6b7280" };
};

const NewVendorsModal = ({ onClose, onSelectGstin, onOpenGstr7 }) => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [copiedGstins, setCopiedGstins] = useState({});

  const handleCopy = (e, gstin) => {
    e.stopPropagation();
    navigator.clipboard.writeText(gstin);
    setCopiedGstins((prev) => ({ ...prev, [gstin]: true }));
    setTimeout(() => setCopiedGstins((prev) => ({ ...prev, [gstin]: false })), 2000);
  };

  useEffect(() => {
    apiClient
      .getNewVendors(100)
      .then(setVendors)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const fmtDate = (iso) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  const filtered = vendors.filter(
    (v) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const pan = v.panNumber || (v.gstin ? v.gstin.substring(2, 12) : "");
      return (
        v.gstin?.toLowerCase().includes(q) ||
        pan.toLowerCase().includes(q) ||
        v.companyName?.toLowerCase().includes(q)
      );
    }
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: "14px",
          width: "100%",
          maxWidth: "860px",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "linear-gradient(135deg, #f0f7ff, #f8f9fa)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Users size={20} color="var(--primary-color)" />
            <h3 style={{ margin: 0, color: "var(--primary-color)" }}>
              New Vendors
            </h3>
            {!loading && (
              <span
                style={{
                  background: "var(--primary-color)",
                  color: "white",
                  borderRadius: "12px",
                  padding: "0.1rem 0.55rem",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                }}
              >
                {filtered.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-light)",
              padding: "0.2rem",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div
          style={{
            padding: "0.85rem 1.5rem",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <input
            type="text"
            placeholder="Search by PAN or company name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-control"
            style={{ fontSize: "0.85rem" }}
            autoFocus
          />
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <div className="spinner" style={{ margin: "0 auto" }} />
            </div>
          ) : error ? (
            <div
              style={{ padding: "2rem", color: "#721c24", textAlign: "center" }}
            >
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                padding: "3rem",
                textAlign: "center",
                color: "var(--text-light)",
              }}
            >
              No vendors found.
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.83rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#f8f9fa",
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  <th
                    style={{
                      padding: "0.6rem 0.85rem",
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
                      padding: "0.6rem 0.85rem",
                      textAlign: "left",
                      borderBottom: "2px solid var(--border-color)",
                      color: "var(--text-light)",
                      fontSize: "0.72rem",
                      textTransform: "uppercase",
                    }}
                  >
                    PAN
                  </th>
                  <th
                    style={{
                      padding: "0.6rem 0.85rem",
                      textAlign: "left",
                      borderBottom: "2px solid var(--border-color)",
                      color: "var(--text-light)",
                      fontSize: "0.72rem",
                      textTransform: "uppercase",
                    }}
                  >
                    Company Name
                  </th>
                  <th
                    style={{
                      padding: "0.6rem 0.85rem",
                      textAlign: "left",
                      borderBottom: "2px solid var(--border-color)",
                      color: "var(--text-light)",
                      fontSize: "0.72rem",
                      textTransform: "uppercase",
                    }}
                  >
                    Added On
                  </th>
                  <th
                    style={{
                      padding: "0.6rem 0.85rem",
                      textAlign: "left",
                      borderBottom: "2px solid var(--border-color)",
                      color: "var(--text-light)",
                      fontSize: "0.72rem",
                      textTransform: "uppercase",
                    }}
                  >
                    GST Status
                  </th>
                  <th
                    style={{
                      padding: "0.6rem 0.85rem",
                      textAlign: "left",
                      borderBottom: "2px solid var(--border-color)",
                      color: "var(--text-light)",
                      fontSize: "0.72rem",
                      textTransform: "uppercase",
                    }}
                  >
                    GSTR-7 Status
                  </th>
                  <th
                    style={{
                      padding: "0.6rem 0.85rem",
                      textAlign: "left",
                      borderBottom: "2px solid var(--border-color)",
                      color: "var(--text-light)",
                      fontSize: "0.72rem",
                      textTransform: "uppercase",
                    }}
                  >
                    Source
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v, i) => {
                  const gstr7Style = gstr7BadgeStyle(v.gstr7Status);
                  const gstStyle = gstStatusStyle(v.gstStatus);
                  const pan = v.panNumber || (v.gstin ? v.gstin.substring(2, 12) : "");
                  return (
                    <tr
                      key={v.gstin}
                      style={{
                        borderBottom: "1px solid #f0f0f0",
                        background: i % 2 === 0 ? "white" : "#fafcfd",
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onClick={() => onSelectGstin && onSelectGstin(v.gstin)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "white" : "#fafcfd")}
                    >
                      <td
                        style={{
                          padding: "0.55rem 0.85rem",
                          color: "var(--text-light)",
                          fontSize: "0.75rem",
                        }}
                      >
                        {i + 1}
                      </td>
                      <td
                        style={{
                          padding: "0.55rem 0.85rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onOpenGstr7 && pan) {
                                onOpenGstr7(pan);
                              }
                            }}
                            title={`Jump to GSTR-7 Master for PAN: ${pan}`}
                            style={{
                              fontFamily: "'Roboto Mono', monospace",
                              fontWeight: 600,
                              color: "var(--primary-color)",
                              fontSize: "0.8rem",
                              cursor: "pointer",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.textDecoration = "underline";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.textDecoration = "none";
                            }}
                          >
                            {pan}
                          </span>
                          <button
                            onClick={(e) => handleCopy(e, pan)}
                            title="Copy PAN"
                            style={{ background: "none", border: "none", cursor: "pointer", padding: "0.1rem", color: "var(--text-light)", display: "inline-flex", flexShrink: 0 }}
                          >
                            {copiedGstins[pan] ? <Check size={12} color="var(--success-color)" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "0.55rem 0.85rem",
                          maxWidth: "200px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={v.companyName}
                      >
                        {v.companyName || (
                          <span
                            style={{
                              color: "var(--text-light)",
                              fontStyle: "italic",
                            }}
                          >
                            N/A
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: "0.55rem 0.85rem",
                          color: "var(--text-light)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fmtDate(v.createdAt)}
                      </td>
                      <td style={{ padding: "0.55rem 0.85rem" }}>
                        <span
                          style={{
                            background: gstStyle.bg,
                            color: gstStyle.color,
                            padding: "0.15rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          {v.gstStatus || "—"}
                        </span>
                      </td>
                      <td style={{ padding: "0.55rem 0.85rem" }}>
                        <span
                          style={{
                            background: gstr7Style.bg,
                            color: gstr7Style.color,
                            padding: "0.15rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          {v.gstr7Status === "Regular without delay"
                            ? "✓ Regular"
                            : v.gstr7Status === "Regular with Delay"
                              ? "⚠ Regular with delay"
                              : v.gstr7Status === "Missed"
                                ? "✕ Missed"
                                : v.gstr7Status || "Not Set"}
                        </span>
                      </td>
                      <td style={{ padding: "0.55rem 0.85rem" }}>
                        <span
                          style={{
                            background:
                              v.dataSource === "API"
                                ? "#dbeafe"
                                : v.dataSource === "Manual"
                                  ? "#fef3c7"
                                  : "#f3f4f6",
                            color:
                              v.dataSource === "API"
                                ? "#1e40af"
                                : v.dataSource === "Manual"
                                  ? "#92400e"
                                  : "#6b7280",
                            padding: "0.12rem 0.45rem",
                            borderRadius: "4px",
                            fontSize: "0.72rem",
                            fontWeight: 600,
                          }}
                        >
                          {v.dataSource || "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ forceRefreshFlag, currentUser, onOpenGstr7 }) => {
  const [gstList, setGstList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState(currentUser ? "edit" : "grid"); // 'edit', 'list', or 'grid' (Guest defaults to grid)
  const [thresholds, setThresholds] = useState({});

  // Search and Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [scoreFilter, setScoreFilter] = useState("all"); // 'all', 'good', 'okay', 'watch'
  const [sourceFilter, setSourceFilter] = useState("all"); // 'all', 'api', 'manual', 'error'
  const [turnoverFilter, setTurnoverFilter] = useState("all"); // 'all', 'below3'

  // New GST Feature
  const [showFetchModal, setShowFetchModal] = useState(false);
  const [copiedGstin, setCopiedGstin] = useState(null);
  const [newGstInput, setNewGstInput] = useState("");
  const [isFetchingNew, setIsFetchingNew] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [recentlyAdded, setRecentlyAdded] = useState(new Set());

  // Modal state
  const [selectedGst, setSelectedGst] = useState(null);

  // Admin refresh state
  const [showRefreshPanel, setShowRefreshPanel] = useState(false);
  const [selectedGstins, setSelectedGstins] = useState(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState(null);
  const [showNewVendors, setShowNewVendors] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  const handleCopy = (gstin) => {
    navigator.clipboard.writeText(gstin);
    setCopiedGstin(gstin);
    setTimeout(() => setCopiedGstin(null), 2000);
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [data, config] = await Promise.all([
        apiClient.getDetails(),
        apiClient.getRuleConfig(),
      ]);
      const scored = data.filter(g => g.grcScore !== null && g.grcScore !== undefined);
      console.log('[Dashboard] total GSTINs:', data.length, '| with score:', scored.length, '| sample scored:', scored.slice(0,3).map(g => g.gstin + '=' + g.grcScore));
      setGstList(data);

      const configMap = {};
      config.forEach((item) => (configMap[item.configKey] = item.configValue));
      setThresholds(configMap);

      setError(null);
    } catch (err) {
      setError(err.message || "Failed to connect to backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // If logged out, force grid view and reset auth-only filters
    if (!currentUser) {
      setViewMode("grid");
      setSourceFilter((prev) => (prev === "api" ? "all" : prev));
    }
  }, [forceRefreshFlag, currentUser]);

  const handleFetchNewGst = async (e) => {
    e.preventDefault();
    setFetchError("");
    if (!newGstInput.trim()) {
      setFetchError("Please enter at least one GSTIN.");
      return;
    }

    const gstins = newGstInput
      .split(",")
      .map((s) => s.trim().toUpperCase())
      // Remove empty strings and obvious placeholders like "0"
      .filter((s) => s && s !== "0");
    if (gstins.length === 0) return;

    // GST Validation Regex
    const gstRegex =
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
    const invalidGstins = gstins.filter((g) => !gstRegex.test(g));

    if (invalidGstins.length > 0) {
      setFetchError(`Invalid GSTIN format: ${invalidGstins.join(", ")}`);
      return;
    }

    setIsFetchingNew(true);
    try {
      await apiClient.fetchGstDetails(gstins);
      const newSet = new Set(recentlyAdded);
      gstins.forEach((g) => newSet.add(g));
      setRecentlyAdded(newSet);
      setNewGstInput("");
      setShowFetchModal(false);
      await fetchDashboardData();
    } catch (err) {
      setFetchError(err.message || "Failed to fetch GST details from API.");
    } finally {
      setIsFetchingNew(false);
    }
  };

  const handleUpdateItemInList = (updatedItem) => {
    setGstList((prev) =>
      prev.map((item) =>
        item.gstin === updatedItem.gstin ? updatedItem : item,
      ),
    );
    // If modal should be opened or if it is already open for this item, update it
    if (
      updatedItem._openModal ||
      (selectedGst && selectedGst.gstin === updatedItem.gstin)
    ) {
      const { _openModal, ...cleanItem } = updatedItem;
      setSelectedGst(cleanItem);
    }
  };

  const handleDeleteGstin = (deletedGstin) => {
    setGstList((prev) => prev.filter((item) => item.gstin !== deletedGstin));
  };

  const handleRecalculateAll = async () => {
    if (!window.confirm("Recalculate all GRC scores? This may take a moment."))
      return;

    setLoading(true);
    try {
      await apiClient.recalculateAll();
      await fetchDashboardData();
    } catch (err) {
      setError(err.message || "Failed to recalculate all scores");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      // Fetch all GSTR-7 filing details in one call (grouped by GSTIN)
      let filingMap = {};
      try {
        filingMap = await apiClient.getAllGstr7FilingDetails();
      } catch {
        // If the user doesn't have access or API fails, proceed without filing data
        filingMap = {};
      }

      // Build the list of last 12 relevant months (same logic as backend)
      const today = new Date();
      const day = today.getDate();
      let latestYear, latestMonth;
      if (day <= 11) {
        // Up to month-2
        latestMonth = today.getMonth() - 1; // getMonth() is 0-indexed
        latestYear = today.getFullYear();
        if (latestMonth < 0) { latestMonth += 12; latestYear -= 1; }
      } else {
        // Up to month-1
        latestMonth = today.getMonth();
        latestYear = today.getFullYear();
        if (latestMonth < 0) { latestMonth += 12; latestYear -= 1; }
      }

      // Generate 12 months from latest going backwards
      const months = [];
      let y = latestYear, m = latestMonth;
      for (let i = 0; i < 12; i++) {
        const mm = String(m + 1).padStart(2, "0"); // 1-indexed for display
        months.push(`${y}-${mm}`);
        m--;
        if (m < 0) { m = 11; y--; }
      }

      const monthLabels = months.map((period) => {
        const [yr, mo] = period.split("-");
        const d = new Date(parseInt(yr), parseInt(mo) - 1, 1);
        return d.toLocaleString("en-IN", { month: "short", year: "numeric" });
      });

      const exportData = processedList.map((gst) => {
        const row = {
          gstin: gst.gstin,
          pan_number: gst.panNumber || "N/A",
          trade_name: gst.tradeName || "N/A",
          legal_name: gst.legalName || "N/A",
          gst_type: gst.gstType || "N/A",
          gst_status: gst.gstStatus || "N/A",
          registration_date: gst.registrationDate || "N/A",
          address: gst.address || "N/A",
          email: gst.email || "N/A",
          mobile: gst.mobile || "N/A",
          promoters: gst.promoters || "N/A",
          aggregate_turnover: gst.aggregateTurnover || "N/A",
          delay_count_gstr1:
            gst.delayCountGstr1 != null ? gst.delayCountGstr1 : "N/A",
          delay_count_gstr3b:
            gst.delayCountGstr3b != null ? gst.delayCountGstr3b : "N/A",
          score:
            gst.grcScore !== null && gst.grcScore !== undefined
              ? gst.grcScore
              : "N/A",
          calculated_at: gst.scoreCalculatedAt
            ? new Date(gst.scoreCalculatedAt).toLocaleString("en-IN")
            : "N/A",
          source: gst.source || "N/A",
          data_source: gst.dataSource || "N/A",
          api_error: gst.apiError != null ? gst.apiError.toString() : "N/A",
          created_at: gst.createdAt
            ? new Date(gst.createdAt).toLocaleString("en-IN")
            : "N/A",
          last_api_sync: gst.lastApiSync
            ? new Date(gst.lastApiSync).toLocaleString("en-IN")
            : "N/A",
          updated_by: gst.updatedBy || "N/A",
          // ── GSTR-7 Fields ──
          tds_applicable: (gst.gstdNo || gst.categoryName) ? "Yes" : "No",
          tds_no: gst.gstdNo || "N/A",
          hsn_category: gst.categoryName || "N/A",
          gstr7_status: gst.gstr7Status || "N/A",
          gstr7_delay_count:
            gst.gstr7DelayCount != null ? gst.gstr7DelayCount : "N/A",
          gstr7_missed_count:
            gst.gstr7MissedCount != null ? gst.gstr7MissedCount : "N/A",
          gstr7_last_updated:
            gst.gstr7LastUpdated ? new Date(gst.gstr7LastUpdated).toLocaleString("en-IN") : "N/A",
        };

        // Add monthly filing columns
        const filings = filingMap[gst.gstin] || [];
        const filingByPeriod = {};
        filings.forEach((f) => {
          filingByPeriod[f.returnPeriod] = f.dateOfFiling || null;
        });

        months.forEach((period, idx) => {
          const colName = `filing_${monthLabels[idx].replace(/ /g, "_")}`;
          row[colName] = filingByPeriod[period] || "N/A";
        });

        return row;
      });

      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "GRC Details");
      XLSX.writeFile(workbook, "GRC_Details.xlsx");
    } catch (err) {
      alert("Export failed: " + (err.message || "Unknown error"));
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Parse aggregate_turnover string → numeric value in Crore.
   * Returns null for unparseable / NA values.
   */
  const parseTurnoverToCrore = (raw) => {
    if (!raw || raw.trim() === '' || raw.trim().toUpperCase() === 'NA') return null;
    const s = raw.trim().toLowerCase();

    // 'below X cr' → X
    const belowCr = s.match(/below\s+([\d.]+)\s*cr/);
    if (belowCr) return parseFloat(belowCr[1]);

    // 'X cr and above' / '500 cr. and above' → X (very large)
    const aboveCr = s.match(/([\d.]+)\s*cr.*above/);
    if (aboveCr) return parseFloat(aboveCr[1]);

    // Range like '1.5 cr. to 5 cr.' or 'rs. 5 cr. to 25 cr.' → take upper bound
    const crRange = s.match(/([\d.]+)\s*cr[^\d]*to\s*([\d.]+)\s*cr/);
    if (crRange) return parseFloat(crRange[2]);

    // '0 to 40 lakhs' / 'rs. 0 to 40 lakhs' → upper in lakhs ÷ 100
    const lakhsRange = s.match(/to\s*([\d.]+)\s*lakh/);
    if (lakhsRange) return parseFloat(lakhsRange[1]) / 100;

    // '40 lakhs to 1.5 cr.' → upper bound in cr
    const lakhToCr = s.match(/lakh.*to\s*([\d.]+)\s*cr/);
    if (lakhToCr) return parseFloat(lakhToCr[1]);

    // Single plain number → already in crore
    const plain = s.match(/^[\d.]+$/);
    if (plain) return parseFloat(s);

    return null;
  };

  const processedList = useMemo(() => {
    let list = [...gstList];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (g) =>
          g.gstin.toLowerCase().includes(term) ||
          (g.tradeName && g.tradeName.toLowerCase().includes(term)) ||
          (g.legalName && g.legalName.toLowerCase().includes(term)),
      );
    }

    if (scoreFilter !== "all") {
      const redThreshold = thresholds?.COLOR_RED_THRESHOLD ?? 30;
      const yellowThreshold = thresholds?.COLOR_YELLOW_THRESHOLD ?? 20;

      list = list.filter((g) => {
        if (g.grcScore === null || g.grcScore === undefined) return false;
        if (scoreFilter === "watch") return g.grcScore > redThreshold;
        if (scoreFilter === "okay")
          return g.grcScore >= yellowThreshold && g.grcScore <= redThreshold;
        if (scoreFilter === "good") return g.grcScore < yellowThreshold;
        return true;
      });
    }

    if (sourceFilter !== "all") {
      list = list.filter((g) => {
        if (sourceFilter === "api")
          return g.dataSource === "API" && !g.apiError;
        if (sourceFilter === "manual") return g.dataSource === "Manual";
        if (sourceFilter === "error") return g.apiError === true;
        return true;
      });
    }

    if (turnoverFilter === "below3") {
      list = list.filter((g) => {
        const val = parseTurnoverToCrore(g.aggregateTurnover);
        // Include NA (null) and values <= 3 Cr
        return val === null || val <= 3;
      });
      // When turnover filter is active, sort by turnover ascending (NA last)
      return list.sort((a, b) => {
        const aVal = parseTurnoverToCrore(a.aggregateTurnover);
        const bVal = parseTurnoverToCrore(b.aggregateTurnover);
        if (aVal === null && bVal === null) return a.gstin.localeCompare(b.gstin);
        if (aVal === null) return 1;  // NA goes last
        if (bVal === null) return -1;
        return aVal - bVal;
      });
    }

    return list.sort((a, b) => {
      if (a.scoreCalculatedAt && b.scoreCalculatedAt) {
        return new Date(b.scoreCalculatedAt) - new Date(a.scoreCalculatedAt);
      }
      return a.gstin.localeCompare(b.gstin);
    });
  }, [gstList, searchTerm, scoreFilter, sourceFilter, turnoverFilter, thresholds]);

  const handleAdminRefresh = async () => {
    if (selectedGstins.size === 0) return;
    setIsRefreshing(true);
    setRefreshResult(null);
    try {
      const result = await apiClient.refreshGstFromApi(
        [...selectedGstins],
        currentUser?.name,
      );
      setRefreshResult(result);
      setSelectedGstins(new Set());
      await fetchDashboardData();
    } catch (err) {
      setRefreshResult({ error: err.message || "Refresh failed" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleGstin = (gstin) => {
    setSelectedGstins((prev) => {
      const next = new Set(prev);
      if (next.has(gstin)) next.delete(gstin);
      else next.add(gstin);
      return next;
    });
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedGstins(new Set(allSelectableGstins));
    } else {
      setSelectedGstins(new Set());
    }
  };

  // pendingList = no real data yet (old dummy stubs OR api error with no manual entry)
  // normalList  = has real data (api success OR manual entry — even if apiError is still flagged)
  const pendingList = useMemo(
    () =>
      processedList.filter(
        (g) =>
          g.updatedBy === "Dummy" ||
          (g.apiError === true && g.dataSource !== "Manual"),
      ),
    [processedList],
  );
  const normalList = useMemo(
    () =>
      processedList.filter(
        (g) =>
          g.updatedBy !== "Dummy" &&
          !(g.apiError === true && g.dataSource !== "Manual"),
      ),
    [processedList],
  );

  // Reset pagination when list changes
  useEffect(() => {
    setCurrentPage(1);
  }, [processedList]);

  // Derived paginated lists
  const paginatedNormalList = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return normalList.slice(startIndex, startIndex + itemsPerPage);
  }, [normalList, currentPage]);

  const totalPages = Math.ceil(normalList.length / itemsPerPage);

  // Only non-error GSTINs from both lists are selectable
  const allSelectableGstins = useMemo(
    () =>
      [...normalList, ...pendingList]
        .filter((g) => !g.apiError)
        .map((g) => g.gstin),
    [normalList, pendingList],
  );

  const allSelected =
    allSelectableGstins.length > 0 &&
    allSelectableGstins.every((g) => selectedGstins.has(g));
  const someSelected = allSelectableGstins.some((g) => selectedGstins.has(g));

  if (loading && gstList.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "50vh",
        }}
      >
        <div
          className="spinner"
          style={{ width: "40px", height: "40px", borderWidth: "4px" }}
        ></div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div
          className="card"
          style={{
            backgroundColor: "var(--danger-color)",
            color: "white",
            marginBottom: "2rem",
          }}
        >
          {error}
        </div>
      )}

      <div
        className="dashboard-header card"
        style={{ padding: "0.6rem 1rem", marginBottom: "1rem" }}
      >
        {currentUser && (
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                setShowFetchModal(true);
                setFetchError("");
                setNewGstInput("");
              }}
              style={{ whiteSpace: "nowrap" }}
            >
              <Plus size={18} /> Fetch New GST
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleRecalculateAll}
              style={{ whiteSpace: "nowrap" }}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />{" "}
              Recalculate All
            </button>
            {currentUser?.role === "super_admin" && (
              <button
                className="btn btn-secondary"
                onClick={() => {
                  if (!showRefreshPanel) {
                    setViewMode("list");
                    setSelectedGstins(new Set());
                    setRefreshResult(null);
                  }
                  setShowRefreshPanel((p) => !p);
                }}
                style={{
                  whiteSpace: "nowrap",
                  borderColor: showRefreshPanel ? "#2563eb" : "#3b82f6",
                  color: "#1d4ed8",
                  background: showRefreshPanel ? "#dbeafe" : "",
                }}
              >
                <CloudDownload size={16} />{" "}
                {showRefreshPanel ? "Cancel Refresh" : "Refresh from API"}
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={handleExportExcel}
              disabled={isExporting}
              style={{
                whiteSpace: "nowrap",
                borderColor: "#10b981",
                color: "#047857",
                background: "#d1fae5",
                opacity: isExporting ? 0.7 : 1,
              }}
            >
              <Download size={16} /> {isExporting ? "Exporting..." : "Export Excel"}
            </button>
            {currentUser?.role === "super_admin" && (
              <>
                <button
                  onClick={() => setShowNewVendors(true)}
                  className="btn"
                  style={{
                    whiteSpace: "nowrap",
                    background: "#0ea5e9",
                    color: "white",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Users size={16} /> New Vendors
                </button>
                <button
                  onClick={() => onOpenGstr7()}
                  className="btn"
                  style={{
                    whiteSpace: "nowrap",
                    background: "#8b5cf6",
                    color: "white",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <ShieldCheck size={16} /> GSTR-7 Master
                </button>
              </>
            )}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div className="search-bar">
            <div style={{ position: "relative", width: "100% " }}>
              <Search
                size={18}
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-light)",
                }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="Filter by GSTIN or Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: "2.5rem" }}
              />
            </div>
          </div>
          {currentUser && (
            <div className="view-toggle">
              <button
                className={`view-toggle-btn ${viewMode === "edit" ? "active" : ""}`}
                onClick={() => setViewMode("edit")}
                title="Quick Edit View"
                disabled={showRefreshPanel}
              >
                <Edit3 size={18} />
              </button>
              <button
                className={`view-toggle-btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
                title="List View"
                disabled={showRefreshPanel}
              >
                <List size={18} />
              </button>
              <button
                className={`view-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Card View"
                disabled={showRefreshPanel}
              >
                <LayoutGrid size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: "1rem" }}>
        {/* Filters Section */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.8rem",
            marginBottom: "1.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "1rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--text-light)",
                minWidth: "70px",
              }}
            >
              By Score:
            </span>
            <button
              onClick={() => setScoreFilter("all")}
              className={`btn ${scoreFilter === "all" ? "btn-primary" : "btn-secondary"}`}
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
            >
              All
            </button>
            <button
              onClick={() =>
                setScoreFilter(scoreFilter === "watch" ? "all" : "watch")
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.4rem 0.8rem",
                borderRadius: "8px",
                cursor: "pointer",
                border:
                  scoreFilter === "watch"
                    ? "2px solid var(--danger-color)"
                    : "1px solid var(--border-color)",
                backgroundColor:
                  scoreFilter === "watch" ? "rgba(239, 68, 68, 0.1)" : "white",
                fontSize: "0.85rem",
                fontWeight: 600,
                transition: "all 0.2s",
              }}
            >
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: "var(--danger-color)",
                }}
              ></span>
              <span>{">"}30 Under WatchList</span>
            </button>
            <button
              onClick={() =>
                setScoreFilter(scoreFilter === "okay" ? "all" : "okay")
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.4rem 0.8rem",
                borderRadius: "8px",
                cursor: "pointer",
                border:
                  scoreFilter === "okay"
                    ? "2px solid var(--warning-color)"
                    : "1px solid var(--border-color)",
                backgroundColor:
                  scoreFilter === "okay" ? "rgba(234, 179, 8, 0.1)" : "white",
                fontSize: "0.85rem",
                fontWeight: 600,
                transition: "all 0.2s",
              }}
            >
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: "var(--warning-color)",
                }}
              ></span>
              <span>20-30 Okay</span>
            </button>
            <button
              onClick={() =>
                setScoreFilter(scoreFilter === "good" ? "all" : "good")
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.4rem 0.8rem",
                borderRadius: "8px",
                cursor: "pointer",
                border:
                  scoreFilter === "good"
                    ? "2px solid var(--success-color)"
                    : "1px solid var(--border-color)",
                backgroundColor:
                  scoreFilter === "good" ? "rgba(34, 197, 94, 0.1)" : "white",
                fontSize: "0.85rem",
                fontWeight: 600,
                transition: "all 0.2s",
              }}
            >
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: "var(--success-color)",
                }}
              ></span>
              <span>{"<"}20 Good</span>
            </button>
          </div>

          {/* Turnover Filter Row */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-light)', minWidth: '70px' }}>
              By Turnover:
            </span>
            <button
              onClick={() => setTurnoverFilter("all")}
              className={`btn ${turnoverFilter === "all" ? "btn-primary" : "btn-secondary"}`}
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
            >
              All
            </button>
            <button
              onClick={() => setTurnoverFilter(turnoverFilter === "below3" ? "all" : "below3")}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.9rem',
                borderRadius: '8px',
                cursor: 'pointer',
                border: turnoverFilter === "below3" ? '2px solid #7c3aed' : '1px solid var(--border-color)',
                backgroundColor: turnoverFilter === "below3" ? 'rgba(124, 58, 237, 0.1)' : 'white',
                color: turnoverFilter === "below3" ? '#7c3aed' : 'var(--text-color)',
                fontSize: '0.85rem',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: '0.95rem' }}>₹</span>
              Below 3 Cr
            </button>
            {turnoverFilter === "below3" && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginLeft: '0.5rem' }}>
                Showing <strong>{processedList.length}</strong> vendors with turnover ≤ 3 Cr (sorted ascending)
              </span>
            )}
          </div>

          {currentUser && (
            <div
              style={{
                display: "flex",
                gap: "1rem",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--text-light)",
                  minWidth: "70px",
                }}
              >
                By Source:
              </span>
              <button
                onClick={() => setSourceFilter("all")}
                className={`btn ${sourceFilter === "all" ? "btn-primary" : "btn-secondary"}`}
                style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
              >
                All
              </button>
              <button
                onClick={() =>
                  setSourceFilter(sourceFilter === "api" ? "all" : "api")
                }
                style={{
                  padding: "0.4rem 0.8rem",
                  borderRadius: "8px",
                  cursor: "pointer",
                  border:
                    sourceFilter === "api"
                      ? "2px solid #1e40af"
                      : "1px solid var(--border-color)",
                  backgroundColor: sourceFilter === "api" ? "#eff6ff" : "white",
                  color:
                    sourceFilter === "api" ? "#1e40af" : "var(--text-color)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  transition: "all 0.2s",
                }}
              >
                API (Success)
              </button>
              <button
                onClick={() =>
                  setSourceFilter(sourceFilter === "manual" ? "all" : "manual")
                }
                style={{
                  padding: "0.4rem 0.8rem",
                  borderRadius: "8px",
                  cursor: "pointer",
                  border:
                    sourceFilter === "manual"
                      ? "2px solid #b45309"
                      : "1px solid var(--border-color)",
                  backgroundColor:
                    sourceFilter === "manual" ? "#fff7ed" : "white",
                  color:
                    sourceFilter === "manual" ? "#b45309" : "var(--text-color)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  transition: "all 0.2s",
                }}
              >
                Manual Entries
              </button>
              <button
                onClick={() =>
                  setSourceFilter(sourceFilter === "error" ? "all" : "error")
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  padding: "0.4rem 0.8rem",
                  borderRadius: "8px",
                  cursor: "pointer",
                  border:
                    sourceFilter === "error"
                      ? "2px solid #b91c1c"
                      : "1px solid var(--border-color)",
                  backgroundColor:
                    sourceFilter === "error" ? "#fef2f2" : "white",
                  color:
                    sourceFilter === "error" ? "#b91c1c" : "var(--text-color)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  transition: "all 0.2s",
                }}
              >
                API Errors
              </button>

              {(scoreFilter !== "all" || sourceFilter !== "all") && (
                <span
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-light)",
                    marginLeft: "0.5rem",
                  }}
                >
                  Filtering: <strong>{processedList.length}</strong> items found
                </span>
              )}
            </div>
          )}
        </div>

        {/* Admin Refresh — sticky action bar */}
        {showRefreshPanel && currentUser?.role === "super_admin" && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.6rem 1rem",
              border: "1px solid #93c5fd",
              background: "#eff6ff",
              borderRadius: "8px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            {/* Select All */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                cursor: "pointer",
                fontWeight: 600,
                color: "#1e40af",
                fontSize: "0.88rem",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected;
                }}
                onChange={(e) => handleSelectAll(e.target.checked)}
                disabled={isRefreshing}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              Select All Non-Error
              <span style={{ fontWeight: 400, color: "#3b82f6" }}>
                ({allSelectableGstins.length})
              </span>
            </label>

            <span style={{ color: "#1e40af", fontSize: "0.85rem" }}>
              <strong>{selectedGstins.size}</strong> selected
            </span>

            <button
              className="btn btn-primary"
              onClick={handleAdminRefresh}
              disabled={isRefreshing || selectedGstins.size === 0}
              style={{
                background: "#2563eb",
                borderColor: "#2563eb",
                padding: "0.35rem 0.9rem",
                fontSize: "0.85rem",
              }}
            >
              {isRefreshing ? (
                <>
                  <span
                    className="spinner"
                    style={{ width: "13px", height: "13px" }}
                  />{" "}
                  Refreshing...
                </>
              ) : (
                <>
                  <CloudDownload size={14} /> Refresh{" "}
                  {selectedGstins.size > 0
                    ? `${selectedGstins.size} Selected`
                    : ""}
                </>
              )}
            </button>

            <span
              style={{
                fontSize: "0.75rem",
                color: "#3b82f6",
                fontStyle: "italic",
              }}
            >
              Check rows below to select · Error GSTINs are disabled
            </span>

            {refreshResult && (
              <div
                style={{
                  width: "100%",
                  marginTop: "0.25rem",
                  maxHeight: "180px",
                  overflowY: "auto",
                  fontSize: "0.8rem",
                }}
              >
                {refreshResult.error ? (
                  <span style={{ color: "#dc2626" }}>
                    {refreshResult.error}
                  </span>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#dbeafe" }}>
                        <th
                          style={{
                            padding: "0.25rem 0.5rem",
                            textAlign: "left",
                          }}
                        >
                          GSTIN
                        </th>
                        <th
                          style={{
                            padding: "0.25rem 0.5rem",
                            textAlign: "left",
                          }}
                        >
                          Result
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(refreshResult).map(([gstin, result]) => (
                        <tr
                          key={gstin}
                          style={{ borderBottom: "1px solid #bfdbfe" }}
                        >
                          <td
                            style={{
                              padding: "0.2rem 0.5rem",
                              fontFamily: "monospace",
                            }}
                          >
                            {gstin}
                          </td>
                          <td
                            style={{
                              padding: "0.2rem 0.5rem",
                              color:
                                result === "refreshed" ? "#16a34a" : "#dc2626",
                            }}
                          >
                            {result}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pending / Error Score Section */}
        {pendingList.length > 0 && viewMode !== "grid" && (
          <div style={{ marginBottom: "1.5rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                background: "linear-gradient(135deg, #7c3a00 0%, #3d1f00 100%)",
                border: "1px solid #f97316",
                borderRadius: "8px 8px 0 0",
                padding: "0.65rem 1rem",
              }}
            >
              <AlertCircle
                size={18}
                style={{ color: "#f97316", flexShrink: 0 }}
              />
              <span
                style={{
                  color: "#fed7aa",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                }}
              >
                Pending / Error GSTs ({pendingList.length}) — Data not yet
                available
              </span>
            </div>

            {viewMode === "list" ? (
              <div
                className="gst-table-wrapper card"
                style={{
                  padding: 0,
                  overflowX: "auto",
                  borderRadius: "0 0 8px 8px",
                  border: "1px solid #f97316",
                  borderTop: "none",
                }}
              >
                <table className="gst-table" style={{ minWidth: "700px" }}>
                  <thead style={{ background: "rgba(249,115,22,0.12)" }}>
                    <tr>
                      {showRefreshPanel && (
                        <th style={{ width: "36px", textAlign: "center" }}></th>
                      )}
                      <th style={{ width: "40px" }}>#</th>
                      <th>GSTIN</th>
                      <th>Trade Name</th>
                      <th style={{ textAlign: "center", width: "100px" }}>
                        Score
                      </th>
                      <th>Last Updated On</th>
                      <th>Last Updated By</th>
                      <th style={{ textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingList.map((gst, index) => (
                      <tr
                        key={gst.gstin}
                        style={{ background: "rgba(249,115,22,0.05)" }}
                      >
                        {showRefreshPanel && (
                          <td style={{ textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={selectedGstins.has(gst.gstin)}
                              onChange={() => handleToggleGstin(gst.gstin)}
                              disabled={!!gst.apiError || isRefreshing}
                              title={
                                gst.apiError
                                  ? "API error — enter data manually to enable"
                                  : ""
                              }
                              style={{
                                width: "15px",
                                height: "15px",
                                cursor: gst.apiError
                                  ? "not-allowed"
                                  : "pointer",
                                opacity: gst.apiError ? 0.4 : 1,
                              }}
                            />
                          </td>
                        )}
                        <td
                          style={{
                            color: "var(--text-light)",
                            fontWeight: 500,
                            textAlign: "center",
                          }}
                        >
                          {index + 1}
                        </td>
                        <td
                          className="gstin-cell"
                          style={{ whiteSpace: "nowrap" }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            {gst.gstin}
                            <button
                              className="ghost-btn"
                              onClick={() => handleCopy(gst.gstin)}
                              title="Copy GSTIN"
                              style={{
                                padding: "0.2rem",
                                color:
                                  copiedGstin === gst.gstin
                                    ? "var(--success-color)"
                                    : "var(--text-light)",
                              }}
                            >
                              {copiedGstin === gst.gstin ? (
                                <Check size={14} />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                        </td>
                        <td>{gst.tradeName || gst.legalName || "N/A"}</td>
                        <td style={{ textAlign: "center" }}>
                          <span
                            className={`score-badge score-badge-sm ${getScoreColor(gst.grcScore, thresholds)}`}
                            style={{ margin: "0 auto" }}
                          >
                            {gst.grcScore ?? "-"}
                          </span>
                        </td>
                        <td style={{ color: "var(--text-light)" }}>
                          {gst.scoreCalculatedAt
                            ? new Date(gst.scoreCalculatedAt).toLocaleString(
                                "en-IN",
                                {
                                  timeZone: "Asia/Kolkata",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                },
                              )
                            : "Never"}
                        </td>
                        <td
                          style={{
                            color: "var(--primary-color)",
                            fontWeight: 500,
                          }}
                        >
                          {gst.updatedBy || "-"}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => setSelectedGst(gst)}
                            title="View Details"
                            style={{ padding: "0.3rem" }}
                          >
                            <Eye size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : viewMode === "grid" ? (
              <div
                className="gst-grid"
                style={{
                  border: "1px solid #f97316",
                  borderTop: "none",
                  borderRadius: "0 0 8px 8px",
                  padding: "1.25rem",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "1rem",
                }}
              >
                {pendingList.map((gst, index) => (
                  <div
                    key={gst.gstin}
                    style={{
                      background: "rgba(249,115,22,0.05)",
                      border: "1px solid rgba(249,115,22,0.3)",
                      borderRadius: "12px",
                      padding: "0.85rem 1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.6rem",
                      boxShadow: "0 2px 4px rgba(249,115,22,0.1)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "0.6rem",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            color: "#f97316",
                            fontWeight: 600,
                            fontSize: "0.8rem",
                          }}
                        >
                          #{index + 1}
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: "1.05rem",
                            color: "#fed7aa",
                            letterSpacing: "0.5px",
                          }}
                        >
                          {gst.gstin}
                        </span>
                        {gst.apiError && (
                          <span
                            style={{
                              background: "#fee2e2",
                              color: "#991b1b",
                              fontSize: "0.6rem",
                              fontWeight: 700,
                              padding: "0.1rem 0.35rem",
                              borderRadius: "3px",
                              border: "1px solid #fca5a5",
                            }}
                          >
                            API Error
                          </span>
                        )}
                      </div>
                      <div
                        className={`score-badge ${getScoreColor(gst.grcScore, thresholds)}`}
                        style={{
                          fontSize: "1rem",
                          fontWeight: 700,
                          padding: "0.2rem 0.6rem",
                          minWidth: "36px",
                          textAlign: "center",
                        }}
                      >
                        {gst.grcScore ?? "-"}
                      </div>
                    </div>

                    <div
                      style={{
                        height: "1px",
                        background: "rgba(249,115,22,0.2)",
                      }}
                    ></div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.2fr 1fr",
                        gap: "0.4rem 0.5rem",
                        fontSize: "0.8rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          paddingRight: "0.5rem",
                        }}
                      >
                        <span style={{ color: "#fdba74", opacity: 0.9 }}>
                          Status:
                        </span>
                        <span style={{ color: "#fed7aa", fontWeight: 600 }}>
                          {gst.gstStatus || "N/A"}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: "#fdba74", opacity: 0.9 }}>
                          Age:
                        </span>
                        <span style={{ color: "#fed7aa", fontWeight: 600 }}>
                          {gst.registrationDate ? "Pending" : "N/A"}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          paddingRight: "0.5rem",
                        }}
                      >
                        <span style={{ color: "#fdba74", opacity: 0.9 }}>
                          Type:
                        </span>
                        <span style={{ color: "#fed7aa", fontWeight: 600 }}>
                          {gst.gstType ? gst.gstType.split(" ")[0] : "N/A"}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        {/* Empty to balance grid */}
                      </div>
                      <div
                        style={{
                          gridColumn: "span 2",
                          display: "flex",
                          justifyContent: "space-between",
                          marginTop: "0.2rem",
                        }}
                      >
                        <span
                          style={{
                            color: "#fdba74",
                            opacity: 0.9,
                            minWidth: "65px",
                          }}
                        >
                          Turnover:
                        </span>
                        <span
                          style={{
                            color: "#fed7aa",
                            fontWeight: 600,
                            textAlign: "right",
                          }}
                        >
                          {!gst.aggregateTurnover ||
                          gst.aggregateTurnover === "0" ||
                          gst.aggregateTurnover === 0
                            ? "N/A"
                            : gst.aggregateTurnover}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: "0.4rem",
                        borderTop: "1px dashed rgba(249,115,22,0.3)",
                        paddingTop: "0.4rem",
                        fontSize: "0.7rem",
                        color: "#fed7aa",
                        opacity: 0.8,
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>Updated:</span>
                      <span>
                        {gst.scoreCalculatedAt
                          ? new Date(gst.scoreCalculatedAt).toLocaleString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )
                          : "N/A"}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: "0.4rem",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "#fdba74",
                          opacity: 0.7,
                          fontStyle: "italic",
                        }}
                      >
                        Details Pending
                      </span>
                      <button
                        className="btn btn-sm"
                        onClick={() => setSelectedGst(gst)}
                        style={{
                          padding: "0.25rem 0.5rem",
                          background: "transparent",
                          border: "1px solid rgba(249,115,22,0.4)",
                          color: "#fed7aa",
                          fontSize: "0.75rem",
                          borderRadius: "4px",
                        }}
                      >
                        <Eye size={14} style={{ marginRight: "4px" }} /> View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  border: "1px solid #f97316",
                  borderTop: "none",
                  borderRadius: "0 0 8px 8px",
                  padding: "1rem",
                }}
              >
                {pendingList.map((gst, index) => (
                  <div
                    key={gst.gstin}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    {showRefreshPanel && (
                      <input
                        type="checkbox"
                        checked={selectedGstins.has(gst.gstin)}
                        onChange={() => handleToggleGstin(gst.gstin)}
                        disabled={!!gst.apiError || isRefreshing}
                        title={
                          gst.apiError
                            ? "API error — enter data manually to enable"
                            : ""
                        }
                        style={{
                          width: "15px",
                          height: "15px",
                          flexShrink: 0,
                          cursor: gst.apiError ? "not-allowed" : "pointer",
                          opacity: gst.apiError ? 0.4 : 1,
                        }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <GstQuickEditRow
                        index={index + 1}
                        gst={gst}
                        getScoreColor={(score) =>
                          getScoreColor(score, thresholds)
                        }
                        onUpdate={handleUpdateItemInList}
                        currentUser={currentUser}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {viewMode === "list" ? (
          <div
            className="gst-table-wrapper card"
            style={{
              padding: 0,
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              width: "100%",
            }}
          >
            <table className="gst-table" style={{ minWidth: "700px" }}>
              <thead>
                <tr>
                  {showRefreshPanel && (
                    <th style={{ width: "36px", textAlign: "center" }}></th>
                  )}
                  <th style={{ width: "40px" }}>#</th>
                  <th>GSTIN</th>
                  <th>Trade Name</th>
                  <th style={{ textAlign: "center" }}>GRC Score</th>
                  <th>Last Updated On</th>
                  <th>Last Updated By</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedNormalList.length > 0 ? (
                  paginatedNormalList.map((gst, index) => (
                    <tr
                      key={gst.gstin}
                      className={`gst-table-row ${recentlyAdded.has(gst.gstin) ? "new-item" : ""}`}
                      style={
                        showRefreshPanel && selectedGstins.has(gst.gstin)
                          ? { background: "#eff6ff" }
                          : {}
                      }
                    >
                      {showRefreshPanel && (
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={selectedGstins.has(gst.gstin)}
                            onChange={() => handleToggleGstin(gst.gstin)}
                            disabled={!!gst.apiError || isRefreshing}
                            title={
                              gst.apiError ? "API error — select manually" : ""
                            }
                            style={{
                              width: "15px",
                              height: "15px",
                              cursor: gst.apiError ? "not-allowed" : "pointer",
                              opacity: gst.apiError ? 0.4 : 1,
                            }}
                          />
                        </td>
                      )}
                      <td
                        style={{
                          color: "var(--text-light)",
                          fontWeight: 500,
                          textAlign: "center",
                        }}
                      >
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </td>
                      <td
                        className="gstin-cell"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            flexWrap: "wrap",
                          }}
                        >
                          {gst.gstin}
                          <button
                            className="ghost-btn"
                            onClick={() => handleCopy(gst.gstin)}
                            title="Copy GSTIN"
                            style={{
                              padding: "0.2rem",
                              color:
                                copiedGstin === gst.gstin
                                  ? "var(--success-color)"
                                  : "var(--text-light)",
                            }}
                          >
                            {copiedGstin === gst.gstin ? (
                              <Check size={14} />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                          {gst.apiError && (
                            <span
                              style={{
                                background: "#fee2e2",
                                color: "#991b1b",
                                border: "1px solid #fca5a5",
                                fontSize: "0.65rem",
                                fontWeight: 700,
                                padding: "0.1rem 0.4rem",
                                borderRadius: "4px",
                              }}
                              title="API failed"
                            >
                              Error (API)
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{gst.tradeName || gst.legalName || "N/A"}</td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          className={`score-badge score-badge-sm ${getScoreColor(gst.grcScore, thresholds)}`}
                          style={{ margin: "0 auto" }}
                        >
                          {gst.grcScore ?? "-"}
                        </span>
                      </td>
                      <td>
                        {gst.scoreCalculatedAt
                          ? new Date(gst.scoreCalculatedAt).toLocaleString(
                              "en-IN",
                              {
                                timeZone: "Asia/Kolkata",
                                hour: "2-digit",
                                minute: "2-digit",
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              },
                            )
                          : "Never"}
                      </td>
                      <td>{gst.updatedBy || "-"}</td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setSelectedGst(gst)}
                          title="View Details"
                          style={{ padding: "0.3rem" }}
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={showRefreshPanel ? 8 : 7}
                      style={{
                        textAlign: "center",
                        padding: "2rem",
                        color: "var(--text-light)",
                      }}
                    >
                      {processedList.length === 0
                        ? "No GST numbers found matching your criteria."
                        : "All entries have pending scores."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : viewMode === "grid" ? (
          <div className="gst-grid">
            {paginatedNormalList.length > 0 ? (
              paginatedNormalList.map((gst, index) => (
                <div key={gst.gstin} style={{ position: "relative" }}>
                  {showRefreshPanel && (
                    <input
                      type="checkbox"
                      checked={selectedGstins.has(gst.gstin)}
                      onChange={() => handleToggleGstin(gst.gstin)}
                      disabled={!!gst.apiError || isRefreshing}
                      title={gst.apiError ? "API error — select manually" : ""}
                      style={{
                        position: "absolute",
                        top: "10px",
                        left: "10px",
                        zIndex: 10,
                        width: "16px",
                        height: "16px",
                        cursor: gst.apiError ? "not-allowed" : "pointer",
                        opacity: gst.apiError ? 0.4 : 1,
                      }}
                    />
                  )}
                  <GstCard
                    gst={gst}
                    index={(currentPage - 1) * itemsPerPage + index + 1}
                    isNew={recentlyAdded.has(gst.gstin)}
                    isFirstFetch={false}
                    onClick={
                      showRefreshPanel
                        ? () => handleToggleGstin(gst.gstin)
                        : setSelectedGst
                    }
                    thresholds={thresholds}
                  />
                </div>
              ))
            ) : (
              <div
                style={{
                  gridColumn: "1 / -1",
                  textAlign: "center",
                  padding: "3rem",
                  color: "var(--text-light)",
                }}
              >
                <p>No GST numbers found matching your criteria.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="gst-quick-edit-list">
            {paginatedNormalList.length > 0 ? (
              paginatedNormalList.map((gst, index) => (
                <div
                  key={gst.gstin}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  {showRefreshPanel && (
                    <input
                      type="checkbox"
                      checked={selectedGstins.has(gst.gstin)}
                      onChange={() => handleToggleGstin(gst.gstin)}
                      disabled={!!gst.apiError || isRefreshing}
                      title={gst.apiError ? "API error — select manually" : ""}
                      style={{
                        width: "15px",
                        height: "15px",
                        flexShrink: 0,
                        cursor: gst.apiError ? "not-allowed" : "pointer",
                        opacity: gst.apiError ? 0.4 : 1,
                      }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <GstQuickEditRow
                      index={(currentPage - 1) * itemsPerPage + index + 1}
                      gst={gst}
                      getScoreColor={(score) =>
                        getScoreColor(score, thresholds)
                      }
                      onUpdate={handleUpdateItemInList}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div
                className="card"
                style={{
                  textAlign: "center",
                  padding: "3rem",
                  color: "var(--text-light)",
                }}
              >
                <p>No GST numbers found matching your criteria.</p>
              </div>
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1rem", marginTop: "2rem", padding: "1rem" }}>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <span style={{ fontSize: "0.9rem", color: "var(--text-light)" }}>
              Page <span style={{ fontWeight: "600", color: "var(--text-color)" }}>{currentPage}</span> of {totalPages}
            </span>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {selectedGst && (
        <GstDetailsModal
          gst={selectedGst}
          onClose={() => setSelectedGst(null)}
          onUpdate={handleUpdateItemInList}
          onDelete={handleDeleteGstin}
          currentUser={currentUser}
          thresholds={thresholds}
        />
      )}

      {showFetchModal && (
        <div
          className="modal-overlay"
          onClick={() => !isFetchingNew && setShowFetchModal(false)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "500px" }}
          >
            <div className="modal-header">
              <h2>Fetch New GST Details</h2>
              <button
                className="close-btn"
                onClick={() => !isFetchingNew && setShowFetchModal(false)}
              >
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              {fetchError && (
                <div
                  style={{
                    color: "white",
                    backgroundColor: "var(--danger-color)",
                    padding: "0.75rem",
                    borderRadius: "4px",
                    marginBottom: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.9rem",
                  }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />{" "}
                  {fetchError}
                </div>
              )}
              <form onSubmit={handleFetchNewGst}>
                <div className="input-group" style={{ marginBottom: "1.5rem" }}>
                  <label
                    style={{
                      marginBottom: "0.5rem",
                      display: "block",
                      fontWeight: "500",
                    }}
                  >
                    Enter GSTIN (comma separated for multiple):
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 06ACUPK1294L2ZZ"
                    value={newGstInput}
                    onChange={(e) => {
                      setNewGstInput(e.target.value.toUpperCase());
                      setFetchError("");
                    }}
                    autoFocus
                  />
                  <small
                    style={{
                      color: "var(--text-light)",
                      display: "block",
                      marginTop: "0.5rem",
                    }}
                  >
                    Must be a valid 15-character GST number.
                  </small>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "0.5rem",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowFetchModal(false)}
                    disabled={isFetchingNew}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isFetchingNew || !newGstInput.trim()}
                  >
                    {isFetchingNew ? (
                      <span
                        className="spinner"
                        style={{ width: "16px", height: "16px" }}
                      ></span>
                    ) : (
                      "Fetch & Save"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showNewVendors && (
        <NewVendorsModal
          onClose={() => setShowNewVendors(false)}
          onSelectGstin={(gstin) => {
            setShowNewVendors(false);
            const gst = gstList.find((g) => g.gstin === gstin);
            if (gst) setSelectedGst(gst);
          }}
          onOpenGstr7={(pan) => {
            setShowNewVendors(false);
            onOpenGstr7 && onOpenGstr7(pan);
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
