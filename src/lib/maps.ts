/** Enlace a Google Maps para una coordenada. */
export function mapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

/** Enlace a Google Maps buscando una dirección escrita (para direcciones por referencias). */
export function mapsSearchUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
