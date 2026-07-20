import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const countries = require("i18n-iso-countries");
const englishCountries = require("i18n-iso-countries/langs/en.json");

countries.registerLocale(englishCountries);

function normalize(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const FRIENDLY_NAME_BY_CODE = {
  BO: "Bolivia",
  CD: "Democratic Republic of the Congo",
  CG: "Republic of the Congo",
  CI: "Côte d'Ivoire",
  CZ: "Czechia",
  FM: "Micronesia",
  GB: "United Kingdom",
  IR: "Iran",
  LA: "Laos",
  MD: "Moldova",
  MK: "North Macedonia",
  PS: "Palestinian Territories",
  RU: "Russia",
  SY: "Syria",
  TZ: "Tanzania",
  US: "United States",
  VA: "Vatican City",
  VE: "Venezuela",
};

const ALIAS_TO_CODE = {
  america: "US",
  "bosnia": "BA",
  "bosnia and herzegovina": "BA",
  "britain": "GB",
  "brunei": "BN",
  "burma": "MM",
  "cape verde": "CV",
  "congo brazzaville": "CG",
  "congo kinshasa": "CD",
  "cote d'ivoire": "CI",
  "cote divoire": "CI",
  "czech republic": "CZ",
  "dr congo": "CD",
  "drc": "CD",
  "east timor": "TL",
  "great britain": "GB",
  "ivory coast": "CI",
  "laos": "LA",
  "micronesia": "FM",
  "moldova": "MD",
  "myanmar": "MM",
  "north korea": "KP",
  "palestine": "PS",
  "palestinian territories": "PS",
  "russia": "RU",
  "south korea": "KR",
  "syria": "SY",
  "taiwan": "TW",
  "tanzania": "TZ",
  "the bahamas": "BS",
  "the gambia": "GM",
  "uae": "AE",
  "uk": "GB",
  "united states": "US",
  "united states of america": "US",
  "usa": "US",
  "vatican": "VA",
  "vatican city": "VA",
  "venezuela": "VE",
  "viet nam": "VN",
  "vietnam": "VN",
};

const codeToName = new Map();
const nameToCode = new Map();

for (const [code, rawName] of Object.entries(countries.getNames("en"))) {
  const name = FRIENDLY_NAME_BY_CODE[code] || rawName;
  codeToName.set(code, name);
  nameToCode.set(normalize(rawName), code);
  nameToCode.set(normalize(name), code);
}

for (const [alias, code] of Object.entries(ALIAS_TO_CODE)) {
  if (codeToName.has(code)) nameToCode.set(normalize(alias), code);
}

const countryWords = [...nameToCode.keys()].sort((a, b) => b.length - a.length);

function countryCodeForName(value = "") {
  const key = normalize(value);
  if (!key) return "";
  if (nameToCode.has(key)) return nameToCode.get(key);

  const upper = String(value || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(upper) && codeToName.has(upper)) return upper;
  if (/^[A-Z]{3}$/.test(upper)) return countries.alpha3ToAlpha2(upper) || "";

  return countries.getAlpha2Code(value, "en") || "";
}

function countryAlpha3ForName(value = "") {
  const code = countryCodeForName(value);
  return code ? countries.alpha2ToAlpha3(code) || "" : "";
}

function canonicalCountryName(value = "") {
  const code = countryCodeForName(value);
  return code ? codeToName.get(code) || countries.getName(code, "en") || "" : "";
}

function isCountryName(value = "") {
  return Boolean(countryCodeForName(value));
}

export const countryService = {
  countryAlpha3ForName,
  canonicalCountryName,
  countryCodeForName,
  countryWords,
  isCountryName,
  normalize,
};
