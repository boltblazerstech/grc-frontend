import React, { useState, useEffect } from "react";
import { X, CheckCircle2, XCircle, Clock } from "lucide-react";
import { apiClient } from "../api/apiClient";

const Gstr7Timeline = ({ gstin, onClose }) => {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const getRelevantPeriods = () => {
    const today = new Date();
    const periods = [];
    // Till 11th, upto month-2. From 12th, upto month-1.
    let latestDate = new Date(today.getFullYear(), today.getMonth());
    if (today.getDate() <= 11) {
      latestDate.setMonth(latestDate.getMonth() - 2);
    } else {
      latestDate.setMonth(latestDate.getMonth() - 1);
    }

    for (let i = 0; i < 12; i++) {
      const d = new Date(latestDate.getFullYear(), latestDate.getMonth() - i);
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      periods.push(`${yr}-${mo}`);
    }
    return periods.reverse(); // Ascending order
  };

  useEffect(() => {
    apiClient
      .getGstr7FilingDetails(gstin)
      .then((data) => {
        if (!data || data.length === 0) {
          setHistory([]);
          return;
        }
        const relevantPeriods = getRelevantPeriods();
        const fetchedMap = {};
        (data || []).forEach((item) => {
          fetchedMap[item.returnPeriod] = item;
        });

        let earliestPeriod = null;
        if (data && data.length > 0) {
          earliestPeriod = data.reduce((min, p) => p.returnPeriod < min ? p.returnPeriod : min, data[0].returnPeriod);
        }

        const fullHistory = relevantPeriods.map((period) => {
          if (fetchedMap[period]) {
            return fetchedMap[period];
          }
          if (earliestPeriod && period < earliestPeriod) {
            return {
              returnPeriod: period,
              status: "NA",
              dateOfFiling: null,
            };
          }
          return {
            returnPeriod: period,
            status: "Missed",
            dateOfFiling: null,
          };
        });

        setHistory(fullHistory);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [gstin]);

  const formatMonth = (period) => {
    if (!period) return "";
    const [year, month] = period.split("-");
    const date = new Date(year, parseInt(month) - 1);
    return {
      mon: date.toLocaleString("default", { month: "short" }),
      yr: year,
    };
  };

  const formatFiledDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const missedPeriods = history
    ? history.filter((h) => h.status === "Missed")
    : [];

  return (
    <div
      style={{
        marginTop: "1rem",
        padding: "1rem",
        backgroundColor: "#fafafa",
        border: "1px solid var(--border-color)",
        borderRadius: "8px",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            color: "var(--text-dark)",
          }}
        >
          GSTR-7 Filing History{" "}
          <span style={{ color: "var(--text-light)", fontWeight: 500 }}>
            (Last 12 Months)
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-light)",
          }}
        >
          <X size={16} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "1rem" }}>
          <span className="spinner"></span>
        </div>
      ) : error ? (
        <div
          style={{
            color: "var(--danger-color)",
            fontSize: "0.8rem",
            textAlign: "center",
          }}
        >
          Failed to load history.
        </div>
      ) : history.length === 0 ? (
        <div
          style={{
            color: "#856404",
            fontSize: "0.8rem",
            textAlign: "center",
            padding: "1.25rem 1rem",
            backgroundColor: "#fffbeb",
            border: "1px dashed #ffeeba",
            borderRadius: "8px",
            lineHeight: 1.5,
          }}
        >
          <strong>⚠️ No monthly filing history has been imported yet for this vendor.</strong>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto", paddingBottom: "0.5rem" }}>
            <div
              style={{
                display: "flex",
                minWidth: "max-content",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                backgroundColor: "white",
              }}
            >
              {/* Row Headers */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "80px",
                  borderRight: "1px solid var(--border-color)",
                  backgroundColor: "#f8f9fa",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  color: "var(--text-dark)",
                }}
              >
                <div
                  style={{
                    height: "50px",
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: "0.5rem",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  Month
                </div>
                <div
                  style={{
                    height: "40px",
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: "0.5rem",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  Status
                </div>
                <div
                  style={{
                    height: "40px",
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: "0.5rem",
                  }}
                >
                  Filed On
                </div>
              </div>

              {/* Data Columns */}
              {history.map((item, i) => {
                const { mon, yr } = formatMonth(item.returnPeriod);
                const isMissed = item.status === "Missed";
                const isRegular = item.status === "Regular without delay";
                const isDelayed = item.status === "Regular with Delay";
                const isNA = item.status === "NA";

                return (
                  <div
                    key={item.id || i}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      width: "60px",
                      borderRight:
                        i < history.length - 1 ? "1px solid #f0f0f0" : "none",
                      textAlign: "center",
                      fontSize: "0.75rem",
                    }}
                  >
                    <div
                      style={{
                        height: "50px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        borderBottom: "1px solid #f0f0f0",
                        color: "var(--text-dark)",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{mon}</span>
                      <span
                        style={{
                          color: "var(--text-light)",
                          fontSize: "0.65rem",
                        }}
                      >
                        {yr}
                      </span>
                    </div>
                    <div
                      style={{
                        height: "40px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderBottom: "1px solid #f0f0f0",
                      }}
                    >
                      {isRegular ? (
                        <CheckCircle2
                          size={18}
                          color="#10b981"
                          fill="#ecfdf5"
                        />
                      ) : isMissed ? (
                        <XCircle size={18} color="#ef4444" fill="#fef2f2" />
                      ) : isNA ? (
                        <span style={{ fontSize: "0.8rem", color: "var(--text-light)", fontWeight: 600 }}>N/A</span>
                      ) : (
                        <Clock size={18} color="#f59e0b" fill="#fffbeb" />
                      )}
                    </div>
                    <div
                      style={{
                        height: "40px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--text-light)",
                        fontSize: "0.7rem",
                      }}
                    >
                      {isNA ? "-" : formatFiledDate(item.dateOfFiling)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Gstr7Timeline;
