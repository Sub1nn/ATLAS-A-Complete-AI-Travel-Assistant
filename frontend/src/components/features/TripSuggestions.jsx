import React from "react";
import {
  Building2,
  CalendarDays,
  Globe2,
  Navigation,
  Dumbbell,
  Shield,
  Utensils,
} from "lucide-react";

const suggestions = [
  {
    title: "Plan a weekend",
    description: "Plan a relaxed weekend in Tallinn from Helsinki",
    icon: CalendarDays,
  },
  {
    title: "Understand a destination",
    description: "What should I know before visiting Japan for the first time?",
    icon: Globe2,
  },
  {
    title: "Find an activity",
    description: "Where can I play indoor tennis near Riihimäki tomorrow?",
    icon: Dumbbell,
  },
  {
    title: "Compare places to stay",
    description: "Compare central Paris areas for two adults on a mid-range budget",
    icon: Building2,
  },
  {
    title: "Explore local food",
    description: "Help me find a traditional dinner experience in Istanbul",
    icon: Utensils,
  },
  {
    title: "Check a route",
    description: "How do I get from Helsinki railway station to the airport by train?",
    icon: Navigation,
  },
];

const TripSuggestions = ({ setInputMessage }) => {
  return (
    <section className="mx-auto w-full max-w-4xl px-5 pb-8 pt-5 sm:px-8 sm:pt-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#91938d]">
          Start with an idea
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {suggestions.map(({ title, description, icon: Icon }) => (
          <button
            key={description}
            type="button"
            onClick={() => {
              setInputMessage(description);
              window.requestAnimationFrame(() => document.getElementById("atlas-chat-input")?.focus());
            }}
            className="group min-h-[82px] rounded-xl border border-[#303230] bg-[#1a1b1a] px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-[#454945] hover:bg-[#202220] hover:shadow-[0_10px_28px_rgba(0,0,0,0.14)]"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-[#343734] bg-[#242624] text-[#a4a7a1] transition group-hover:border-[#465049] group-hover:bg-[#29302c] group-hover:text-[#b9ddc8]">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-[#e1e2dd] transition group-hover:text-[#f5f5f1]">{title}</div>
                <p className="mt-1 line-clamp-2 text-xs leading-[1.45] text-[#8f918b]">
                  {description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

export default TripSuggestions;
