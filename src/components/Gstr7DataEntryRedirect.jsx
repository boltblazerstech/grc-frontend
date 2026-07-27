import React, { useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";

// GSTR-7 data entry lives on the PAN-centric /gstr7-master screen, keyed by
// searchQuery. This route gives a specific GSTIN a stable, linkable URL that
// forwards into that screen pre-filtered to the GSTIN.
// ?import=1 additionally asks that screen to open the Gemini filing-import
// modal for this GSTIN directly (used when the GSTIN already has a real
// GSTR7/TDS number, so there's actual filing data to import).
const Gstr7DataEntryRedirect = () => {
  const { gstin } = useParams();
  const [searchParams] = useSearchParams();
  const openImport = searchParams.get("import") === "1";
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/gstr7-master", { state: { searchQuery: gstin || "", openImport }, replace: true });
  }, [gstin, openImport, navigate]);

  return null;
};

export default Gstr7DataEntryRedirect;
