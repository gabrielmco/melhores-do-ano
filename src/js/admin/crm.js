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

    crmTableBody.innerHTML = '';

    if (!data || data.length === 0) {
      crmTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: rgba(255,255,255,0.3);">Nenhum concorrente cadastrado nesta edição.</td></tr>';
      return;
    }

    data.forEach(lead => {
      const row = document.createElement('tr');
      row.dataset.id = lead.id;

      const contactInfo = `WA: ${escapeHtml(lead.whatsapp || 'N/A')}<br/>Email: ${escapeHtml(lead.email || 'N/A')}<br/>Resp.: ${escapeHtml(lead.commercial_owner_name || 'Sem responsável')}`;
      const selectedStage = lead.commercial_status || 'não contatado';
      const followUpDate = formatDateInput(lead.commercial_follow_up_date);
      const valueEstimate = formatCurrencyInput(lead.commercial_value_estimate);

      row.innerHTML = `
        <td style="font-weight: 600; color: #ffffff;">${escapeHtml(lead.name)}</td>
        <td><span style="font-size:0.8rem; color: rgba(255,255,255,0.5);">${escapeHtml(lead.category_name)}</span></td>
        <td style="font-size: 0.8rem; color: rgba(255,255,255,0.7);">${contactInfo}</td>
        <td>
          <select class="form-control select-crm-stage" style="padding: 6px; font-size: 0.8rem; width: 150px;">
            <option value="não contatado" ${selectedStage === 'não contatado' ? 'selected' : ''}>Não Contatado</option>
            <option value="chamou no WhatsApp" ${selectedStage === 'chamou no WhatsApp' ? 'selected' : ''}>Chamou no WhatsApp</option>
            <option value="interessado" ${selectedStage === 'interessado' ? 'selected' : ''}>Interessado</option>
            <option value="comprou" ${selectedStage === 'comprou' ? 'selected' : ''}>Comprou</option>
            <option value="recusou" ${selectedStage === 'recusou' ? 'selected' : ''}>Recusou</option>
          </select>
          <select class="form-control select-crm-package" style="padding: 6px; font-size: 0.8rem; width: 150px; margin-top: 6px;">
            ${renderCrmPackageOptions(lead.commercial_package)}
          </select>
          <input type="number" class="form-control input-crm-value" value="${valueEstimate}" placeholder="Valor estimado" min="0" step="0.01" style="padding: 6px; font-size: 0.8rem; width: 150px; margin-top: 6px;">
        </td>
        <td>
          <input type="date" class="form-control input-crm-followup" value="${followUpDate}" style="padding: 6px; font-size: 0.8rem; min-width: 150px; margin-bottom: 6px;">
          <input type="text" class="form-control input-crm-next-action" value="${escapeHtml(lead.commercial_next_action || '')}" placeholder="Próxima ação..." style="padding: 6px; font-size: 0.8rem; min-width: 150px; margin-bottom: 6px;">
          <input type="text" class="form-control input-crm-notes" value="${escapeHtml(lead.commercial_notes || '')}" placeholder="Observações..." style="padding: 6px; font-size: 0.8rem; min-width: 150px;">
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
}
