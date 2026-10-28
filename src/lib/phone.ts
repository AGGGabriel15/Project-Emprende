import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

export type { CountryCode };

/** Los teléfonos se guardan en E.164 (+50588881234); sin prefijo se asume Nicaragua. */
export const DEFAULT_COUNTRY: CountryCode = "NI";

// Países de la región primero en el selector.
const PRIORITY: CountryCode[] = ["NI", "CR", "HN", "SV", "GT", "PA", "MX", "US", "ES", "CO", "VE"];

// Centroamérica usa 8 dígitos; el resto se limita al máximo de E.164.
const MAX_DIGITS: Partial<Record<CountryCode, number>> = { NI: 8, CR: 8, HN: 8, SV: 8, GT: 8, PA: 8 };

export function maxNationalDigits(country: CountryCode) {
  return MAX_DIGITS[country] ?? 15 - getCountryCallingCode(country).length;
}

export function callingCode(country: CountryCode) {
  return `+${getCountryCallingCode(country)}`;
}

let cachedOptions: { code: CountryCode; name: string; dial: string; priority: boolean }[] | null = null;

/** Lista de países con nombre en español, la región primero. */
export function countryOptions() {
  if (cachedOptions) return cachedOptions;
  const names = new Intl.DisplayNames(["es"], { type: "region" });
  const all = getCountries().map((code) => ({
    code,
    name: names.of(code) ?? code,
    dial: callingCode(code),
    priority: PRIORITY.includes(code),
  }));
  cachedOptions = [
    ...PRIORITY.map((code) => all.find((c) => c.code === code)!),
    ...all.filter((c) => !c.priority).sort((a, b) => a.name.localeCompare(b.name, "es")),
  ];
  return cachedOptions;
}

function parse(value: string | null | undefined) {
  if (!value?.trim()) return undefined;
  return parsePhoneNumberFromString(value.trim(), DEFAULT_COUNTRY);
}

/** Valida y devuelve E.164, o null si no es un número válido. */
export function normalizePhone(value: string | null | undefined) {
  const phone = parse(value);
  if (!phone?.isValid()) return null;
  // La metadata mínima solo valida longitud: en Nicaragua exigimos fijo (2) o móvil (5, 7, 8).
  if (phone.country === "NI" && !/^[2578]\d{7}$/.test(phone.nationalNumber)) return null;
  return phone.number;
}

/** "+505 7312 3134" (o el formato internacional del país). */
export function formatPhone(value: string | null | undefined) {
  const phone = parse(value);
  return phone ? phone.formatInternational() : (value ?? "");
}

export function phoneHref(value: string) {
  const phone = parse(value);
  return `tel:${phone?.number ?? value}`;
}

export function whatsappHref(value: string, text?: string) {
  const phone = parse(value);
  const digits = (phone?.number ?? value).replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Separa un valor guardado en país + dígitos nacionales para el input. */
export function splitPhone(value: string | null | undefined): { country: CountryCode; digits: string } {
  const phone = parse(value);
  if (phone?.country) return { country: phone.country, digits: phone.nationalNumber };
  return { country: DEFAULT_COUNTRY, digits: (value ?? "").replace(/\D/g, "").slice(0, 8) };
}

/** Dígitos nacionales con el formato del país mientras se escribe ("7312 3134"). */
export function formatNational(country: CountryCode, digits: string) {
  return digits ? new AsYouType(country).input(digits) : "";
}

/** Si el usuario pega un número con "+código", detecta el país. */
export function detectFromInternational(raw: string) {
  const typer = new AsYouType();
  typer.input(raw);
  const country = typer.getCountry();
  const national = typer.getNationalNumber();
  return country ? { country, digits: national } : null;
}

export function joinPhone(country: CountryCode, digits: string) {
  return digits ? `${callingCode(country)}${digits}` : "";
}

/** Cédula nicaragüense mientras se escribe: 001-120307-1017X. */
export function formatCedula(raw: string) {
  let digits = "";
  let letter = "";
  for (const char of raw.toUpperCase()) {
    if (/\d/.test(char) && digits.length < 13) digits += char;
    else if (/[A-Z]/.test(char) && digits.length === 13 && !letter) letter = char;
  }
  return [digits.slice(0, 3), digits.slice(3, 9), digits.slice(9, 13)]
    .filter(Boolean)
    .join("-")
    .concat(letter);
}
