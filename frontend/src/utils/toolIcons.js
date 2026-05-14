import {
  Wind,
  Utensils,
  Hotel,
  Shield,
  Globe,
  Compass,
  Sparkles,
} from "lucide-react";

export const getToolIcon = (tool) => {
  const iconMap = {
    comprehensive_weather_analysis: Wind,
    intelligent_restaurant_discovery: Utensils,
    smart_accommodation_finder: Hotel,
    comprehensive_safety_intelligence: Shield,
    cultural_and_travel_insights: Globe,
    local_experiences_and_attractions: Compass,
  };
  return iconMap[tool] || Sparkles;
};
