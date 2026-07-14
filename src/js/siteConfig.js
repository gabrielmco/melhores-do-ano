export const OFFICIAL_CITY = Object.freeze({
  name: 'Bom Jardim',
  state: 'MG',
  displayName: 'Bom Jardim - MG'
});

export function normalizeCityName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function isOfficialCity(city) {
  const normalized = normalizeCityName(city?.name);
  return normalized === 'bom jardim' ||
    normalized === 'bom jardim - mg' ||
    normalized === 'bom jardim/mg';
}

export function findOfficialCity(cities) {
  return Array.isArray(cities) ? cities.find(isOfficialCity) || null : null;
}
