const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const fields = {
  "privacy-version": "privacyVersion",
  "terms-version": "termsVersion",
  operator: "operatorName",
  jurisdiction: "jurisdiction",
  "lawful-basis": "lawfulBasis",
  "transfer-safeguards": "transferSafeguards",
  "supervisory-authority": "supervisoryAuthority",
};

fetch(`${apiBaseUrl}/legal`, { credentials: "include" })
  .then((response) => {
    if (!response.ok) throw new Error("Legal configuration is unavailable");
    return response.json();
  })
  .then((data) => {
    Object.entries(fields).forEach(([id, key]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = data[key] || "not configured";
    });
    const contact = document.getElementById("privacy-contact");
    if (contact && data.privacyContact) {
      contact.textContent = data.privacyContact;
      contact.href = `mailto:${data.privacyContact}`;
    }
  })
  .catch(() => {
    document.querySelectorAll("[data-legal-field]").forEach((element) => {
      element.textContent = "temporarily unavailable";
    });
  });
