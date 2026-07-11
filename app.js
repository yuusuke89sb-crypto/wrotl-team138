/**
 * WROTL チーム138♡ UIロジック・グラフ描画
 */

const App = {
    currentTab: 'dashboard',
    charts: {},

    init() {
        // 初期データ投入
        DataManager.seedInitialData();

        // タブイベント
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });

        // 初期表示
        this.render();
    },

    // ==========================================
    // タブ切り替え
    // ==========================================
    switchTab(tabId) {
        this.currentTab = tabId;

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`tab-${tabId}`).classList.add('active');

        this.render();
    },

    // ==========================================
    // レンダリング
    // ==========================================
    render() {
        if (this.currentTab === 'dashboard') {
            this.renderDashboard();
        } else if (this.currentTab.startsWith('member-')) {
            const idx = parseInt(this.currentTab.split('-')[1]);
            this.renderMemberPage(idx);
        }
    },

    // ==========================================
    // ダッシュボード
    // ==========================================
    renderDashboard() {
        const data = DataManager.load();
        const grid = document.getElementById('dashboard-grid');
        let totalBest = 0;
        let html = '';

        data.members.forEach((member, i) => {
            const stats = DataManager.calcStats(member.games);
            const best = DataManager.calcBest20(member.games);
            totalBest += best.bestScore;

            const scoreClass = best.bestScore > 0 ? 'positive' : best.bestScore < 0 ? 'negative' : 'zero';
            const sign = best.bestScore > 0 ? '+' : '';

            html += `
                <div class="member-card" onclick="App.switchTab('member-${i}')">
                    <div class="member-name">${member.name}</div>
                    <div class="best-score ${scoreClass}">${sign}${best.bestScore.toFixed(1)}</div>
                    <div style="font-size: var(--font-size-xs); color: var(--color-text-muted);">ベスト${Math.min(stats.totalGames, 20)}半荘</div>
                    <div class="stats-row">
                        <div class="stat-item">
                            <div class="stat-value">${stats.totalGames}</div>
                            <div>対局数</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${stats.totalGames > 0 ? stats.avgRank.toFixed(2) : '-'}</div>
                            <div>平均順位</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${stats.totalGames > 0 ? stats.topRate + '%' : '-'}</div>
                            <div>トップ率</div>
                        </div>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = html;

        // チーム合計
        const totalEl = document.getElementById('team-total-score');
        const rounded = Math.round(totalBest * 10) / 10;
        const totalSign = rounded > 0 ? '+' : '';
        totalEl.textContent = `${totalSign}${rounded.toFixed(1)}`;
        totalEl.style.color = rounded > 0 ? 'var(--color-success)' : rounded < 0 ? 'var(--color-danger)' : 'var(--color-text)';

        // チームグラフ
        this.renderTeamChart(data);
    },

    renderTeamChart(data) {
        const ctx = document.getElementById('team-chart');
        if (!ctx) return;

        if (this.charts.team) this.charts.team.destroy();

        const datasets = [];
        const colors = ['#6366f1', '#ec4899', '#22c55e', '#f59e0b'];

        data.members.forEach((member, i) => {
            if (member.games.length === 0) return;
            const cumData = DataManager.calcCumulativeScores(member.games);
            datasets.push({
                label: member.name,
                data: cumData.map(d => d.cumulative),
                borderColor: colors[i],
                backgroundColor: colors[i] + '20',
                tension: 0.3,
                pointRadius: 3,
                borderWidth: 2,
                fill: false
            });
        });

        if (datasets.length === 0) return;

        const maxLen = Math.max(...data.members.map(m => m.games.length));
        const labels = Array.from({ length: maxLen }, (_, i) => i + 1);

        this.charts.team = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#e2e8f0', font: { family: 'Noto Sans JP' } }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: '対局数', color: '#94a3b8' },
                        ticks: { color: '#94a3b8' },
                        grid: { color: '#334155' }
                    },
                    y: {
                        title: { display: true, text: '累計ポイント', color: '#94a3b8' },
                        ticks: { color: '#94a3b8' },
                        grid: { color: '#334155' }
                    }
                }
            }
        });
    },

    // ==========================================
    // 個人ページ
    // ==========================================
    renderMemberPage(memberIndex) {
        const data = DataManager.load();
        const member = data.members[memberIndex];
        const stats = DataManager.calcStats(member.games);
        const best = DataManager.calcBest20(member.games);
        const oppStats = DataManager.calcOpponentStats(member.games);
        const container = document.getElementById(`tab-member-${memberIndex}`);

        let html = '';

        // ==========================================
        // スコア入力フォーム
        // ==========================================
        html += `
        <div class="card">
            <h2 class="card-title">➕ 対局結果を追加</h2>
            <div class="form-row" style="grid-template-columns: 80px 120px 80px;">
                <div class="form-group">
                    <label class="form-label">節</label>
                    <select class="form-select" id="add-session-${memberIndex}">
                        ${Array.from({ length: 13 }, (_, i) => `<option value="${i + 1}">${i + 1}節</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">スコア</label>
                    <input type="number" class="form-input" id="add-score-${memberIndex}" step="0.1" placeholder="36.9">
                </div>
                <div class="form-group">
                    <label class="form-label">着順</label>
                    <select class="form-select" id="add-rank-${memberIndex}">
                        <option value="1">1着</option>
                        <option value="2">2着</option>
                        <option value="3">3着</option>
                        <option value="4">4着</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">対戦相手（3名）</label>
                <div class="form-row-3">
                    <div class="opp-input-wrap">
                        <input type="text" class="form-input opp-input" id="add-opp0-${memberIndex}" placeholder="相手1" data-member="${memberIndex}" data-opp-idx="0">
                    </div>
                    <div class="opp-input-wrap">
                        <input type="text" class="form-input opp-input" id="add-opp1-${memberIndex}" placeholder="相手2" data-member="${memberIndex}" data-opp-idx="1">
                    </div>
                    <div class="opp-input-wrap">
                        <input type="text" class="form-input opp-input" id="add-opp2-${memberIndex}" placeholder="相手3" data-member="${memberIndex}" data-opp-idx="2">
                    </div>
                </div>
            </div>
            <button class="btn btn-primary btn-block" onclick="App.addGame(${memberIndex})">追加</button>
        </div>
        `;

        // ==========================================
        // のどっち一括入力
        // ==========================================
        html += `
        <div class="card">
            <h2 class="card-title">📋 のどっちデータ一括入力</h2>
            <p class="card-subtitle">のどっち（nodocchi.moe）から対局データをコピー＆ペーストで一括登録できます</p>
            <div class="form-row" style="grid-template-columns: 100px 1fr; align-items: end;">
                <div class="form-group">
                    <label class="form-label">節</label>
                    <select class="form-select" id="bulk-session-${memberIndex}">
                        ${Array.from({ length: 13 }, (_, i) => `<option value="${i + 1}">${i + 1}節</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <span style="font-size: var(--font-size-xs); color: var(--color-text-muted);">検索名: ${member.name}</span>
                </div>
            </div>
            <div class="form-group">
                <textarea class="form-input" id="bulk-text-${memberIndex}" rows="6" placeholder="のどっちからコピーしたデータを貼り付けてください&#10;&#10;例:&#10;1位	C0105	2026-07-04 22:00	四般南喰－－	&#10;新人0pt&#10;Ⓟ吉村悠佑(+36.9)nob929(+11.7)Ⓟ奥野真語(-1.3)Ⓟ中村毅(-47.3)"></textarea>
            </div>
            <button class="btn btn-primary btn-block" onclick="App.bulkImport(${memberIndex})">📥 一括インポート</button>
        </div>
        `;

        // ==========================================
        // ベスト20半荘
        // ==========================================
        const bestSign = best.bestScore > 0 ? '+' : '';
        const bestColor = best.bestScore > 0 ? 'var(--color-success)' : best.bestScore < 0 ? 'var(--color-danger)' : 'var(--color-text)';

        html += `
        <div class="card">
            <h2 class="card-title">🏆 ベスト${Math.min(stats.totalGames, 20)}半荘スコア</h2>
            <div style="text-align: center; margin: var(--spacing-md) 0;">
                <div style="font-size: var(--font-size-2xl); font-weight: 700; color: ${bestColor};">
                    ${bestSign}${best.bestScore.toFixed(1)}
                </div>
                ${stats.totalGames >= 20 ? `<div style="font-size: var(--font-size-xs); color: var(--color-text-muted);">第${best.startIndex + 1}局目〜第${best.endIndex + 1}局目</div>` : `<div style="font-size: var(--font-size-xs); color: var(--color-text-muted);">全${stats.totalGames}局の合計（20局未満）</div>`}
            </div>
        </div>
        `;

        // ==========================================
        // 統計バッジ
        // ==========================================
        html += `
        <div class="stat-badges">
            <div class="stat-badge">
                <div class="badge-label">総対局数</div>
                <div class="badge-value">${stats.totalGames}</div>
            </div>
            <div class="stat-badge">
                <div class="badge-label">総合スコア</div>
                <div class="badge-value" style="color: ${stats.totalScore >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}">
                    ${stats.totalScore >= 0 ? '+' : ''}${stats.totalScore.toFixed(1)}
                </div>
            </div>
            <div class="stat-badge">
                <div class="badge-label">平均スコア</div>
                <div class="badge-value">${stats.totalGames > 0 ? stats.avgScore.toFixed(2) : '-'}</div>
            </div>
            <div class="stat-badge">
                <div class="badge-label">平均順位</div>
                <div class="badge-value">${stats.totalGames > 0 ? stats.avgRank.toFixed(2) : '-'}</div>
            </div>
            <div class="stat-badge">
                <div class="badge-label">トップ率</div>
                <div class="badge-value">${stats.totalGames > 0 ? stats.topRate + '%' : '-'}</div>
            </div>
            <div class="stat-badge">
                <div class="badge-label">ラス率</div>
                <div class="badge-value">${stats.totalGames > 0 ? stats.lastRate + '%' : '-'}</div>
            </div>
        </div>
        `;

        // ==========================================
        // 順位分布
        // ==========================================
        html += `
        <div class="card">
            <h2 class="card-title">🎯 順位分布</h2>
            <div class="rank-dist">
                <div class="rank-dist-item">
                    <div class="rank-label">1着</div>
                    <div class="rank-count" style="color: var(--color-rank-1)">${stats.rankCounts[1]}</div>
                    <div class="rank-rate">${stats.rankRates[1]}%</div>
                </div>
                <div class="rank-dist-item">
                    <div class="rank-label">2着</div>
                    <div class="rank-count" style="color: var(--color-rank-2)">${stats.rankCounts[2]}</div>
                    <div class="rank-rate">${stats.rankRates[2]}%</div>
                </div>
                <div class="rank-dist-item">
                    <div class="rank-label">3着</div>
                    <div class="rank-count" style="color: var(--color-rank-3)">${stats.rankCounts[3]}</div>
                    <div class="rank-rate">${stats.rankRates[3]}%</div>
                </div>
                <div class="rank-dist-item">
                    <div class="rank-label">4着</div>
                    <div class="rank-count" style="color: var(--color-rank-4)">${stats.rankCounts[4]}</div>
                    <div class="rank-rate">${stats.rankRates[4]}%</div>
                </div>
            </div>
            <div class="chart-container" style="height: 200px;">
                <canvas id="rank-chart-${memberIndex}"></canvas>
            </div>
        </div>
        `;

        // ==========================================
        // ポイント推移グラフ
        // ==========================================
        html += `
        <div class="card">
            <h2 class="card-title">📈 ポイント推移</h2>
            <div class="chart-container">
                <canvas id="score-chart-${memberIndex}"></canvas>
            </div>
        </div>
        `;

        // ==========================================
        // 対戦相手戦績
        // ==========================================
        html += `
        <div class="card">
            <h2 class="card-title">🤝 対戦相手との戦績</h2>
        `;

        if (oppStats.length > 0) {
            html += `
            <div class="opponent-table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>対戦相手</th>
                            <th>回数</th>
                            <th>平均順位</th>
                            <th>平均スコア</th>
                            <th>合計</th>
                            <th>スコア差</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            oppStats.forEach(opp => {
                const scoreClass = opp.avgScore >= 0 ? 'score-positive' : 'score-negative';
                const totalClass = opp.totalScore >= 0 ? 'score-positive' : 'score-negative';

                let diffCell = '<td style="color: var(--color-text-muted);">-</td>';
                if (opp.avgDiff !== null) {
                    const diffClass = opp.totalDiff >= 0 ? 'score-positive' : 'score-negative';
                    const diffSign = opp.totalDiff >= 0 ? '+' : '';
                    const avgDiffSign = opp.avgDiff >= 0 ? '+' : '';
                    diffCell = `<td class="${diffClass}" title="平均差: ${avgDiffSign}${opp.avgDiff.toFixed(1)}/局">${diffSign}${opp.totalDiff.toFixed(1)}</td>`;
                }

                html += `
                    <tr>
                        <td>${opp.name}</td>
                        <td>${opp.count}</td>
                        <td>${opp.avgRank.toFixed(2)}</td>
                        <td class="${scoreClass}">${opp.avgScore >= 0 ? '+' : ''}${opp.avgScore.toFixed(1)}</td>
                        <td class="${totalClass}">${opp.totalScore >= 0 ? '+' : ''}${opp.totalScore.toFixed(1)}</td>
                        ${diffCell}
                    </tr>
                `;
            });
            html += `</tbody></table></div>`;
        } else {
            html += `<div class="empty-state"><div class="empty-icon">🤷</div><p>対戦相手データがまだありません</p></div>`;
        }
        html += `</div>`;

        // ==========================================
        // 対局一覧
        // ==========================================
        html += `
        <div class="card">
            <h2 class="card-title">📋 対局一覧</h2>
        `;

        if (member.games.length > 0) {
            html += `
            <div class="game-list-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>節</th>
                            <th>スコア</th>
                            <th>着順</th>
                            <th>対戦相手</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            member.games.forEach((g, gi) => {
                const scoreClass = g.score >= 0 ? 'score-positive' : 'score-negative';
                const isBest = stats.totalGames >= 20 && gi >= best.startIndex && gi <= best.endIndex;
                const highlightClass = isBest ? ' best-highlight' : '';
                const oppText = (g.opponents || []).filter(o => o).join(', ') || '-';
                html += `
                    <tr class="${highlightClass}">
                        <td>${gi + 1}</td>
                        <td>${g.session}節</td>
                        <td class="${scoreClass}">${g.score >= 0 ? '+' : ''}${g.score.toFixed(1)}</td>
                        <td><span class="rank-badge rank-${g.rank}">${g.rank}</span></td>
                        <td style="font-size: var(--font-size-xs); max-width: 150px; overflow: hidden; text-overflow: ellipsis;">${oppText}</td>
                        <td><button class="delete-btn" onclick="App.deleteGame(${memberIndex}, ${g.id})" title="削除">✕</button></td>
                    </tr>
                `;
            });
            html += `</tbody></table></div>`;
        } else {
            html += `<div class="empty-state"><div class="empty-icon">📭</div><p>まだ対局データがありません</p></div>`;
        }
        html += `</div>`;

        container.innerHTML = html;

        // グラフ描画（DOMが挿入されてから）
        setTimeout(() => {
            this.renderScoreChart(memberIndex, member.games, best);
            this.renderRankChart(memberIndex, stats);
            this.setupOpponentSuggest(memberIndex);
        }, 50);
    },

    // ==========================================
    // ポイント推移グラフ
    // ==========================================
    renderScoreChart(memberIndex, games, best) {
        const ctx = document.getElementById(`score-chart-${memberIndex}`);
        if (!ctx || games.length === 0) return;

        const chartKey = `score-${memberIndex}`;
        if (this.charts[chartKey]) this.charts[chartKey].destroy();

        const cumData = DataManager.calcCumulativeScores(games);
        const labels = cumData.map(d => `${d.index}`);

        // ベスト区間の背景色
        const bgColors = cumData.map((d, i) => {
            if (games.length >= 20 && i >= best.startIndex && i <= best.endIndex) {
                return 'rgba(99, 102, 241, 0.3)';
            }
            return 'rgba(99, 102, 241, 0.05)';
        });

        this.charts[chartKey] = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: '累計ポイント',
                    data: cumData.map(d => d.cumulative),
                    borderColor: '#6366f1',
                    backgroundColor: bgColors,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: cumData.map(d => {
                        const colors = { 1: '#fbbf24', 2: '#94a3b8', 3: '#c2855a', 4: '#6b7280' };
                        return colors[d.rank];
                    }),
                    borderWidth: 2,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (items) => `第${items[0].label}局`,
                            label: (item) => {
                                const d = cumData[item.dataIndex];
                                return [
                                    `累計: ${d.cumulative >= 0 ? '+' : ''}${d.cumulative.toFixed(1)}`,
                                    `この局: ${d.score >= 0 ? '+' : ''}${d.score.toFixed(1)}`,
                                    `${d.rank}着 (${d.session}節)`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: '対局数', color: '#94a3b8' },
                        ticks: { color: '#94a3b8' },
                        grid: { color: '#334155' }
                    },
                    y: {
                        title: { display: true, text: '累計ポイント', color: '#94a3b8' },
                        ticks: { color: '#94a3b8' },
                        grid: { color: '#334155' }
                    }
                }
            }
        });
    },

    // ==========================================
    // 順位分布チャート
    // ==========================================
    renderRankChart(memberIndex, stats) {
        const ctx = document.getElementById(`rank-chart-${memberIndex}`);
        if (!ctx || stats.totalGames === 0) return;

        const chartKey = `rank-${memberIndex}`;
        if (this.charts[chartKey]) this.charts[chartKey].destroy();

        this.charts[chartKey] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['1着', '2着', '3着', '4着'],
                datasets: [{
                    data: [stats.rankCounts[1], stats.rankCounts[2], stats.rankCounts[3], stats.rankCounts[4]],
                    backgroundColor: ['#fbbf24', '#94a3b8', '#c2855a', '#6b7280'],
                    borderColor: '#1e293b',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#e2e8f0', font: { family: 'Noto Sans JP', size: 12 } }
                    }
                }
            }
        });
    },

    // ==========================================
    // 対戦相手サジェスト
    // ==========================================
    setupOpponentSuggest(memberIndex) {
        const inputs = document.querySelectorAll(`#tab-member-${memberIndex} .opp-input`);
        const allNames = DataManager.getAllOpponentNames();

        inputs.forEach(input => {
            input.addEventListener('input', () => {
                const val = input.value.trim().toLowerCase();
                const wrap = input.closest('.opp-input-wrap');
                let suggEl = wrap.querySelector('.suggestion-list');

                if (!val) {
                    if (suggEl) suggEl.remove();
                    return;
                }

                const matches = allNames.filter(n => n.toLowerCase().includes(val));
                if (matches.length === 0) {
                    if (suggEl) suggEl.remove();
                    return;
                }

                if (!suggEl) {
                    suggEl = document.createElement('div');
                    suggEl.className = 'suggestion-list';
                    wrap.appendChild(suggEl);
                }

                suggEl.innerHTML = matches.map(m =>
                    `<div class="suggestion-item" data-name="${m}">${m}</div>`
                ).join('');

                suggEl.querySelectorAll('.suggestion-item').forEach(item => {
                    item.addEventListener('click', () => {
                        input.value = item.dataset.name;
                        suggEl.remove();
                    });
                });
            });

            input.addEventListener('blur', () => {
                setTimeout(() => {
                    const wrap = input.closest('.opp-input-wrap');
                    const suggEl = wrap.querySelector('.suggestion-list');
                    if (suggEl) suggEl.remove();
                }, 200);
            });
        });
    },

    // ==========================================
    // 対局追加
    // ==========================================
    addGame(memberIndex) {
        const session = parseInt(document.getElementById(`add-session-${memberIndex}`).value);
        const scoreInput = document.getElementById(`add-score-${memberIndex}`);
        const score = parseFloat(scoreInput.value);
        const rank = parseInt(document.getElementById(`add-rank-${memberIndex}`).value);

        if (isNaN(score)) {
            alert('スコアを入力してください');
            return;
        }

        const opponents = [];
        for (let i = 0; i < 3; i++) {
            const opp = document.getElementById(`add-opp${i}-${memberIndex}`).value.trim();
            if (opp) opponents.push(opp);
        }

        const game = {
            session,
            score,
            rank,
            opponents,
            date: new Date().toISOString().split('T')[0]
        };

        DataManager.addGame(memberIndex, game);

        // フォームリセット
        scoreInput.value = '';
        for (let i = 0; i < 3; i++) {
            document.getElementById(`add-opp${i}-${memberIndex}`).value = '';
        }

        this.render();
    },

    // ==========================================
    // 対局削除
    // ==========================================
    deleteGame(memberIndex, gameId) {
        if (!confirm('この対局を削除しますか？')) return;
        DataManager.deleteGame(memberIndex, gameId);
        this.render();
    },

    // ==========================================
    // データ管理
    // ==========================================
    exportData() {
        const json = DataManager.exportJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wrotl_team138_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    showImportDialog() {
        document.getElementById('import-dialog').style.display = 'block';
    },

    importData() {
        const textarea = document.getElementById('import-textarea');
        try {
            DataManager.importJSON(textarea.value);
            document.getElementById('import-dialog').style.display = 'none';
            textarea.value = '';
            alert('インポートが完了しました');
            this.render();
        } catch (e) {
            alert(e.message);
        }
    },

    resetData() {
        if (!confirm('すべてのデータをリセットしますか？\nこの操作は取り消せません。')) return;
        localStorage.removeItem(DataManager.STORAGE_KEY);
        // 空のデフォルトデータで再初期化（初期データは入れない）
        const defaultData = DataManager.getDefaultData();
        DataManager.save(defaultData);
        this.switchTab('dashboard');
    },

    // ==========================================
    // のどっちデータ一括インポート
    // ==========================================
    bulkImport(memberIndex) {
        const session = parseInt(document.getElementById(`bulk-session-${memberIndex}`).value);
        const text = document.getElementById(`bulk-text-${memberIndex}`).value.trim();

        if (!text) {
            alert('データを貼り付けてください');
            return;
        }

        try {
            const result = DataManager.bulkImportNodocchi(memberIndex, text, session);
            alert(`${result.importedCount}局のデータをインポートしました`);
            document.getElementById(`bulk-text-${memberIndex}`).value = '';
            this.render();
        } catch (e) {
            alert(e.message);
        }
    }
};

// アプリ起動
document.addEventListener('DOMContentLoaded', () => App.init());
