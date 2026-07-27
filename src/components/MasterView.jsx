import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Table2, RefreshCw, Loader2, CheckCircle2, XCircle, Search, ArrowUp, ArrowDown, ArrowUpDown, CloudDownload } from "lucide-react";
import { apiClient } from "../api/apiClient";
import { getGstr7Display } from "../utils/gstr7Display";
import GstDetailsModal from "./GstDetailsModal";

const REFRESH_ICON_RESET_MS = 3000;

const DATE_TIME_OPTS = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
};

// Matches the "Last Updated" formatting used in the grid view (GstCard).
const formatGstLastUpdated = (value) => {
  if (!value) return "N/A";
  return new Date(value).toLocaleString("en-IN", DATE_TIME_OPTS).toLowerCase();
};

// Matches the GSTR-7 "Last Updated" formatting used in the grid view (GstCard).
const formatGstr7LastUpdated = (value) => {
  if (!value) return "N/A";
  return new Date(value).toLocaleString("en-GB", DATE_TIME_OPTS);
};

const SORT_FIELD_KEYS = {
  gstLastUpdated: "scoreCalculatedAt",
  gstr7LastUpdated: "gstr7LastUpdated",
};

const GSTR7_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "toBeUpdated", label: "To Be Updated" },
  { value: "notRegistered", label: "Not Registered" },
  { value: "registered", label: "Registered" },
  { value: "others", label: "Others" },
];

// Buckets a company into one of the GSTR7 filter categories using the same
// text getGstr7Display renders in the "GSTR7 No" column.
const getGstr7Category = (c) => {
  const text = getGstr7Display(c).gstr7.text;
  if (text === "To Be Updated") return "toBeUpdated";
  if (text === "Not Registered") return "notRegistered";
  if (text === "Registered") return "registered";
  return "others";
};

const MasterView = ({ currentUser }) => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshStatus, setRefreshStatus] = useState({}); // { [gstin]: 'loading' | 'success' | 'error' }
  const [searchTerm, setSearchTerm] = useState("");
  const [gstr7Filter, setGstr7Filter] = useState("all");
  const [sortField, setSortField] = useState("gstLastUpdated"); // 'gstLastUpdated' | 'gstr7LastUpdated'
  const [sortDirection, setSortDirection] = useState("desc"); // 'asc' | 'desc'
  const [showRefreshPanel, setShowRefreshPanel] = useState(false);
  const [selectedGstins, setSelectedGstins] = useState(new Set());
  const [isBulkRefreshing, setIsBulkRefreshing] = useState(false);
  const [bulkRefreshResult, setBulkRefreshResult] = useState(null);
  const [selectedGst, setSelectedGst] = useState(null);
  const [thresholds, setThresholds] = useState({});

  const fetchCompanies = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getDetails();
      setCompanies(data || []);
    } catch (err) {
      setError(err.message || "Failed to fetch companies.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
    apiClient
      .getRuleConfig()
      .then((config) => {
        const configMap = {};
        config.forEach((item) => (configMap[item.configKey] = item.configValue));
        setThresholds(configMap);
      })
      .catch(() => {});
  }, [fetchCompanies]);

  const handleUpdateItemInList = (updatedItem) => {
    setCompanies((prev) =>
      prev.map((item) => (item.gstin === updatedItem.gstin ? updatedItem : item))
    );
    if (selectedGst && selectedGst.gstin === updatedItem.gstin) {
      const { _openModal, ...cleanItem } = updatedItem;
      setSelectedGst(cleanItem);
    }
  };

  const handleDeleteGstin = (deletedGstin) => {
    setCompanies((prev) => prev.filter((item) => item.gstin !== deletedGstin));
  };

  const sortedCompanies = useMemo(() => {
    const fieldKey = SORT_FIELD_KEYS[sortField];
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...companies].sort((a, b) => {
      const aTime = a[fieldKey] ? new Date(a[fieldKey]).getTime() : -Infinity;
      const bTime = b[fieldKey] ? new Date(b[fieldKey]).getTime() : -Infinity;
      return (aTime - bTime) * dir;
    });
  }, [companies, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const filteredCompanies = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return sortedCompanies.filter((c) => {
      if (gstr7Filter !== "all" && getGstr7Category(c) !== gstr7Filter) return false;
      if (!q) return true;
      const pan = c.panNumber || (c.gstin ? c.gstin.substring(2, 12) : "");
      return (
        c.tradeName?.toLowerCase().includes(q) ||
        c.legalName?.toLowerCase().includes(q) ||
        c.gstin?.toLowerCase().includes(q) ||
        pan.toLowerCase().includes(q) ||
        c.gstdNo?.toLowerCase().includes(q)
      );
    });
  }, [sortedCompanies, searchTerm, gstr7Filter]);

  const allSelectableGstins = useMemo(
    () => filteredCompanies.filter((c) => !c.apiError).map((c) => c.gstin),
    [filteredCompanies]
  );
  const allSelected =
    allSelectableGstins.length > 0 &&
    allSelectableGstins.every((g) => selectedGstins.has(g));
  const someSelected = allSelectableGstins.some((g) => selectedGstins.has(g));

  const handleToggleGstin = (gstin) => {
    setSelectedGstins((prev) => {
      const next = new Set(prev);
      if (next.has(gstin)) next.delete(gstin);
      else next.add(gstin);
      return next;
    });
  };

  const handleSelectAll = (checked) => {
    setSelectedGstins(checked ? new Set(allSelectableGstins) : new Set());
  };

  const handleBulkRefresh = async () => {
    if (selectedGstins.size === 0) return;
    setIsBulkRefreshing(true);
    setBulkRefreshResult(null);
    try {
      const result = await apiClient.refreshGstFromApi(
        [...selectedGstins],
        currentUser?.name
      );
      setBulkRefreshResult(result);
      setSelectedGstins(new Set());
      await fetchCompanies(true);
    } catch (err) {
      setBulkRefreshResult({ error: err.message || "Refresh failed" });
    } finally {
      setIsBulkRefreshing(false);
    }
  };

  const handleRefresh = async (gstin) => {
    setRefreshStatus((prev) => ({ ...prev, [gstin]: "loading" }));
    try {
      await apiClient.refreshGstFromApi([gstin], currentUser?.name);
      setRefreshStatus((prev) => ({ ...prev, [gstin]: "success" }));
      await fetchCompanies(true);
    } catch (err) {
      setRefreshStatus((prev) => ({ ...prev, [gstin]: "error" }));
    }
    setTimeout(() => {
      setRefreshStatus((prev) => {
        const next = { ...prev };
        delete next[gstin];
        return next;
      });
    }, REFRESH_ICON_RESET_MS);
  };

  return (
    <div style={{ padding: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        <button
          className="btn btn-secondary"
          onClick={() => navigate("/")}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <h2
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            margin: 0,
          }}
        >
          <Table2 size={20} /> Master View
        </h2>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <div className="search-bar" style={{ maxWidth: "360px", flex: 1 }}>
          <div style={{ position: "relative", width: "100%" }}>
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
              placeholder="Search by name, GSTN, PAN or GSTR7 no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: "2.5rem" }}
            />
          </div>
        </div>

        {currentUser?.role === "super_admin" && (
          <button
            className="btn btn-secondary"
            onClick={() => {
              if (!showRefreshPanel) {
                setSelectedGstins(new Set());
                setBulkRefreshResult(null);
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
      </div>

      <div className="view-toggle" style={{ marginBottom: "1rem", width: "fit-content" }}>
        {GSTR7_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`view-toggle-btn ${gstr7Filter === opt.value ? "active" : ""}`}
            onClick={() => setGstr7Filter(opt.value)}
            style={{ padding: "0.5rem 1rem" }}
          >
            {opt.label}
          </button>
        ))}
      </div>

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
              disabled={isBulkRefreshing}
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
            onClick={handleBulkRefresh}
            disabled={isBulkRefreshing || selectedGstins.size === 0}
            style={{
              background: "#2563eb",
              borderColor: "#2563eb",
              padding: "0.35rem 0.9rem",
              fontSize: "0.85rem",
            }}
          >
            {isBulkRefreshing ? (
              <>
                <span className="spinner" style={{ width: "13px", height: "13px" }} />{" "}
                Refreshing...
              </>
            ) : (
              <>
                <CloudDownload size={14} /> Refresh{" "}
                {selectedGstins.size > 0 ? `${selectedGstins.size} Selected` : ""}
              </>
            )}
          </button>

          <span style={{ fontSize: "0.75rem", color: "#3b82f6", fontStyle: "italic" }}>
            Check rows below to select · Error GSTINs are disabled
          </span>

          {bulkRefreshResult && (
            <div
              style={{
                width: "100%",
                marginTop: "0.25rem",
                maxHeight: "180px",
                overflowY: "auto",
                fontSize: "0.8rem",
              }}
            >
              {bulkRefreshResult.error ? (
                <span style={{ color: "#dc2626" }}>{bulkRefreshResult.error}</span>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#dbeafe" }}>
                      <th style={{ padding: "0.25rem 0.5rem", textAlign: "left" }}>GSTIN</th>
                      <th style={{ padding: "0.25rem 0.5rem", textAlign: "left" }}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(bulkRefreshResult).map(([gstin, result]) => (
                      <tr key={gstin} style={{ borderBottom: "1px solid #bfdbfe" }}>
                        <td style={{ padding: "0.2rem 0.5rem", fontFamily: "monospace" }}>
                          {gstin}
                        </td>
                        <td
                          style={{
                            padding: "0.2rem 0.5rem",
                            color: result === "refreshed" ? "#16a34a" : "#dc2626",
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

      {loading ? (
        <div
          style={{ display: "flex", justifyContent: "center", padding: "3rem" }}
        >
          <div className="spinner"></div>
        </div>
      ) : (
        <div
          className="gst-table-wrapper card"
          style={{ padding: 0, overflowX: "auto" }}
        >
          <table className="gst-table" style={{ minWidth: "900px" }}>
            <thead>
              <tr>
                {showRefreshPanel && (
                  <th style={{ width: "36px", textAlign: "center" }}></th>
                )}
                <th>S.No</th>
                <th>Company Name</th>
                <th>GSTN</th>
                <th>PAN</th>
                <th>GSTR7 No</th>
                <th
                  onClick={() => handleSort("gstLastUpdated")}
                  style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                  title="Sort by GST last updated"
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    GST Last Updated
                    {sortField === "gstLastUpdated" ? (
                      sortDirection === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                    ) : (
                      <ArrowUpDown size={13} style={{ opacity: 0.4 }} />
                    )}
                  </span>
                </th>
                <th
                  onClick={() => handleSort("gstr7LastUpdated")}
                  style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                  title="Sort by GSTR7 last updated"
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    GSTR7 Last Updated
                    {sortField === "gstr7LastUpdated" ? (
                      sortDirection === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                    ) : (
                      <ArrowUpDown size={13} style={{ opacity: 0.4 }} />
                    )}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={showRefreshPanel ? 8 : 7} style={{ textAlign: "center", padding: "2rem" }}>
                    {searchTerm ? "No matching companies found." : "No companies found."}
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((c, index) => {
                  const pan = c.panNumber || (c.gstin ? c.gstin.substring(2, 12) : "N/A");
                  const status = refreshStatus[c.gstin];
                  const gstr7 = getGstr7Display(c).gstr7;

                  let refreshIcon = <RefreshCw size={14} />;
                  let refreshColor = "var(--text-light)";
                  let refreshTitle = "Refresh from API";
                  if (status === "loading") {
                    refreshIcon = <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />;
                    refreshTitle = "Refreshing...";
                  } else if (status === "success") {
                    refreshIcon = <CheckCircle2 size={14} />;
                    refreshColor = "var(--success-color)";
                    refreshTitle = "Refresh successful";
                  } else if (status === "error") {
                    refreshIcon = <XCircle size={14} />;
                    refreshColor = "#dc2626";
                    refreshTitle = "Refresh failed";
                  }

                  return (
                    <tr
                      key={c.gstin}
                      className="gst-table-row"
                      style={
                        showRefreshPanel && selectedGstins.has(c.gstin)
                          ? { background: "#eff6ff" }
                          : {}
                      }
                    >
                      {showRefreshPanel && (
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={selectedGstins.has(c.gstin)}
                            onChange={() => handleToggleGstin(c.gstin)}
                            disabled={!!c.apiError || isBulkRefreshing}
                            title={c.apiError ? "API error — select manually" : ""}
                            style={{
                              width: "15px",
                              height: "15px",
                              cursor: c.apiError ? "not-allowed" : "pointer",
                              opacity: c.apiError ? 0.4 : 1,
                            }}
                          />
                        </td>
                      )}
                      <td className="row-num">{index + 1}</td>
                      <td>{c.tradeName || c.legalName || "N/A"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <span
                            onClick={() => setSelectedGst(c)}
                            style={{ cursor: "pointer", textDecoration: "underline" }}
                            title="View GSTN details"
                          >
                            {c.gstin}
                          </span>
                          <button
                            className="ghost-btn"
                            onClick={() => handleRefresh(c.gstin)}
                            disabled={!!status}
                            title={refreshTitle}
                            style={{
                              padding: "0.2rem",
                              border: "none",
                              background: "transparent",
                              color: refreshColor,
                              display: "inline-flex",
                            }}
                          >
                            {refreshIcon}
                          </button>
                        </div>
                      </td>
                      <td>{pan}</td>
                      <td>
                        <span
                          onClick={() => navigate(`/grc/gstr7/${c.gstin}`)}
                          style={{
                            display: "inline-block",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            background: gstr7.bg,
                            color: gstr7.color,
                            border: `1px solid ${gstr7.border}`,
                          }}
                        >
                          {gstr7.text}
                        </span>
                      </td>
                      <td>{formatGstLastUpdated(c.scoreCalculatedAt)}</td>
                      <td>{formatGstr7LastUpdated(c.gstr7LastUpdated)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

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
    </div>
  );
};

export default MasterView;
