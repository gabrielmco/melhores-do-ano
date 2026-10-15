/* ============================================================================
   PROJETOS MELHORES DO ANO - HELPERS DO PAINEL ADMINISTRATIVO
   Sanitização de texto, máscaras e opções reutilizáveis.
   ============================================================================ */

export function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const CRM_PACKAGES = [
  { value: 'nao_definido', label: 'Pacote a definir' },
  { value: 'selo_digital', label: 'Selo digital' },
  { value: 'placa_classica', label: 'Placa clássica' },
  { value: 'kit_premium', label: 'Kit premium' }
];

export function renderCrmPackageOptions(selectedPackage) {
  const selected = selectedPackage || 'nao_definido';
  return CRM_PACKAGES.map(pkg => (
    `<option value="${pkg.value}" ${selected === pkg.value ? 'selected' : ''}>${pkg.label}</option>`
  )).join('');
}

export function formatDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

export function formatCurrencyInput(value) {
  if (value === null || value === undefined || value === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '';
}
