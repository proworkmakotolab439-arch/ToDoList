/**
 * Supabase データベース操作モジュール
 */
class DBService {
  constructor() {
    this.client = null;
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
   * タスク一覧の取得
   */
  async getTasks() {
    if (!this.isConfigured()) {
      // Supabase未設定の場合はLocalStorageのモックデータを利用
      return this.getLocalMockTasks();
    }

    try {
      const { data, error } = await this.client
        .from('tasks')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return { success: true, data };
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
        .from('tasks')
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
        .from('tasks')
        .update(updates)
        .eq('id', id)
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
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error("タスク削除エラー:", error);
      return { success: false, error: error.message };
    }
  }

  /* -------------------------------------------------------------
     ローカルモック用（Supabase未設定時でもUI動作確認できるようにする）
  ------------------------------------------------------------- */
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
