import axios from "axios";

export async function getLocationData(location) {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      location
    )}&key=${process.env.GOOGLE_API_KEY}`;
    const res = await axios.get(url);

    if (!res.data.results.length) {
      throw new Error("Location not found");
    }

    const result = res.data.results[0];
    const { lat, lng } = result.geometry.location;
    const addressComponents = result.address_components;

    // Extract country, city, region info
    const country =
      addressComponents.find((c) => c.types.includes("country"))?.long_name ||
      "";
    const city =
      addressComponents.find((c) => c.types.includes("locality"))?.long_name ||
      "";
    const region =
      addressComponents.find((c) =>
        c.types.includes("administrative_area_level_1")
      )?.long_name || "";

    return {
      lat,
      lon: lng,
      country,
      city,
      region,
      formatted_address: result.formatted_address,
      place_id: result.place_id,
    };
  } catch (error) {
    console.error("Location data error:", error.message);
    throw new Error(`Failed to get location data: ${error.message}`);
  }
}

export function validateCoordinates(lat, lon) {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  if (isNaN(latitude) || isNaN(longitude)) {
    throw new Error("Invalid coordinates: must be numbers");
  }

  if (latitude < -90 || latitude > 90) {
    throw new Error("Invalid latitude: must be between -90 and 90");
  }

  if (longitude < -180 || longitude > 180) {
    throw new Error("Invalid longitude: must be between -180 and 180");
  }

  return { latitude, longitude };
}

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers
  return distance;
}
