const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const token = new URLSearchParams(window.location.hash.slice(1)).get("token") || sessionStorage.getItem("atlas_deletion_token") || "";
const statusElement = document.getElementById("status");

if (!token) {
  statusElement.textContent = "No deletion tracking token was provided.";
} else {
  sessionStorage.setItem("atlas_deletion_token", token);
  if (window.location.hash) history.replaceState(null, "", window.location.pathname);
  const checkStatus = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/auth/account-deletion-status`, { credentials: "include", headers: { "X-Deletion-Token": token }, cache: "no-store" });
      const data = await response.json();
      statusElement.textContent = response.ok ? data.message : data.message || "Deletion status is unavailable.";
      if (!response.ok) return;
      if (data.status === "completed") sessionStorage.removeItem("atlas_deletion_token");
      if (!["completed", "dead_letter"].includes(data.status)) window.setTimeout(checkStatus, 5000);
    } catch {
      statusElement.textContent = "Deletion status is temporarily unavailable. Retrying…";
      window.setTimeout(checkStatus, 10000);
    }
  };
  checkStatus();
}
