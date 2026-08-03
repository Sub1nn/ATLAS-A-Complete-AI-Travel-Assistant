import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const apiSource = fs.readFileSync(new URL("../src/services/api.js", import.meta.url), "utf8");
const hookSource = fs.readFileSync(new URL("../src/hooks/useChat.js", import.meta.url), "utf8");
const legalSource = fs.readFileSync(new URL("../src/legal-page.js", import.meta.url), "utf8");
const viteSource = fs.readFileSync(new URL("../vite.config.js", import.meta.url), "utf8");
const deletionStatusSource = fs.readFileSync(new URL("../src/deletion-status.js", import.meta.url), "utf8");
const sidebarSource = fs.readFileSync(new URL("../src/components/sidebar/HistorySidebar.jsx", import.meta.url), "utf8");
const deleteAccountDialogSource = fs.readFileSync(new URL("../src/components/sidebar/DeleteAccountDialog.jsx", import.meta.url), "utf8");
const indexHtmlSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const authPageSource = fs.readFileSync(new URL("../src/components/auth/AuthPage.jsx", import.meta.url), "utf8");
const travelAssistantSource = fs.readFileSync(new URL("../src/components/TravelAssistant.jsx", import.meta.url), "utf8");
const inputAreaSource = fs.readFileSync(new URL("../src/components/chat/InputArea.jsx", import.meta.url), "utf8");
const suggestionsSource = fs.readFileSync(new URL("../src/components/features/TripSuggestions.jsx", import.meta.url), "utf8");
const indexCssSource = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const authHookSource = fs.readFileSync(new URL("../src/hooks/useAuth.js", import.meta.url), "utf8");
const pdfExportSource = fs.readFileSync(new URL("../src/utils/exportConversationPdf.js", import.meta.url), "utf8");

test("document retry is exposed by documentAPI and consumed by useChat", () => {
  const conversationBlock = apiSource.slice(apiSource.indexOf("export const conversationAPI"), apiSource.indexOf("export const documentAPI"));
  const documentBlock = apiSource.slice(apiSource.indexOf("export const documentAPI"), apiSource.indexOf("export const chatAPI"));
  assert.doesNotMatch(conversationBlock, /async retry\(/);
  assert.match(documentBlock, /async retry\(id\)/);
  assert.match(hookSource, /documentAPI\.retry\(id\)/);
});

test("account deletion is visible, deliberate and reports its destructive scope", () => {
  assert.match(sidebarSource, />\s*Delete account\s*</);
  assert.match(sidebarSource, /DeleteAccountDialog/);
  assert.match(deleteAccountDialogSource, /role="dialog"/);
  assert.match(deleteAccountDialogSource, /confirmation === CONFIRMATION_PHRASE/);
  assert.match(deleteAccountDialogSource, /authAPI\.deleteAccount\(password\)/);
  assert.match(deleteAccountDialogSource, /Pinecone namespace/);
  assert.match(deleteAccountDialogSource, /deletion-status receipt for up to 30 days/);
});

test("authentication hero explains ATLAS benefits with distinct responsive cards", () => {
  assert.match(authPageSource, /Plan better trips with an assistant that remembers\./);
  assert.match(authPageSource, /Sign in to continue without starting/);
  assert.match(authPageSource, /Continue where you left off/);
  assert.match(authPageSource, /Plan with your documents/);
  assert.match(authPageSource, /Use current travel context/);
  assert.match(authPageSource, /grid gap-3 sm:grid-cols-3 lg:col-start-1 lg:row-start-2 lg:grid-cols-1 xl:grid-cols-3/);
  assert.match(authPageSource, /lg:col-start-2 lg:row-span-2 lg:row-start-1/);
  assert.match(authPageSource, /rounded-xl border border-\[#343734\]/);
});

test("public preview is clearly labelled without offering sandbox verification", () => {
  assert.match(travelAssistantSource, /user\?\.publicPreview && !user\?\.emailVerified/);
  assert.match(travelAssistantSource, />Public preview</);
  assert.match(travelAssistantSource, /Full access is enabled while email verification is optional/);
  assert.match(travelAssistantSource, /!user\?\.publicPreview && !user\?\.emailVerified/);
  assert.match(sidebarSource, /Public preview account/);
  assert.match(authPageSource, /Use an address from a domain that can receive email/);
  assert.match(authPageSource, /Public preview\./);
  assert.match(authPageSource, /password recovery is temporarily unavailable/);
  assert.match(authPageSource, /mode === "login" && passwordRecoveryEnabled/);
  assert.match(apiSource, /async config\(\)/);
  assert.match(authHookSource, /Promise\.allSettled\(\[authAPI\.config\(\), authAPI\.restoreSession\(\)\]\)/);
});

test("travel workspace keeps prompts actionable and the composer focus treatment responsive", () => {
  assert.match(suggestionsSource, /Start with an idea/);
  assert.match(suggestionsSource, /atlas-chat-input/);
  assert.match(suggestionsSource, /requestAnimationFrame/);
  assert.match(inputAreaSource, /className="atlas-composer/);
  assert.match(inputAreaSource, /id="atlas-chat-input"/);
  assert.match(inputAreaSource, /textarea\.style\.height/);
  assert.match(indexCssSource, /\.atlas-composer textarea:focus-visible/);
  assert.match(indexCssSource, /max-height: 820px/);
  assert.match(indexCssSource, /max-width: 639px/);
});

test("conversation export produces a styled PDF instead of a text download", () => {
  assert.match(travelAssistantSource, /downloadConversationPdf\(visibleMessages\)/);
  assert.match(travelAssistantSource, /\{isExporting \? "Exporting…" : "Export PDF"\}/);
  assert.doesNotMatch(travelAssistantSource, /atlas-chat-.*\.txt/);
  assert.match(pdfExportSource, /type: "application\/pdf"/);
  assert.match(pdfExportSource, /atlas-conversation-\$\{date\}\.pdf/);
  assert.match(pdfExportSource, /parseBlocks\(message\.content\)/);
  assert.match(pdfExportSource, /Page \$\{pages\.length \+ 1\}/);
});

test("social sharing metadata uses deploy-time absolute URLs and a LinkedIn-sized PNG", () => {
  assert.match(indexHtmlSource, /property="og:url" content="%VITE_PUBLIC_URL%"/);
  assert.match(indexHtmlSource, /property="og:image" content="%VITE_PUBLIC_URL%atlas-og-image\.png"/);
  assert.match(indexHtmlSource, /property="og:image:width" content="1200"/);
  assert.match(indexHtmlSource, /property="og:image:height" content="630"/);
  assert.match(indexHtmlSource, /name="twitter:card" content="summary_large_image"/);
});

test("session restoration uses one shared refresh promise", () => {
  assert.match(apiSource, /let refreshPromise = null/);
  assert.match(apiSource, /if \(!refreshPromise\) refreshPromise = performRefresh\(\)/);
});

test("legal pages use the configured API base and are Vite build entries", () => {
  assert.match(legalSource, /import\.meta\.env\.VITE_API_BASE_URL/);
  assert.match(legalSource, /`\$\{apiBaseUrl\}\/legal`/);
  assert.match(viteSource, /privacy: resolve/);
  assert.match(viteSource, /terms: resolve/);
  assert.match(viteSource, /accountDeletionStatus: resolve/);
  assert.match(deletionStatusSource, /account-deletion-status/);
});
