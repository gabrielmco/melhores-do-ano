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

// O único produto oficial comercializado é a Placa Oficial com Certificado
export const CRM_PACKAGES = [
  { value: 'placa_oficial', label: 'Placa Oficial com Certificado' }
];

export function renderCrmPackageOptions(selectedPackage) {
  // Sempre renderiza exclusivamente a Placa Oficial com Certificado
  return `<option value="placa_oficial" selected>Placa Oficial com Certificado</option>`;
}

export function formatDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

export function formatCurrencyInput(value) {
  if (value === null || value === undefined || value === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '';
}
