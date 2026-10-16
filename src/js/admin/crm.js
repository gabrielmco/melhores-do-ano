/* ============================================================================
   PROJETOS MELHORES DO ANO - MÓDULO DE CRM COMERCIAL
   Funil de vendas de placas, selos digitais e acompanhamento de contatos.
   ============================================================================ */

import { supabase } from '../supabaseClient.js';
import { OFFICIAL_CITY, findOfficialCity } from '../siteConfig.js';
import {
  escapeHtml,
  renderCrmPackageOptions,
  formatDateInput,
  formatCurrencyInput
} from './helpers.js';
import { exportCrmLeadsToCsv } from '../modules/csvExporter.js';

let cachedLeads = [];

export async function initCrmTab() {
  const crmSelectCity = document.getElementById('crmSelectCity');
  const crmTableBody = document.getElementById('crmTableBody');

  if (crmSelectCity) {
    crmSelectCity.innerHTML = `<option value="">Carregando ${OFFICIAL_CITY.displayName}...</option>`;
  }
  if (crmTableBody) {
    crmTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: rgba(255,255,255,0.3);">Selecione uma cidade para carregar o CRM comercial.</td></tr>';
  }

  try {
    const { data, error } = await supabase.from('cities').select('*').order('name');
    if (error) throw error;

    const officialCity = findOfficialCity(data);
    if (!officialCity) throw new Error(`${OFFICIAL_CITY.displayName} não está cadastrada.`);

    if (crmSelectCity) {
      crmSelectCity.innerHTML = `<option value="${officialCity.id}">${OFFICIAL_CITY.displayName}</option>`;
      crmSelectCity.value = officialCity.id;
      crmSelectCity.disabled = true;
    }

    await loadCrmData(officialCity.id);
  } catch (err) {
    console.error(err);
  }
}

export async function loadCrmData(cityId) {
  const crmTableBody = document.getElementById('crmTableBody');
  if (!crmTableBody) return;

  try {
    crmTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: rgba(255,255,255,0.4);">Carregando leads comerciais...</td></tr>';

    // 1. Obter a eleição mais recente desta cidade
    const { data: election, error: electErr } = await supabase
      .from('elections')
      .select('id')
      .eq('city_id', cityId)
      .order('year', { ascending: false })
      .limit(1)
      .single();

    if (electErr || !election) {
      crmTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: rgba(255,255,255,0.3);">Nenhuma eleição registrada nesta cidade.</td></tr>';
      return;
    }

    // 2. Chamar a RPC segura de listagem comercial
    const { data, error } = await supabase.rpc('get_crm_candidates_v2', {
      p_election_id: election.id
    });

    if (error) throw error;

    cachedLeads = data || [];
    crmTableBody.innerHTML = '';

    if (!data || data.length === 0) {
      crmTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: rgba(255,255,255,0.3);">Nenhum concorrente cadastrado nesta edição.</td></tr>';
      return;
    }

    data.forEach(lead => {
      const row = document.createElement('tr');
      row.dataset.id = lead.id;

      const cleanWa = String(lead.whatsapp || '').replace(/\D/g, '');
      const waUrl = cleanWa ? `https://wa.me/${cleanWa.startsWith('55') ? cleanWa : '55' + cleanWa}?text=${encodeURIComponent(`Olá, ${lead.name}! Parabéns pela participação no Melhores do Ano. Estamos entrando em contato para apresentar a sua Placa Oficial de Homenagem.`)}` : null;
      
      const waButton = waUrl ? `
        <a href="${waUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 4px; color: #2ecc71; text-decoration: none; font-size: 0.75rem; margin-top: 4px; font-weight: 600;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          Chamar no WhatsApp
        </a>
      ` : '';

      const contactInfo = `WA: ${escapeHtml(lead.whatsapp || 'N/A')}<br/>Email: ${escapeHtml(lead.email || 'N/A')}<br/>${waButton}`;
      const selectedStage = lead.commercial_status || 'não contatado';
      const followUpDate = formatDateInput(lead.commercial_follow_up_date);
      const valueEstimate = formatCurrencyInput(lead.commercial_value_estimate);

      row.innerHTML = `
        <td style="font-weight: 600; color: #ffffff;">${escapeHtml(lead.name)}</td>
        <td><span style="font-size:0.8rem; color: rgba(255,255,255,0.5);">${escapeHtml(lead.category_name)}</span></td>
        <td style="font-size: 0.8rem; color: rgba(255,255,255,0.7);">${contactInfo}</td>
        <td>
          <select class="form-control select-crm-stage" style="padding: 6px; font-size: 0.8rem; width: 160px;">
            <option value="não contatado" ${selectedStage === 'não contatado' ? 'selected' : ''}>Não Contatado</option>
            <option value="chamou no WhatsApp" ${selectedStage === 'chamou no WhatsApp' ? 'selected' : ''}>Chamou no WhatsApp</option>
            <option value="interessado" ${selectedStage === 'interessado' ? 'selected' : ''}>Interessado</option>
            <option value="comprou" ${selectedStage === 'comprou' ? 'selected' : ''}>Comprou (Placa Fechada)</option>
            <option value="recusou" ${selectedStage === 'recusou' ? 'selected' : ''}>Recusou</option>
          </select>
          <select class="form-control select-crm-package" style="padding: 6px; font-size: 0.8rem; width: 160px; margin-top: 6px;">
            ${renderCrmPackageOptions(lead.commercial_package)}
          </select>
          <input type="number" class="form-control input-crm-value" value="${valueEstimate}" placeholder="Valor da Placa (R$)" min="0" step="0.01" style="padding: 6px; font-size: 0.8rem; width: 160px; margin-top: 6px;">
        </td>
        <td>
          <input type="date" class="form-control input-crm-followup" value="${followUpDate}" style="padding: 6px; font-size: 0.8rem; min-width: 150px; margin-bottom: 6px;">
          <input type="text" class="form-control input-crm-next-action" value="${escapeHtml(lead.commercial_next_action || '')}" placeholder="Próxima ação..." style="padding: 6px; font-size: 0.8rem; min-width: 150px; margin-bottom: 6px;">
          <input type="text" class="form-control input-crm-notes" value="${escapeHtml(lead.commercial_notes || '')}" placeholder="Observações do fechamento..." style="padding: 6px; font-size: 0.8rem; min-width: 150px;">
        </td>
        <td>
          <button class="btn btn-save-crm" style="font-size:0.75rem; padding: 6px 12px;">Salvar</button>
        </td>
      `;

      // Evento salvar CRM
      const btnSave = row.querySelector('.btn-save-crm');
      if (btnSave) {
        btnSave.addEventListener('click', async () => {
          const stage = row.querySelector('.select-crm-stage').value;
          const commercialPackage = row.querySelector('.select-crm-package').value;
          const nextAction = row.querySelector('.input-crm-next-action').value.trim();
          const followUpDateVal = row.querySelector('.input-crm-followup').value || null;
          const valueRaw = row.querySelector('.input-crm-value').value.trim();
          const valueEstimateVal = valueRaw ? Number(valueRaw) : null;
          const notes = row.querySelector('.input-crm-notes').value.trim();

          if (valueEstimateVal !== null && (!Number.isFinite(valueEstimateVal) || valueEstimateVal < 0)) {
            if (typeof window.showToast === 'function') {
              window.showToast('Informe um valor estimado válido.', 'error');
            }
            return;
          }

          btnSave.disabled = true;
          btnSave.textContent = 'Salvar...';

          try {
            const { error } = await supabase.rpc('update_candidate_commercial_status_v2', {
              p_candidate_id: lead.id,
              p_commercial_status: stage,
              p_commercial_notes: notes || null,
              p_commercial_package: commercialPackage,
              p_commercial_next_action: nextAction || null,
              p_commercial_follow_up_date: followUpDateVal,
              p_commercial_value_estimate: valueEstimateVal
            });

            if (error) throw error;

            if (typeof window.showToast === 'function') {
              window.showToast('Funil comercial atualizado com sucesso!', 'success');
            }
          } catch (err) {
            console.error(err);
            if (typeof window.showToast === 'function') {
              window.showToast('Erro ao atualizar: ' + err.message, 'error');
            }
          } finally {
            btnSave.disabled = false;
            btnSave.textContent = 'Salvar';
          }
        });
      }

      crmTableBody.appendChild(row);
    });

  } catch (err) {
    console.error(err);
    crmTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #ff5555;">Erro ao obter funil CRM.</td></tr>';
  }
}

export function setupCrmListeners() {
  const crmSelectCity = document.getElementById('crmSelectCity');
  const crmTableBody = document.getElementById('crmTableBody');
  const btnExportCrmCsv = document.getElementById('btnExportCrmCsv');

  if (crmSelectCity) {
    crmSelectCity.addEventListener('change', async () => {
      const cityId = crmSelectCity.value;
      if (crmTableBody) {
        crmTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: rgba(255,255,255,0.3);">Selecione uma cidade.</td></tr>';
      }
      if (cityId) {
        await loadCrmData(cityId);
      }
    });
  }

  if (btnExportCrmCsv) {
    btnExportCrmCsv.addEventListener('click', () => {
      if (!cachedLeads || cachedLeads.length === 0) {
        if (typeof window.showToast === 'function') {
          window.showToast('Nenhum lead comercial disponível para exportação.', 'warning');
        }
        return;
      }

      const rows = cachedLeads.map(l => ({
        name: l.name,
        category_name: l.category_name,
        whatsapp: l.whatsapp || l.phone,
        stage: l.commercial_status || 'não contatado',
        package: l.commercial_package || 'Nenhum',
        contract_value: l.commercial_value_estimate || 0,
        notes: `FollowUp: ${l.commercial_follow_up_date || 'N/A'} | Ação: ${l.commercial_next_action || 'N/A'} | ${l.commercial_notes || ''}`
      }));

      exportCrmLeadsToCsv(rows, `crm_leads_melhores_do_ano_${new Date().toISOString().slice(0, 10)}.csv`);
      if (typeof window.showToast === 'function') {
        window.showToast('Planilha CRM exportada com sucesso!', 'success');
      }
    });
  }
}
