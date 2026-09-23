// ==========================================
// CIIA/DF DASHBOARD INTERACTIVE JAVASCRIPT
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  // Estado Global do App
  let dailyTrendsChart = null;
  let projectDistChart = null;

  let allStudents = [];
  let allDailies = [];
  let allProjects = [];
  let allContents = [];
  let rankingsData = null;

  let currentCategoryFilter = '';
  let currentRankingSubtab = 'xp';

  // Inicialização
  initTabs();
  initModal();
  initRefresh();
  initFilters();

  // Primeira carga de dados
  fetchAllData();

  // Auto Refresh a cada 30 segundos
  setInterval(fetchAllData, 30000);

  // ------------------------------------------
  // INICIALIZADORES E NAVEGAÇÃO
  // ------------------------------------------
  function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');

        tabBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

        btn.classList.add('active');
        const contentEl = document.getElementById(targetTab);
        if (contentEl) contentEl.classList.add('active');

        // Re-renderizar gráficos ao mudar para a visão geral para ajustar o tamanho
        if (targetTab === 'tab-overview') {
          if (dailyTrendsChart) dailyTrendsChart.resize();
          if (projectDistChart) projectDistChart.resize();
        }
      });
    });

    // Sub-navegação do Ranking
    const subtabBtns = document.querySelectorAll('.subtab-btn');
    subtabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        subtabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentRankingSubtab = btn.getAttribute('data-ranking');
        renderRankingTable();
      });
    });
  }

  function initRefresh() {
    const btn = document.getElementById('btn-refresh');
    if (btn) {
      btn.addEventListener('click', () => {
        btn.classList.add('fa-spin');
        fetchAllData().finally(() => {
          setTimeout(() => btn.classList.remove('fa-spin'), 500);
        });
      });
    }
  }

  function initModal() {
    const modal = document.getElementById('student-modal');
    const closeBtn = document.getElementById('modal-close');

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.remove('active'));
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    }
  }

  function initFilters() {
    // Busca de Bolsistas
    const studentSearch = document.getElementById('student-search');
    const studentFilterGoal = document.getElementById('student-filter-goal');
    if (studentSearch) studentSearch.addEventListener('input', renderStudentsGrid);
    if (studentFilterGoal) studentFilterGoal.addEventListener('change', renderStudentsGrid);

    // Busca de Dailies e Projeto
    const dailySearch = document.getElementById('daily-search');
    const dailyFilterProject = document.getElementById('daily-filter-project');
    if (dailySearch) dailySearch.addEventListener('input', renderDailiesTable);
    if (dailyFilterProject) dailyFilterProject.addEventListener('change', renderDailiesTable);

    // Filtro por Categoria de Conteúdo
    const categoryPills = document.querySelectorAll('#category-pills .pill-btn');
    categoryPills.forEach(pill => {
      pill.addEventListener('click', () => {
        categoryPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentCategoryFilter = pill.getAttribute('data-category');
        renderContentsTable();
      });
    });
  }

  // ------------------------------------------
  // REQUISIÇÕES DE DADOS (API REST)
  // ------------------------------------------
  async function fetchAllData() {
    try {
      updateStatus('Carregando dados...');
      
      const [summaryRes, trendsRes, projectsDistRes, studentsRes, dailiesRes, projectsRes, contentsRes, rankingsRes] = await Promise.all([
        fetch('/api/metrics/summary').then(r => r.json()),
        fetch('/api/metrics/trends').then(r => r.json()),
        fetch('/api/metrics/projects').then(r => r.json()),
        fetch('/api/students').then(r => r.json()),
        fetch('/api/dailies').then(r => r.json()),
        fetch('/api/projects').then(r => r.json()),
        fetch('/api/contents').then(r => r.json()),
        fetch('/api/rankings').then(r => r.json())
      ]);

      if (summaryRes.success) renderKPIs(summaryRes.data);
      if (trendsRes.success) renderTrendsChart(trendsRes.data);
      if (projectsDistRes.success) renderProjectsChart(projectsDistRes.data);
      
      if (studentsRes.success) {
        allStudents = studentsRes.data;
        renderStudentsGrid();
      }

      if (dailiesRes.success) {
        allDailies = dailiesRes.data;
        renderDailiesTable();
        renderRecentFeed(allDailies.slice(0, 5));
      }

      if (projectsRes.success) {
        allProjects = projectsRes.data;
        renderProjectsGrid();
        populateProjectDropdowns();
      }

      if (contentsRes.success) {
        allContents = contentsRes.data;
        renderContentsTable();
      }

      if (rankingsRes.success) {
        rankingsData = rankingsRes.data;
        renderPodium();
        renderRankingTable();
      }

      updateStatus('Sistema Operacional');
    } catch (err) {
      console.error('Erro ao buscar métricas:', err);
      updateStatus('Erro na Conexão', true);
    }
  }

  function updateStatus(text, isError = false) {
    const statusText = document.getElementById('status-text');
    const dot = document.querySelector('.pulse-dot');
    if (statusText) statusText.textContent = text;
    if (dot) {
      dot.style.backgroundColor = isError ? 'var(--rose)' : 'var(--emerald)';
      dot.style.boxShadow = isError ? '0 0 10px var(--rose)' : '0 0 10px var(--emerald)';
    }
  }

  // ------------------------------------------
  // RENDERIZAÇÃO ABA 1: VISÃO GERAL
  // ------------------------------------------
  function renderKPIs(summary) {
    document.getElementById('kpi-total-hours').textContent = `${summary.totalHours.toFixed(1)} h`;
    document.getElementById('kpi-avg-weekly').textContent = `Média: ${summary.avgWeeklyHours.toFixed(1)}h / semana`;

    document.getElementById('kpi-total-dailies').textContent = summary.totalDailies;

    document.getElementById('kpi-total-users').textContent = summary.totalUsers;
    document.getElementById('kpi-active-week').textContent = `${summary.activeThisWeek} ativos nesta semana`;

    document.getElementById('kpi-goal-rate').textContent = `${summary.goalCompletionRate}%`;
    document.getElementById('kpi-met-goal-count').textContent = `${summary.usersMetGoal} de ${summary.activeThisWeek} atingiram a meta`;

    document.getElementById('kpi-total-contents').textContent = summary.totalContents;
  }

  function renderTrendsChart(data) {
    const ctx = document.getElementById('chart-daily-trends')?.getContext('2d');
    if (!ctx) return;

    if (dailyTrendsChart) dailyTrendsChart.destroy();

    const labels = data.map(d => d.date);
    const hours = data.map(d => d.total_hours);
    const counts = data.map(d => d.total_dailies);

    dailyTrendsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Horas Registradas',
            data: hours,
            borderColor: '#00D2FF',
            backgroundColor: 'rgba(0, 210, 255, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Dailies Enviadas',
            data: counts,
            borderColor: '#A855F7',
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9CA3AF', font: { family: 'Inter' } } }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9CA3AF', font: { family: 'Inter' } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9CA3AF', font: { family: 'Inter' } }
          }
        }
      }
    });
  }

  function renderProjectsChart(data) {
    const ctx = document.getElementById('chart-project-dist')?.getContext('2d');
    if (!ctx) return;

    if (projectDistChart) projectDistChart.destroy();

    const labels = data.map(d => d.name);
    const hours = data.map(d => d.total_hours);
    const colors = ['#00D2FF', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899'];

    projectDistChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: hours,
          backgroundColor: colors.slice(0, data.length),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#9CA3AF', font: { family: 'Inter', size: 11 } }
          }
        }
      }
    });
  }

  function renderRecentFeed(recentDailies) {
    const feedEl = document.getElementById('recent-dailies-list');
    if (!feedEl) return;

    if (recentDailies.length === 0) {
      feedEl.innerHTML = '<p class="empty-state">Nenhuma daily registrada recentemente.</p>';
      return;
    }

    feedEl.innerHTML = recentDailies.map(d => `
      <div class="activity-item">
        <div class="activity-info">
          <h4>${escapeHTML(d.username)} — <span style="color: var(--cyan);">${d.hours_today}h</span></h4>
          <p><strong>Projeto:</strong> ${escapeHTML(d.project_name || 'Geral')} | <strong>Entregas:</strong> ${escapeHTML(d.tasks_done.substring(0, 80))}${d.tasks_done.length > 80 ? '...' : ''}</p>
        </div>
        <span class="activity-badge tag-cyan">${d.date}</span>
      </div>
    `).join('');
  }

  // ------------------------------------------
  // RENDERIZAÇÃO ABA 2: BOLSISTAS & ALUNOS
  // ------------------------------------------
  function renderStudentsGrid() {
    const gridEl = document.getElementById('students-grid');
    if (!gridEl) return;

    const searchTerm = (document.getElementById('student-search')?.value || '').toLowerCase();
    const goalFilter = document.getElementById('student-filter-goal')?.value || 'all';

    let filtered = allStudents.filter(s => {
      const matchName = s.username.toLowerCase().includes(searchTerm);
      if (goalFilter === 'completed') return matchName && s.weeklyHours >= 20;
      if (goalFilter === 'in_progress') return matchName && s.weeklyHours < 20;
      return matchName;
    });

    if (filtered.length === 0) {
      gridEl.innerHTML = '<p class="empty-state" style="grid-column: 1/-1;">Nenhum bolsista encontrado com os filtros aplicados.</p>';
      return;
    }

    gridEl.innerHTML = filtered.map(s => {
      const initials = s.username.substring(0, 2).toUpperCase();
      const progressClass = s.weeklyHours >= 20 ? 'completed' : '';

      return `
        <div class="student-card">
          <div class="student-card-header">
            <div class="student-avatar">${initials}</div>
            <div class="student-name-container">
              <h3>${escapeHTML(s.username)}</h3>
              <span class="student-role">${escapeHTML(s.role || 'Bolsista')} • Nível ${s.level}</span>
            </div>
          </div>

          <div class="student-stats-row">
            <div class="stat-item">
              <div class="stat-val" style="color: var(--amber);"><i class="fa-solid fa-fire"></i> ${s.daily_streak}d</div>
              <div class="stat-lbl">Streak</div>
            </div>
            <div class="stat-item">
              <div class="stat-val" style="color: var(--purple);">${s.xp}</div>
              <div class="stat-lbl">XP Total</div>
            </div>
            <div class="stat-item">
              <div class="stat-val" style="color: var(--cyan);">${s.totalHours}h</div>
              <div class="stat-lbl">Total Horas</div>
            </div>
          </div>

          <div class="progress-container">
            <div class="progress-header">
              <span>Meta Semanal (20h)</span>
              <strong>${s.weeklyHours}h / 20.0h</strong>
            </div>
            <div class="progress-track">
              <div class="progress-fill ${progressClass}" style="width: ${s.weeklyProgressPct}%;"></div>
            </div>
          </div>

          <button class="btn btn-secondary btn-student-details" data-id="${s.id}" style="width: 100%; justify-content: center;">
            <i class="fa-solid fa-eye"></i> Ver Perfil & Detalhes
          </button>
        </div>
      `;
    }).join('');

    // Event listeners dos botões de detalhes
    document.querySelectorAll('.btn-student-details').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentId = btn.getAttribute('data-id');
        openStudentModal(studentId);
      });
    });
  }

  // ------------------------------------------
  // RENDERIZAÇÃO ABA 3: DAILIES & ENTREGAS
  // ------------------------------------------
  function renderDailiesTable() {
    const tbody = document.getElementById('dailies-table-body');
    if (!tbody) return;

    const searchTerm = (document.getElementById('daily-search')?.value || '').toLowerCase();
    const selectedProject = document.getElementById('daily-filter-project')?.value || '';

    let filtered = allDailies.filter(d => {
      const matchProject = !selectedProject || d.project_name === selectedProject;
      const matchSearch = !searchTerm ||
        d.username.toLowerCase().includes(searchTerm) ||
        d.tasks_done.toLowerCase().includes(searchTerm) ||
        d.tasks_next.toLowerCase().includes(searchTerm) ||
        (d.blockers && d.blockers.toLowerCase().includes(searchTerm));
      return matchProject && matchSearch;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhuma daily encontrada.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(d => `
      <tr>
        <td><strong>${d.date}</strong></td>
        <td><span class="tag tag-cyan"><i class="fa-solid fa-user"></i> ${escapeHTML(d.username)}</span></td>
        <td>${escapeHTML(d.project_name || 'Outros / Geral')}</td>
        <td><strong style="color: var(--emerald);">${d.hours_today}h</strong> ${d.time_range ? `<br><small style="color:var(--text-muted);">${escapeHTML(d.time_range)}</small>` : ''}</td>
        <td style="max-width: 250px;">${escapeHTML(d.tasks_done)}</td>
        <td style="max-width: 250px; color: var(--text-muted);">${escapeHTML(d.tasks_next)}</td>
        <td>${d.blockers ? `<span class="tag tag-amber"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHTML(d.blockers)}</span>` : '<span style="color: var(--text-sub);">Nenhum</span>'}</td>
      </tr>
    `).join('');
  }

  function populateProjectDropdowns() {
    const select = document.getElementById('daily-filter-project');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = '<option value="">Todos os Projetos</option>' +
      allProjects.map(p => `<option value="${escapeHTML(p.name)}">${escapeHTML(p.name)}</option>`).join('');
    select.value = currentVal;
  }

  // ------------------------------------------
  // RENDERIZAÇÃO ABA 4: PROJETOS
  // ------------------------------------------
  function renderProjectsGrid() {
    const gridEl = document.getElementById('projects-grid');
    if (!gridEl) return;

    if (allProjects.length === 0) {
      gridEl.innerHTML = '<p class="empty-state">Nenhum projeto cadastrado.</p>';
      return;
    }

    gridEl.innerHTML = allProjects.map(p => `
      <div class="project-card">
        <div>
          <h3><i class="fa-solid fa-diagram-project" style="color: var(--cyan);"></i> ${escapeHTML(p.name)}</h3>
          <p>${escapeHTML(p.description)}</p>
        </div>

        <div class="student-stats-row" style="margin-top: 1rem;">
          <div class="stat-item">
            <div class="stat-val" style="color: var(--cyan);">${p.totalHours}h</div>
            <div class="stat-lbl">Horas Totais</div>
          </div>
          <div class="stat-item">
            <div class="stat-val" style="color: var(--purple);">${p.totalDailies}</div>
            <div class="stat-lbl">Dailies</div>
          </div>
          <div class="stat-item">
            <div class="stat-val" style="color: var(--emerald);">${p.totalContributors}</div>
            <div class="stat-lbl">Membros</div>
          </div>
        </div>

        <div style="font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid var(--border-glass); padding-top: 0.75rem;">
          <strong>Maior Contribuidor:</strong> <span style="color: var(--amber);">${escapeHTML(p.topContributor)}</span>
        </div>
      </div>
    `).join('');
  }

  // ------------------------------------------
  // RENDERIZAÇÃO ABA 5: ACERVO DE CONTEÚDOS
  // ------------------------------------------
  function renderContentsTable() {
    const tbody = document.getElementById('contents-table-body');
    if (!tbody) return;

    let filtered = allContents;
    if (currentCategoryFilter) {
      filtered = allContents.filter(c => c.category === currentCategoryFilter);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum conteúdo registrado nesta categoria.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(c => `
      <tr>
        <td><strong>${escapeHTML(c.title)}</strong></td>
        <td><span class="tag tag-purple">${escapeHTML(c.category)}</span></td>
        <td>${escapeHTML(c.username || 'Membro')}</td>
        <td style="color: var(--text-muted);">${escapeHTML(c.inspiration || 'Sem notas')}</td>
        <td>${new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
        <td>
          <a href="${escapeHTML(c.link)}" target="_blank" class="btn btn-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Acessar Link
          </a>
        </td>
      </tr>
    `).join('');
  }

  // ------------------------------------------
  // RENDERIZAÇÃO ABA 6: RANKINGS & CONQUISTAS
  // ------------------------------------------
  function renderPodium() {
    const podiumEl = document.getElementById('podium-container');
    if (!podiumEl || !rankingsData || !rankingsData.byXP) return;

    const top3 = rankingsData.byXP.slice(0, 3);
    if (top3.length === 0) {
      podiumEl.innerHTML = '<p class="empty-state">Ainda não há pontuações suficientes para o pódio.</p>';
      return;
    }

    // Reordenar para 2º (esquerda), 1º (centro), 3º (direita)
    const podiumOrder = [];
    if (top3[1]) podiumOrder.push({ ...top3[1], rank: 2 });
    if (top3[0]) podiumOrder.push({ ...top3[0], rank: 1 });
    if (top3[2]) podiumOrder.push({ ...top3[2], rank: 3 });

    podiumEl.innerHTML = podiumOrder.map(user => `
      <div class="podium-card rank-${user.rank}">
        <div class="podium-rank-badge">${user.rank}</div>
        <div class="podium-avatar">${user.username.substring(0, 2).toUpperCase()}</div>
        <div class="podium-name">${escapeHTML(user.username)}</div>
        <div class="podium-score">${user.xp} XP • Nível ${user.level}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">
          <i class="fa-solid fa-fire" style="color: var(--amber);"></i> ${user.daily_streak} dias úteis
        </div>
      </div>
    `).join('');
  }

  function renderRankingTable() {
    const tbody = document.getElementById('ranking-table-body');
    if (!tbody || !rankingsData) return;

    let list = rankingsData.byXP;
    if (currentRankingSubtab === 'streak') list = rankingsData.byStreak;
    if (currentRankingSubtab === 'weeklyHours') list = rankingsData.byWeeklyHours;
    if (currentRankingSubtab === 'totalHours') list = rankingsData.byTotalHours;

    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Sem dados de ranking.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map((user, idx) => {
      const rank = idx + 1;
      let rankBadge = `#${rank}`;
      if (rank === 1) rankBadge = '🥇 #1';
      if (rank === 2) rankBadge = '🥈 #2';
      if (rank === 3) rankBadge = '🥉 #3';

      return `
        <tr>
          <td><strong>${rankBadge}</strong></td>
          <td><strong>${escapeHTML(user.username)}</strong></td>
          <td><span class="tag tag-cyan">Lvl ${user.level}</span></td>
          <td><strong style="color: var(--purple);">${user.xp} XP</strong></td>
          <td><span style="color: var(--amber);"><i class="fa-solid fa-fire"></i> ${user.daily_streak} dias</span></td>
          <td><strong style="color: var(--emerald);">${user.weeklyHours}h</strong> / 20h</td>
          <td>${user.totalHours}h</td>
        </tr>
      `;
    }).join('');
  }

  // ------------------------------------------
  // MODAL DE DETALHES DO BOLSISTA
  // ------------------------------------------
  async function openStudentModal(studentId) {
    const modal = document.getElementById('student-modal');
    const modalBody = document.getElementById('modal-body');
    if (!modal || !modalBody) return;

    modal.classList.add('active');
    modalBody.innerHTML = '<p class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Carregando perfil detalhado...</p>';

    try {
      const res = await fetch(`/api/students/${studentId}`).then(r => r.json());
      if (!res.success || !res.data) {
        modalBody.innerHTML = '<p class="empty-state">Erro ao carregar detalhes do aluno.</p>';
        return;
      }

      const s = res.data;
      const initials = s.username.substring(0, 2).toUpperCase();

      modalBody.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1.5rem; margin-bottom: 1.5rem;">
          <div class="student-avatar" style="width: 70px; height: 70px; font-size: 1.75rem;">${initials}</div>
          <div>
            <h2 style="font-family: var(--font-heading); font-size: 1.5rem; color: #fff;">${escapeHTML(s.username)}</h2>
            <p style="color: var(--cyan); font-size: 0.9rem;">${escapeHTML(s.role || 'Bolsista')} • Nível ${s.level} (${s.xp} XP)</p>
          </div>
        </div>

        <div class="student-stats-row" style="margin-bottom: 1.5rem;">
          <div class="stat-item">
            <div class="stat-val" style="color: var(--amber);"><i class="fa-solid fa-fire"></i> ${s.daily_streak}d</div>
            <div class="stat-lbl">Streak Atual</div>
          </div>
          <div class="stat-item">
            <div class="stat-val" style="color: var(--emerald);">${s.weeklyHours}h</div>
            <div class="stat-lbl">Nesta Semana</div>
          </div>
          <div class="stat-item">
            <div class="stat-val" style="color: var(--cyan);">${s.totalHours}h</div>
            <div class="stat-lbl">Horas Totais</div>
          </div>
          <div class="stat-item">
            <div class="stat-val" style="color: var(--purple);">${s.badgesCount}</div>
            <div class="stat-lbl">Badges</div>
          </div>
        </div>

        <!-- Badges Desbloqueadas -->
        ${s.badges.length > 0 ? `
          <div style="margin-bottom: 1.5rem;">
            <h4 style="color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; margin-bottom: 0.5rem;">Conquistas Desbloqueadas</h4>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              ${s.badges.map(b => `<span class="tag tag-amber"><i class="fa-solid fa-award"></i> ${escapeHTML(b.badge_id)}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Linha do Tempo de Dailies -->
        <h4 style="color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; margin-bottom: 0.75rem;">Histórico de Standups (${s.dailies.length})</h4>
        <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 250px; overflow-y: auto;">
          ${s.dailies.length === 0 ? '<p class="empty-state">Nenhuma daily registrada ainda.</p>' : s.dailies.map(d => `
            <div style="padding: 0.75rem 1rem; background: var(--bg-glass); border-radius: 10px; border: 1px solid var(--border-glass);">
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
                <strong style="color: var(--cyan);">${d.date} — ${d.hours_today}h</strong>
                <span style="color: var(--text-muted);">${escapeHTML(d.project_name || 'Geral')}</span>
              </div>
              <p style="font-size: 0.85rem; color: var(--text-main); margin-bottom: 0.25rem;"><strong>Concluído:</strong> ${escapeHTML(d.tasks_done)}</p>
              ${d.blockers ? `<p style="font-size: 0.8rem; color: var(--amber);"><strong>Bloqueio:</strong> ${escapeHTML(d.blockers)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      `;

    } catch (err) {
      modalBody.innerHTML = '<p class="empty-state">Erro ao conectar com a API.</p>';
    }
  }

  // Helper para sanitizar strings HTML
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
