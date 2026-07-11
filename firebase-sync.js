/**
 * WROTL チーム138♡ Firebase連携モジュール
 *
 * FirebaseConfig は Firebase Console から取得して設定してください。
 */

const FirebaseSync = {
    db: null,
    isOnline: false,
    listeners: [],

    /**
     * Firebase初期化
     */
    init(firebaseConfig) {
        try {
            // Firebase App 初期化
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            this.db = firebase.database();
            this.isOnline = true;
            console.log('Firebase接続成功');
            return true;
        } catch (e) {
            console.error('Firebase初期化エラー:', e);
            this.isOnline = false;
            return false;
        }
    },

    /**
     * データをFirebaseに保存
     */
    async saveData(data) {
        if (!this.db) return;
        try {
            await this.db.ref('teamData').set(data);
        } catch (e) {
            console.error('Firebase保存エラー:', e);
        }
    },

    /**
     * Firebaseからデータを読み込み
     */
    async loadData() {
        if (!this.db) return null;
        try {
            const snapshot = await this.db.ref('teamData').once('value');
            return snapshot.val();
        } catch (e) {
            console.error('Firebase読み込みエラー:', e);
            return null;
        }
    },

    /**
     * リアルタイム同期のリスナーを設定
     */
    onDataChange(callback) {
        if (!this.db) return;
        const ref = this.db.ref('teamData');
        ref.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                callback(data);
            }
        });
        this.listeners.push({ ref, event: 'value' });
    },

    /**
     * リスナーを解除
     */
    removeListeners() {
        this.listeners.forEach(({ ref, event }) => {
            ref.off(event);
        });
        this.listeners = [];
    }
};
