import React from "react";
import {
  Building2,
  CloudSun,
  Landmark,
  Map,
  Navigation,
  Dumbbell,
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
    description: "I am thinking to travel to Tehran this weekend as a tourist",
    icon: Map,
  },
  {
    title: "Sports nearby",
    description: "Where can I play badminton near Helsinki city centre?",
    icon: Dumbbell,
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
    title: "Route planning",
    description: "Route from Helsinki railway station to Helsinki airport by train",
    icon: Navigation,
  },
];

const TripSuggestions = ({ setInputMessage }) => {
  return (
    <section className="mx-auto w-full max-w-4xl px-5 pb-10 pt-6 sm:px-8">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-medium text-[#7f817c]">
          Try a starting point
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-x-4">
        {suggestions.map(({ title, description, icon: Icon }) => (
          <button
            key={description}
            type="button"
            onClick={() => setInputMessage(description)}
            className="group rounded-lg px-2 py-3 text-left transition hover:bg-[#222422] focus:outline-none"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[#242624] text-[#91938d] transition group-hover:text-[#b9ddc8]">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div>
                <div className="text-sm font-medium text-[#d6d7d2]">{title}</div>
                <p className="mt-1 line-clamp-1 text-xs leading-5 text-[#777a75]">
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
