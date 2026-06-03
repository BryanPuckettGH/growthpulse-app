// Turn "Miami" or a ZIP code into coordinates + a pretty label using
// Open-Meteo's free geocoder (no API key). Returns null when not found.
export async function geocodePlace(query) {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`
    );
    const d = await res.json();
    const g = d && d.results && d.results[0];
    if (!g) return null;
    return {
      lat: g.latitude,
      lon: g.longitude,
      label: `${g.name}${g.admin1 ? ', ' + g.admin1 : ''}`,
    };
  } catch {
    return null;
  }
}
