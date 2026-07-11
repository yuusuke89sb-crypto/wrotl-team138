/**
 * WROTL チーム138♡ データ管理・計算ロジック
 */

const DataManager = {
    STORAGE_KEY: 'wrotl-team138',

    /**
     * デフォルトデータ構造
     */
    getDefaultData() {
        return {
            team: 'チーム138♡',
            members: [
                { name: 'Ⓟ吉村悠佑', games: [] },
                { name: 'らべる', games: [] },
                { name: 'えりんぎ138', games: [] },
                { name: 'M138', games: [] }
            ]
        };
    },

    /**
     * データを読み込み
     */
    load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                // メンバー数チェック・修復
                if (!data.members || data.members.length !== 4) {
                    return this.getDefaultData();
                }
                return this.sanitizeData(data);
            }
        } catch (e) {
            console.error('データ読み込みエラー:', e);
        }
        return this.getDefaultData();
    },

    /**
     * データをサニタイズ（Firebase互換性対応）
     * Firebaseは空配列をnullに変換するため、復元時に修正が必要
     */
    sanitizeData(data) {
        if (!data || !data.members) return this.getDefaultData();

        // membersが配列でない場合（Firebaseがオブジェクトに変換することがある）
        if (!Array.isArray(data.members)) {
            data.members = Object.values(data.members);
        }

        data.members.forEach(member => {
            // gamesがnullや未定義の場合
            if (!member.games) {
                member.games = [];
            }
            // gamesが配列でない場合（Firebaseがオブジェクトに変換）
            if (!Array.isArray(member.games)) {
                member.games = Object.values(member.games);
            }
            // nullやundefinedの対局データを除外
            member.games = member.games.filter(g => g !== null && g !== undefined);

            // 各ゲームのopponentsをサニタイズ
            member.games.forEach(g => {
                if (!g.opponents) g.opponents = [];
                if (!Array.isArray(g.opponents)) {
                    g.opponents = Object.values(g.opponents);
                }
                if (!g.opponentScores) g.opponentScores = {};
            });
        });

        return data;
    },

    /**
     * データを保存（localStorage + Firebase）
     */
    save(data) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            // Firebase同期
            if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isOnline) {
                FirebaseSync.saveData(data);
            }
        } catch (e) {
            console.error('データ保存エラー:', e);
        }
    },

    /**
     * 対局を追加
     */
    addGame(memberIndex, game) {
        const data = this.load();
        const member = data.members[memberIndex];
        game.id = Date.now();
        member.games.push(game);
        // 節番号→局番号でソート
        member.games.sort((a, b) => {
            if (a.session !== b.session) return a.session - b.session;
            return a.id - b.id;
        });
        this.save(data);
        return data;
    },

    /**
     * 対局を削除
     */
    deleteGame(memberIndex, gameId) {
        const data = this.load();
        const member = data.members[memberIndex];
        member.games = member.games.filter(g => g.id !== gameId);
        this.save(data);
        return data;
    },

    /**
     * 特定メンバーの特定節のデータを一括削除
     */
    deleteSession(memberIndex, session) {
        const data = this.load();
        const member = data.members[memberIndex];
        const before = member.games.length;
        member.games = member.games.filter(g => g.session !== session);
        const deleted = before - member.games.length;
        this.save(data);
        return { data, deleted };
    },

    /**
     * 対局を編集
     */
    updateGame(memberIndex, gameId, updates) {
        const data = this.load();
        const member = data.members[memberIndex];
        const game = member.games.find(g => g.id === gameId);
        if (game) {
            Object.assign(game, updates);
            this.save(data);
        }
        return data;
    },

    // ==========================================
    // 計算ロジック
    // ==========================================

    /**
     * 連続20半荘ベストスコアを計算（スライディングウィンドウ）
     * @param {Array} games - 時系列ソート済みの対局配列
     * @returns {Object} { bestScore, startIndex, endIndex, windowGames }
     */
    calcBest20(games) {
        if (games.length === 0) {
            return { bestScore: 0, startIndex: -1, endIndex: -1, windowGames: [] };
        }

        if (games.length <= 20) {
            const total = games.reduce((sum, g) => sum + g.score, 0);
            return {
                bestScore: Math.round(total * 10) / 10,
                startIndex: 0,
                endIndex: games.length - 1,
                windowGames: games
            };
        }

        let bestScore = -Infinity;
        let bestStart = 0;

        // 最初のウィンドウの合計
        let windowSum = 0;
        for (let i = 0; i < 20; i++) {
            windowSum += games[i].score;
        }
        bestScore = windowSum;

        // スライド
        for (let i = 1; i <= games.length - 20; i++) {
            windowSum -= games[i - 1].score;
            windowSum += games[i + 19].score;
            if (windowSum > bestScore) {
                bestScore = windowSum;
                bestStart = i;
            }
        }

        return {
            bestScore: Math.round(bestScore * 10) / 10,
            startIndex: bestStart,
            endIndex: bestStart + 19,
            windowGames: games.slice(bestStart, bestStart + 20)
        };
    },

    /**
     * メンバーの統計情報を計算
     */
    calcStats(games) {
        if (games.length === 0) {
            return {
                totalGames: 0,
                totalScore: 0,
                avgScore: 0,
                avgRank: 0,
                rankCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
                rankRates: { 1: 0, 2: 0, 3: 0, 4: 0 },
                topRate: 0,
                lastRate: 0,
                sessionStats: {}
            };
        }

        const totalScore = Math.round(games.reduce((sum, g) => sum + g.score, 0) * 10) / 10;
        const avgScore = Math.round((totalScore / games.length) * 100) / 100;

        const rankCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
        let rankSum = 0;

        games.forEach(g => {
            rankCounts[g.rank] = (rankCounts[g.rank] || 0) + 1;
            rankSum += g.rank;
        });

        const avgRank = Math.round((rankSum / games.length) * 100) / 100;
        const rankRates = {};
        for (let r = 1; r <= 4; r++) {
            rankRates[r] = Math.round((rankCounts[r] / games.length) * 1000) / 10;
        }

        // 節ごとの統計
        const sessionStats = {};
        games.forEach(g => {
            if (!sessionStats[g.session]) {
                sessionStats[g.session] = { games: [], totalScore: 0 };
            }
            sessionStats[g.session].games.push(g);
            sessionStats[g.session].totalScore += g.score;
        });

        // 各節の合計を丸める
        Object.values(sessionStats).forEach(s => {
            s.totalScore = Math.round(s.totalScore * 10) / 10;
        });

        return {
            totalGames: games.length,
            totalScore,
            avgScore,
            avgRank,
            rankCounts,
            rankRates,
            topRate: rankRates[1],
            lastRate: rankRates[4],
            sessionStats
        };
    },

    /**
     * 対戦相手ごとの戦績を集計
     */
    calcOpponentStats(games) {
        const opponentMap = {};

        games.forEach(g => {
            if (!g.opponents) return;
            // opponents が文字列配列の場合と混在を処理
            g.opponents.forEach(opp => {
                if (!opp || opp.trim() === '') return;
                const name = opp.trim();
                if (!opponentMap[name]) {
                    opponentMap[name] = {
                        name,
                        count: 0,
                        totalScore: 0,
                        totalOppScore: 0,
                        totalDiff: 0,
                        hasDiffData: false,
                        rankSum: 0,
                        ranks: { 1: 0, 2: 0, 3: 0, 4: 0 }
                    };
                }
                opponentMap[name].count++;
                opponentMap[name].totalScore += g.score;
                opponentMap[name].rankSum += g.rank;
                opponentMap[name].ranks[g.rank]++;

                // 対戦相手スコアがある場合、スコア差を計算
                if (g.opponentScores && g.opponentScores[name] !== undefined) {
                    const oppScore = g.opponentScores[name];
                    opponentMap[name].totalOppScore += oppScore;
                    opponentMap[name].totalDiff += (g.score - oppScore);
                    opponentMap[name].hasDiffData = true;
                }
            });
        });

        return Object.values(opponentMap)
            .map(opp => ({
                ...opp,
                totalScore: Math.round(opp.totalScore * 10) / 10,
                avgScore: Math.round((opp.totalScore / opp.count) * 100) / 100,
                avgRank: Math.round((opp.rankSum / opp.count) * 100) / 100,
                totalDiff: Math.round(opp.totalDiff * 10) / 10,
                avgDiff: opp.hasDiffData ? Math.round((opp.totalDiff / opp.count) * 100) / 100 : null
            }))
            .sort((a, b) => b.count - a.count);
    },

    /**
     * 全メンバーの対戦相手名一覧を取得（サジェスト用）
     */
    getAllOpponentNames() {
        const data = this.load();
        const names = new Set();
        data.members.forEach(m => {
            m.games.forEach(g => {
                if (g.opponents) {
                    g.opponents.forEach(o => {
                        if (o && o.trim()) names.add(o.trim());
                    });
                }
            });
        });
        return [...names].sort();
    },

    /**
     * 累積ポイント推移データを生成（グラフ用）
     */
    calcCumulativeScores(games) {
        let cumulative = 0;
        return games.map((g, i) => {
            cumulative += g.score;
            return {
                index: i + 1,
                score: g.score,
                cumulative: Math.round(cumulative * 10) / 10,
                session: g.session,
                rank: g.rank
            };
        });
    },

    /**
     * データをJSONでエクスポート
     */
    exportJSON() {
        return JSON.stringify(this.load(), null, 2);
    },

    /**
     * JSONデータをインポート
     */
    importJSON(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            if (!data.members || !Array.isArray(data.members)) {
                throw new Error('メンバーデータが不正です');
            }
            this.save(data);
            return data;
        } catch (e) {
            throw new Error(`インポートエラー: ${e.message}`);
        }
    },

    /**
     * 初期データを投入（Ⓟ吉村悠佑の1節8局分 — 対戦相手付き）
     */
    seedInitialData() {
        const data = this.load();
        const yoshimura = data.members[0];

        // 既にデータがあればスキップ
        if (yoshimura.games.length > 0) return data;

        const initialGames = [
            { id: 1, session: 1, score: 36.9, rank: 1, opponents: ['nob929', 'Ⓟ奥野真語', 'Ⓟ中村毅'], opponentScores: {'nob929': 11.7, 'Ⓟ奥野真語': -1.3, 'Ⓟ中村毅': -47.3}, date: '2026-07-04' },
            { id: 2, session: 1, score: 8.1, rank: 2, opponents: ['Ⓟ渡邊真央', 'Ⓟ古本和宏', 'Ⓟ奥野真語'], opponentScores: {'Ⓟ渡邊真央': 18.7, 'Ⓟ古本和宏': -7.6, 'Ⓟ奥野真語': -19.2}, date: '2026-07-04' },
            { id: 3, session: 1, score: -30.2, rank: 4, opponents: ['Ⓟ千本松紘子', 'Ⓟ岡田裕太', 'Ⓟ奥野真語'], opponentScores: {'Ⓟ千本松紘子': 21.9, 'Ⓟ岡田裕太': 10.5, 'Ⓟ奥野真語': -2.2}, date: '2026-07-04' },
            { id: 4, session: 1, score: 7.4, rank: 2, opponents: ['Ⓟ千本松紘子', 'えんま', 'れっくす016'], opponentScores: {'Ⓟ千本松紘子': 20.0, 'えんま': -2.7, 'れっくす016': -24.7}, date: '2026-07-04' },
            { id: 5, session: 1, score: 6.7, rank: 2, opponents: ['れっくす016', 'Ⓟ島秀彰', 'えんま'], opponentScores: {'れっくす016': 32.7, 'Ⓟ島秀彰': -11.8, 'えんま': -27.6}, date: '2026-07-05' },
            { id: 6, session: 1, score: 13.5, rank: 2, opponents: ['Ⓟ中村毅', 'Ⓟ朝比奈ゆり', 'Ⓟ黒木真生'], opponentScores: {'Ⓟ中村毅': 34.8, 'Ⓟ朝比奈ゆり': -11.8, 'Ⓟ黒木真生': -36.5}, date: '2026-07-05' },
            { id: 7, session: 1, score: 1.6, rank: 3, opponents: ['Ⓟ朝比奈ゆり', 'beyonce', '入海翔'], opponentScores: {'Ⓟ朝比奈ゆり': 27.8, 'beyonce': 17.4, '入海翔': -46.8}, date: '2026-07-05' },
            { id: 8, session: 1, score: 17.9, rank: 2, opponents: ['Ⓟ貴志功武', '入海翔', 'Ⓟ堀部雄太'], opponentScores: {'Ⓟ貴志功武': 30.3, '入海翔': -16.8, 'Ⓟ堀部雄太': -31.4}, date: '2026-07-05' }
        ];

        yoshimura.games = initialGames;
        this.save(data);
        return data;
    },

    /**
     * のどっちフォーマットのテキストデータをパース
     * 
     * 入力フォーマット（1対局3行）:
     *   1位\tC0105\t2026-07-04 22:00\t四般南喰－－\t
     *   新人0pt
     *   Ⓟ吉村悠佑(+36.9)nob929(+11.7)Ⓟ奥野真語(-1.3)Ⓟ中村毅(-47.3)
     *
     * @param {string} text - のどっちからコピーしたテキスト
     * @param {string} playerName - 検索するプレイヤー名
     * @param {number} session - 節番号
     * @returns {Array} パースされた対局データの配列
     */
    parseNodocchiData(text, playerName, session) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const games = [];

        // 結果行のパターン: name(+/-score)name(+/-score)...
        const resultPattern = /([^()]+)\(([+-]?\d+\.?\d*)\)/g;
        // 順位行のパターン: X位\t...
        const rankLinePattern = /^(\d)位\t/;

        let currentRankLine = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 順位行を検出
            const rankMatch = line.match(rankLinePattern);
            if (rankMatch) {
                currentRankLine = line;
                continue;
            }

            // 段位行はスキップ
            if (/^\S+\d+pt$/.test(line) || /^新人/.test(line) || /^\d+級/.test(line)) {
                continue;
            }

            // 結果行を検出（プレイヤー名(スコア)のパターンがあるか）
            const players = [];
            let match;
            const regex = /([^()]+)\(([+-]?\d+\.?\d*)\)/g;
            while ((match = regex.exec(line)) !== null) {
                players.push({
                    name: match[1].trim(),
                    score: parseFloat(match[2])
                });
            }

            if (players.length >= 3) {
                // プレイヤーを検索
                const self = players.find(p => p.name === playerName);
                if (!self) continue;

                // 順位を決定（スコア順）
                const sorted = [...players].sort((a, b) => b.score - a.score);
                const rank = sorted.findIndex(p => p.name === playerName) + 1;

                // 対戦相手とスコア
                const opponents = [];
                const opponentScores = {};
                players.filter(p => p.name !== playerName).forEach(p => {
                    opponents.push(p.name);
                    opponentScores[p.name] = p.score;
                });

                // 日付を抽出
                let date = '';
                if (currentRankLine) {
                    const dateMatch = currentRankLine.match(/(\d{4}-\d{2}-\d{2})/);
                    if (dateMatch) date = dateMatch[1];
                }

                games.push({
                    id: Date.now() + games.length,
                    session,
                    score: self.score,
                    rank,
                    opponents,
                    opponentScores,
                    date
                });
            }
        }

        return games;
    },

    /**
     * のどっちデータを一括インポート
     */
    bulkImportNodocchi(memberIndex, text, session) {
        const data = this.load();
        const member = data.members[memberIndex];
        const parsed = this.parseNodocchiData(text, member.name, session);

        if (parsed.length === 0) {
            throw new Error(`「${member.name}」の対局データが見つかりませんでした。\nプレイヤー名が正確か確認してください。`);
        }

        // IDを再付与して追加
        parsed.forEach((g, i) => {
            g.id = Date.now() + i;
            member.games.push(g);
        });

        // ソート
        member.games.sort((a, b) => {
            if (a.session !== b.session) return a.session - b.session;
            return a.id - b.id;
        });

        this.save(data);
        return { data, importedCount: parsed.length };
    },

    /**
     * チーム全体の節ごとの累積スコアを計算
     */
    calcTeamCumulativeBySession(data) {
        const sessionScores = Array(17).fill(0);
        let maxSession = 0;
        data.members.forEach(m => {
            m.games.forEach(g => {
                const s = g.session;
                if (s >= 1 && s <= 17) {
                    sessionScores[s - 1] += g.score;
                    if (s > maxSession) maxSession = s;
                }
            });
        });
        if (maxSession === 0) maxSession = 1;
        let cumulative = 0;
        return sessionScores.slice(0, maxSession).map((score, index) => {
            cumulative += score;
            return {
                session: index + 1,
                score: Math.round(score * 10) / 10,
                cumulative: Math.round(cumulative * 10) / 10
            };
        });
    },

    /**
     * 対戦チームごとの戦績を集計
     */
    calcTeamStats(games) {
        const teamMap = {};
        games.forEach(g => {
            if (!g.opponents) return;
            g.opponents.forEach(opp => {
                if (!opp || opp.trim() === '') return;
                const opponentName = opp.trim();
                const teamName = (typeof getTeamName === 'function') ? getTeamName(opponentName) : null;
                if (!teamName) return; // 登録チームでない場合は対象外

                if (!teamMap[teamName]) {
                    teamMap[teamName] = {
                        teamName,
                        count: 0,
                        totalScore: 0,
                        totalOppScore: 0,
                        totalDiff: 0,
                        hasDiffData: false,
                        rankSum: 0,
                        ranks: { 1: 0, 2: 0, 3: 0, 4: 0 }
                    };
                }
                const t = teamMap[teamName];
                t.count++;
                t.totalScore += g.score;
                t.rankSum += g.rank;
                t.ranks[g.rank]++;

                if (g.opponentScores && g.opponentScores[opponentName] !== undefined) {
                    const oppScore = g.opponentScores[opponentName];
                    t.totalOppScore += oppScore;
                    t.totalDiff += (g.score - oppScore);
                    t.hasDiffData = true;
                }
            });
        });

        return Object.values(teamMap)
            .map(t => ({
                ...t,
                totalScore: Math.round(t.totalScore * 10) / 10,
                avgScore: Math.round((t.totalScore / t.count) * 10) / 10,
                avgRank: Math.round((t.rankSum / t.count) * 100) / 100,
                totalDiff: Math.round(t.totalDiff * 10) / 10,
                avgDiff: t.hasDiffData ? Math.round((t.totalDiff / t.count) * 10) / 10 : null
            }))
            .sort((a, b) => b.count - a.count);
    }
};
