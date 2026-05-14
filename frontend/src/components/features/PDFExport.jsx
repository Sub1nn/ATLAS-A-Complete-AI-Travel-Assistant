import React from "react";
import { Download } from "lucide-react";
import Button from "../ui/Button";

const PDFExport = ({ messages, isLoading = false }) => {
  const exportToPDF = () => {
    // Create a simplified text version of the conversation
    const conversationText = messages
      .filter(
        (msg) =>
          msg.type === "user" || (msg.type === "assistant" && !msg.isError)
      )
      .map((msg) => {
        const timestamp = msg.timestamp.toLocaleString();
        const role = msg.type === "user" ? "You" : "ATLAS";
        const tools =
          msg.tools?.length > 0
            ? `\n[Tools used: ${msg.tools.join(", ")}]`
            : "";
        const location = msg.location ? `\n[Location: ${msg.location}]` : "";

        return `${role} (${timestamp}):${tools}${location}\n${msg.content}\n`;
      })
      .join("\n" + "=".repeat(50) + "\n\n");

    // Create a downloadable text file (since we can't use jsPDF in this environment)
    const blob = new Blob(
      [
        `ATLAS Travel Assistant - Conversation Export\n`,
        `Generated: ${new Date().toLocaleString()}\n`,
        "=".repeat(70) + "\n\n",
        conversationText,
      ],
      { type: "text/plain" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `atlas-travel-plan-${
      new Date().toISOString().split("T")[0]
    }.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      onClick={exportToPDF}
      disabled={isLoading || messages.length <= 1}
      variant="secondary"
      size="sm"
      className="flex items-center space-x-2"
    >
      <Download className="w-4 h-4" />
      <span>Export Chat</span>
    </Button>
  );
};

export default PDFExport;
