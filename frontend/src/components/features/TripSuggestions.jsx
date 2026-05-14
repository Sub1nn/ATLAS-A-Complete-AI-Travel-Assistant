import React from "react";
import {
  Building2,
  CloudSun,
  Landmark,
  Map,
  Shield,
  Utensils,
} from "lucide-react";

const suggestions = [
  {
    title: "Safety brief",
    description: "Security assessment for travel to Palestine",
    icon: Shield,
  },
  {
    title: "Destination analysis",
    description: "Comprehensive destination analysis for Tokyo",
    icon: Map,
  },
  {
    title: "Business culture",
    description: "Cultural briefing for business travel to Dubai",
    icon: Landmark,
  },
  {
    title: "Accommodation",
    description: "Luxury accommodation strategy for Paris",
    icon: Building2,
  },
  {
    title: "Local dining",
    description: "Traditional dining experiences in Istanbul",
    icon: Utensils,
  },
  {
    title: "Weather planning",
    description: "Weather intelligence for Southeast Asia travel",
    icon: CloudSun,
  },
];

const TripSuggestions = ({ setInputMessage }) => {
  return (
    <section className="mx-auto w-full max-w-7xl px-5 pb-6 sm:px-6 lg:px-8">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          Suggested starting points
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {suggestions.map(({ title, description, icon: Icon }) => (
          <button
            key={description}
            type="button"
            onClick={() => setInputMessage(description)}
            className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-sky-400/40 hover:bg-slate-900 hover:shadow-xl hover:shadow-black/20 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-sky-300 transition group-hover:border-sky-400/40">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-medium text-slate-100">{title}</div>
                <p className="mt-1 text-sm leading-5 text-slate-400">
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
