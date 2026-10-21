// Raster tiles for Leaflet. Default: OpenStreetMap. Set NEXT_PUBLIC_TILE_URL (e.g. a Neshan or
// self-hosted tile endpoint) if OSM is slow from inside Iran.
export const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
