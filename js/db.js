/**
 * Supabase データベース操作モジュール
 */
class DBService {
  constructor() {
    this.client = null;
    this.CONFIG_ROW_ID = "00000000-0000-0000-0000-000000000001";
    this.initClient();
  }

  /**
   * Supabaseクライアントの初期化
   */
  initClient() {
    const savedUrl = localStorage.getItem("supabase_url") || window.APP_CONFIG.SUPABASE_URL;
    const savedKey = localStorage.getItem("supabase_anon_key") || window.APP_CONFIG.SUPABASE_ANON_KEY;

    if (savedUrl && savedKey && window.supabase) {
      try {
        this.client = window.supabase.createClient(savedUrl, savedKey);
        return true;
      } catch (e) {
        console.error("Supabase初期化エラー:", e);
        this.client = null;
        return false;
      }
    }
    this.client = null;
    return false;
  }

  isConfigured() {
    return this.client !== null;
  }

  /**
   * システム設定（メンバー、カテゴリー、パスワード等）の取得
   * 全端末（他の携帯など）で設定を同期するための処理
   */
  async getAppSettings() {
    if (!this.isConfigured()) {
      return this.getLocalMockSettings();
    }

    try {
      // 1. app_settings テーブルからの取得を試みる
      try {
        const { data, error } = await this.client
          .from("app_settings")
          .select("value")
          .eq("key", "global_config")
          .maybeSingle();

        if (!error && data && data.value) {
          return { success: true, data: data.value };
        }
      } catch (e) {
        // app_settings テーブルが存在しない場合はフォールバックへ進む
      }

      // 2. tasks テーブル上のシステム設定レコードからの取得（フォールバック）
      const { data, error } = await this.client
        .from("tasks")
        .select("description")
        .eq("id", this.CONFIG_ROW_ID)
        .maybeSingle();

      if (!error && data && data.description) {
        const parsed = JSON.parse(data.description);
        return { success: true, data: parsed };
      }

      // Supabase上にもまだ設定がない場合はローカルキャッシュまたはデフォルトを返す
      return this.getLocalMockSettings();
    } catch (error) {
      console.warn("設定取得フォールバック実行:", error);
      return this.getLocalMockSettings();
    }
  }

  /**
   * システム設定の保存（SupabaseへUPSERTして全端末同期）
   */
  async saveAppSettings(settings) {
    // ローカルにも即時保存
    localStorage.setItem("app_system_settings", JSON.stringify(settings));

    if (!this.isConfigured()) {
      return { success: true, data: settings, isLocalMock: true };
    }

    let saved = false;

    // 1. app_settings テーブルへの保存を試みる
    try {
      const { error } = await this.client
        .from("app_settings")
        .upsert({
          key: "global_config",
          value: settings,
          updated_at: new Date().toISOString()
        });

      if (!error) {
        saved = true;
      }
    } catch (e) {
      // テーブルがない場合は次へ
    }

    // 2. tasks テーブルの設定レコードへUPSERT（確実に全携帯で同期可能にするフォールバック）
    try {
      const { error } = await this.client
        .from("tasks")
        .upsert({
          id: this.CONFIG_ROW_ID,
          title: "__SYSTEM_CONFIG__",
          description: JSON.stringify(settings),
          assignee: "システム",
          scope: "all",
          priority: "low",
          category: "システム",
          is_completed: true,
          due_date: null
        });

      if (!error) {
        saved = true;
      }
    } catch (e) {
      console.error("設定のSupabase保存エラー:", e);
    }

    return { success: saved, data: settings };
  }

  /**
   * タスク一覧の取得（システム設定レコードは除外）
   */
  async getTasks() {
    if (!this.isConfigured()) {
      return this.getLocalMockTasks();
    }

    try {
      const { data, error } = await this.client
        .from("tasks")
        .select("*")
        .neq("id", this.CONFIG_ROW_ID)
        .neq("title", "__SYSTEM_CONFIG__")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error("タスク取得エラー:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * タスクの作成
   */
  async createTask(task) {
    if (!this.isConfigured()) {
      return this.createLocalMockTask(task);
    }

    try {
      const { data, error } = await this.client
        .from("tasks")
        .insert([task])
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      console.error("タスク作成エラー:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * タスクの更新
   */
  async updateTask(id, updates) {
    if (!this.isConfigured()) {
      return this.updateLocalMockTask(id, updates);
    }

    try {
      const { data, error } = await this.client
        .from("tasks")
        .update(updates)
        .eq("id", id)
        .select();

      if (error) throw error;
      return { success: true, data: data[0] };
    } catch (error) {
      console.error("タスク更新エラー:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * タスクの削除
   */
  async deleteTask(id) {
    if (!this.isConfigured()) {
      return this.deleteLocalMockTask(id);
    }

    try {
      const { error } = await this.client
        .from("tasks")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error("タスク削除エラー:", error);
      return { success: false, error: error.message };
    }
  }

  /* -------------------------------------------------------------
     ローカルモック・設定キャッシュ
  ------------------------------------------------------------- */
  getLocalMockSettings() {
    const cached = localStorage.getItem("app_system_settings");
    if (cached) {
      try {
        return { success: true, data: JSON.parse(cached), isLocalMock: true };
      } catch (e) {}
    }

    // デフォルト値
    const defaultSettings = {
      adminPassword: window.APP_CONFIG.DEFAULT_ADMIN_PASS,
      members: window.APP_CONFIG.DEFAULT_MEMBERS,
      categories: window.APP_CONFIG.DEFAULT_CATEGORIES
    };
    return { success: true, data: defaultSettings, isLocalMock: true };
  }

  getLocalMockTasks() {
    let mock = JSON.parse(localStorage.getItem("mock_tasks") || "null");
    if (!mock) {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      mock = [
        {
          id: "1-sample",
          title: "チーム定例ミーティングの資料準備",
          description: "進捗報告用のスライドを3枚程度でまとめる",
          due_date: now.toISOString(),
          assignee: "全員",
          scope: "all",
          priority: "high",
          category: "会議",
          is_completed: false,
          created_at: now.toISOString()
        },
        {
          id: "2-sample",
          title: "今週のタスク洗い出し",
          description: "個人タスクと全員共有タスクの整理",
          due_date: tomorrow.toISOString(),
          assignee: "メンバーA",
          scope: "personal",
          priority: "medium",
          category: "業務",
          is_completed: false,
          created_at: now.toISOString()
        },
        {
          id: "3-sample",
          title: "前週の議事録共有",
          description: "Slackおよびメールで議事録を送付済",
          due_date: yesterday.toISOString(),
          assignee: "メンバーC",
          scope: "all",
          priority: "medium",
          category: "業務",
          is_completed: true,
          created_at: yesterday.toISOString()
        }
      ];
      localStorage.setItem("mock_tasks", JSON.stringify(mock));
    }
    return { success: true, data: mock, isLocalMock: true };
  }

  createLocalMockTask(task) {
    const res = this.getLocalMockTasks();
    const tasks = res.data;
    const newTask = {
      ...task,
      id: "mock-" + Date.now(),
      created_at: new Date().toISOString()
    };
    tasks.push(newTask);
    localStorage.setItem("mock_tasks", JSON.stringify(tasks));
    return { success: true, data: newTask, isLocalMock: true };
  }

  updateLocalMockTask(id, updates) {
    const res = this.getLocalMockTasks();
    let tasks = res.data;
    let updated = null;
    tasks = tasks.map(t => {
      if (t.id === id) {
        updated = { ...t, ...updates };
        return updated;
      }
      return t;
    });
    localStorage.setItem("mock_tasks", JSON.stringify(tasks));
    return { success: true, data: updated, isLocalMock: true };
  }

  deleteLocalMockTask(id) {
    const res = this.getLocalMockTasks();
    const tasks = res.data.filter(t => t.id !== id);
    localStorage.setItem("mock_tasks", JSON.stringify(tasks));
    return { success: true, isLocalMock: true };
  }
}

window.dbService = new DBService();
