import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

// GSTR-7 data entry lives on the PAN-centric /gstr7-master screen, keyed by
// searchQuery. This route gives a specific GSTIN a stable, linkable URL that
// forwards into that screen pre-filtered to the GSTIN.
const Gstr7DataEntryRedirect = () => {
  const { gstin } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/gstr7-master", { state: { searchQuery: gstin || "" }, replace: true });
  }, [gstin, navigate]);

  return null;
};

export default Gstr7DataEntryRedirect;
