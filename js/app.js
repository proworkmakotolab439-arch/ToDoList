/**
 * メインアプリケーション制御スクリプト
 */
document.addEventListener("DOMContentLoaded", () => {
  // アプリケーション状態
  const state = {
    isAuthenticated: false,
    currentUser: "全員",
    currentUserRole: "member", // 'admin' | 'member'
    systemSettings: {
      adminPassword: window.APP_CONFIG.DEFAULT_ADMIN_PASS,
      members: window.APP_CONFIG.DEFAULT_MEMBERS,
      categories: window.APP_CONFIG.DEFAULT_CATEGORIES
    },
    currentScopeTab: "all", // 'all' (全員タスク) | 'personal' (個人タスク)
    currentView: "list",    // 'list' | 'calendar'
    filterCategory: "all",
    filterStatus: "incomplete", // 'all' | 'incomplete' | 'past' | 'completed'
    sortBy: "due_date_asc",
    tasks: [],
    editingTaskId: null,
    selectedCalendarDate: new Date()
  };

  // DOM要素キャッシュ
  const dom = {
    appContainer: document.getElementById("app-container"),
    
    // ヘッダー要素
    headerUserBadge: document.getElementById("header-user-badge"),
    headerUserIcon: document.getElementById("header-user-icon"),
    headerUserName: document.getElementById("header-user-name"),
    userSelect: document.getElementById("user-select"),
    changePasswordBtn: document.getElementById("change-password-btn"),
    settingsBtn: document.getElementById("settings-btn"),
    headerLogoutBtn: document.getElementById("header-logout-btn"),

    // タブ & ビュー切替
    tabAll: document.getElementById("tab-all"),
    tabPersonal: document.getElementById("tab-personal"),
    viewListBtn: document.getElementById("view-list-btn"),
    viewCalBtn: document.getElementById("view-cal-btn"),

    // ログインモーダル
    passcodeModal: document.getElementById("passcode-modal"),
    loginUserSelect: document.getElementById("login-user-select"),
    passcodeInput: document.getElementById("passcode-input"),
    passcodeSubmitBtn: document.getElementById("passcode-submit-btn"),
    passcodeError: document.getElementById("passcode-error"),
    togglePasswordVisibility: document.getElementById("toggle-password-visibility"),
    eyeIcon: document.getElementById("eye-icon"),

    // パスワード変更モーダル（個人用）
    userPasswordModal: document.getElementById("user-password-modal"),
    changePwUsername: document.getElementById("change-pw-username"),
    newPersonalPassInput: document.getElementById("new-personal-pass-input"),
    savePersonalPassBtn: document.getElementById("save-personal-pass-btn"),
    closePasswordModalBtn: document.getElementById("close-password-modal-btn"),

    // 管理者設定モーダル
    settingsModal: document.getElementById("settings-modal"),
    adminPasscodeInput: document.getElementById("admin-passcode-input"),
    membersListContainer: document.getElementById("members-list-container"),
    newMemberInput: document.getElementById("new-member-input"),
    newMemberPassInput: document.getElementById("new-member-pass-input"),
    addMemberBtn: document.getElementById("add-member-btn"),
    memberCountLabel: document.getElementById("member-count-label"),
    categoriesListContainer: document.getElementById("categories-list-container"),
    newCategoryInput: document.getElementById("new-category-input"),
    addCategoryBtn: document.getElementById("add-category-btn"),
    categoryCountLabel: document.getElementById("category-count-label"),
    saveSettingsBtn: document.getElementById("save-settings-btn"),
    logoutBtn: document.getElementById("logout-btn"),
    closeSettingsBtn: document.getElementById("close-settings-btn"),

    // タスク一覧・カレンダー
    listViewSection: document.getElementById("list-view-section"),
    calViewSection: document.getElementById("cal-view-section"),
    calendarContainer: document.getElementById("calendar-container"),
    calDayTasksList: document.getElementById("cal-day-tasks-list"),
    calSelectedDateLabel: document.getElementById("cal-selected-date-label"),
    taskListTitleLabel: document.getElementById("task-list-title-label"),

    categoryFilter: document.getElementById("category-filter"),
    statusFilter: document.getElementById("status-filter"),
    sortFilter: document.getElementById("sort-filter"),
    taskListContainer: document.getElementById("task-list"),
    taskCountBadge: document.getElementById("task-count-badge"),
    loadingBar: document.getElementById("loading-bar"),

    // タスク登録・編集モーダル
    fabBtn: document.getElementById("fab-add-task"),
    taskModal: document.getElementById("task-modal"),
    taskModalTitle: document.getElementById("task-modal-title"),
    taskForm: document.getElementById("task-form"),
    closeTaskModalBtn: document.getElementById("close-task-modal"),
    saveTaskBtn: document.getElementById("save-task-btn"),
    deleteTaskBtn: document.getElementById("delete-task-btn"),

    taskTitleInput: document.getElementById("task-title"),
    taskDescInput: document.getElementById("task-desc"),
    taskDueDateInput: document.getElementById("task-due-date"),
    taskAssigneeSelect: document.getElementById("task-assignee"),
    taskScopeSelect: document.getElementById("task-scope"),
    taskPrioritySelect: document.getElementById("task-priority"),
    taskCategorySelect: document.getElementById("task-category"),

    // 確認ダイアログ
    confirmDialog: document.getElementById("confirm-dialog"),
    confirmMessage: document.getElementById("confirm-message"),
    confirmCancelBtn: document.getElementById("confirm-cancel-btn"),
    confirmOkBtn: document.getElementById("confirm-ok-btn")
  };

  // カレンダーインスタンス
  let calendarInstance = null;

  /* ==========================================================================
     初期化処理
     ========================================================================== */
  async function init() {
    setupEventListeners();

    calendarInstance = new CalendarView("calendar-container", (selectedDate, dayTasks) => {
      state.selectedCalendarDate = selectedDate;
      renderCalendarSelectedTasks(selectedDate, dayTasks);
    });

    // 1. Supabase/ローカルキャッシュからクラウド設定を同期読み込み（他携帯の変更を反映）
    await syncAppSettings();

    // 2. 認証状態チェック
    checkAuth();

    if (state.isAuthenticated) {
      loadTasks();
    }
  }

  /**
   * クラウド（Supabase）から最新の設定（メンバー、パスワード、カテゴリ）を取得
   * 他の端末で行われた設定変更を即時反映する
   */
  async function syncAppSettings() {
    try {
      showLoading(true);
      const res = await window.dbService.getAppSettings();
      showLoading(false);

      if (res && res.success && res.data) {
        state.systemSettings = {
          adminPassword: res.data.adminPassword || window.APP_CONFIG.DEFAULT_ADMIN_PASS,
          members: Array.isArray(res.data.members) ? res.data.members : window.APP_CONFIG.DEFAULT_MEMBERS,
          categories: Array.isArray(res.data.categories) ? res.data.categories : window.APP_CONFIG.DEFAULT_CATEGORIES
        };
      }
    } catch (e) {
      console.warn("設定同期エラー（ローカル設定を継続）:", e);
    }

    // UIのセレクトボックス類を更新
    populateLoginUserOptions();
    populateMemberOptions();
    populateCategoryOptions();
  }

  // ログイン画面のユーザー選択肢を生成
  function populateLoginUserOptions() {
    const members = state.systemSettings.members || [];
    let html = `<option value="admin">👑 管理者 (admin)</option>`;
    html += `<optgroup label="チームメンバー">`;
    members.forEach(m => {
      html += `<option value="${m.name}">👤 ${m.name}</option>`;
    });
    html += `</optgroup>`;
    dom.loginUserSelect.innerHTML = html;
  }

  // メンバーセレクトボックスの選択肢構築
  function populateMemberOptions() {
    const memberNames = (state.systemSettings.members || []).map(m => m.name);
    const allOptions = ["全員", ...memberNames];

    // 全員タスク表示時の担当絞り込み用セレクター
    dom.userSelect.innerHTML = allOptions.map(m => 
      `<option value="${m}">${m === '全員' ? '全員担当' : m}</option>`
    ).join("");

    // タスク登録フォームの担当者選択肢
    updateTaskAssigneeOptions();
  }

  // タスク登録フォームの担当者選択肢の更新（スコープに応じた制御）
  function updateTaskAssigneeOptions() {
    const memberNames = (state.systemSettings.members || []).map(m => m.name);
    const scope = dom.taskScopeSelect.value;

    if (scope === "personal") {
      // 個人タスクの場合: ログイン中ユーザー自身に固定
      if (state.currentUserRole === "admin") {
        dom.taskAssigneeSelect.innerHTML = `<option value="admin">admin (管理者)</option>`;
      } else {
        dom.taskAssigneeSelect.innerHTML = `<option value="${state.currentUser}">${state.currentUser}</option>`;
      }
      dom.taskAssigneeSelect.disabled = true;
    } else {
      // 全員共有タスクの場合: 「全員」または各メンバーを選択可能
      dom.taskAssigneeSelect.disabled = false;
      const opts = ["全員", ...memberNames];
      if (!opts.includes("admin") && state.currentUserRole === "admin") {
        opts.push("admin");
      }
      dom.taskAssigneeSelect.innerHTML = opts.map(m => `<option value="${m}">${m}</option>`).join("");
      
      // デフォルト選択
      if (state.currentUser !== "admin" && opts.includes(state.currentUser)) {
        dom.taskAssigneeSelect.value = state.currentUser;
      } else {
        dom.taskAssigneeSelect.value = "全員";
      }
    }
  }

  // カテゴリセレクトボックスの選択肢構築
  function populateCategoryOptions() {
    const categories = state.systemSettings.categories || window.APP_CONFIG.DEFAULT_CATEGORIES;
    
    // フィルター用
    dom.categoryFilter.innerHTML = `<option value="all">すべてのカテゴリ</option>` + 
      categories.map(c => `<option value="${c}">${c}</option>`).join("");

    // タスク登録フォーム用
    dom.taskCategorySelect.innerHTML = categories.map(c => 
      `<option value="${c}">${c}</option>`
    ).join("");
  }

  /* ==========================================================================
     認証フロー（ユーザー＆パスワード）
     ========================================================================== */
  function checkAuth() {
    const isAuth = localStorage.getItem("app_authenticated");
    const savedUser = localStorage.getItem("current_user_name");
    const savedRole = localStorage.getItem("current_user_role");

    if (isAuth === "true" && savedUser) {
      state.isAuthenticated = true;
      state.currentUser = savedUser;
      state.currentUserRole = savedRole || (savedUser === "admin" ? "admin" : "member");
      dom.passcodeModal.classList.add("hidden");
      updateHeaderUserUI();
    } else {
      state.isAuthenticated = false;
      dom.passcodeModal.classList.remove("hidden");
      dom.passcodeInput.value = "";
      setTimeout(() => dom.passcodeInput.focus(), 150);
    }
  }

  // ログイン処理
  function handleLoginSubmit() {
    const selectedUser = dom.loginUserSelect.value;
    const inputPass = dom.passcodeInput.value.trim();

    if (!inputPass) {
      dom.passcodeError.textContent = "パスワードを入力してください";
      dom.passcodeError.classList.remove("hidden");
      return;
    }

    let isValid = false;
    let role = "member";

    if (selectedUser === "admin") {
      // 管理者ログイン
      const adminPass = state.systemSettings.adminPassword || window.APP_CONFIG.DEFAULT_ADMIN_PASS;
      if (inputPass === adminPass) {
        isValid = true;
        role = "admin";
      }
    } else {
      // 一般メンバーログイン
      const members = state.systemSettings.members || [];
      const member = members.find(m => m.name === selectedUser);
      const expectedPass = member ? (member.password || window.APP_CONFIG.DEFAULT_MEMBER_PASS) : window.APP_CONFIG.DEFAULT_MEMBER_PASS;
      if (inputPass === expectedPass) {
        isValid = true;
        role = "member";
      }
    }

    if (isValid) {
      state.isAuthenticated = true;
      state.currentUser = selectedUser;
      state.currentUserRole = role;

      localStorage.setItem("app_authenticated", "true");
      localStorage.setItem("current_user_name", selectedUser);
      localStorage.setItem("current_user_role", role);

      dom.passcodeModal.classList.add("hidden");
      dom.passcodeError.classList.add("hidden");
      dom.passcodeInput.value = "";

      updateHeaderUserUI();
      showToast(`${selectedUser === 'admin' ? '管理者' : selectedUser} としてログインしました`, "success");
      loadTasks();
    } else {
      dom.passcodeError.textContent = "パスワードが一致しません";
      dom.passcodeError.classList.remove("hidden");
      dom.passcodeInput.value = "";
      dom.passcodeInput.focus();
    }
  }

  // ヘッダーのユーザー情報と権限UIの更新
  function updateHeaderUserUI() {
    if (state.currentUserRole === "admin") {
      dom.headerUserIcon.textContent = "👑";
      dom.headerUserName.textContent = "管理者 (admin)";
      dom.settingsBtn.classList.remove("hidden");
      dom.changePasswordBtn.classList.add("hidden"); // adminは設定画面でPW変更可能
      dom.userSelect.classList.remove("hidden");
    } else {
      dom.headerUserIcon.textContent = "👤";
      dom.headerUserName.textContent = state.currentUser;
      dom.settingsBtn.classList.add("hidden"); // 一般ユーザーは設定画面非表示（編集不可）
      dom.changePasswordBtn.classList.remove("hidden"); // 個人PW変更ボタン表示
      dom.userSelect.classList.add("hidden");
    }

    // タブ表示の調整
    setScopeTab(state.currentScopeTab);
  }

  // ログアウト処理
  function handleLogout() {
    localStorage.removeItem("app_authenticated");
    localStorage.removeItem("current_user_name");
    localStorage.removeItem("current_user_role");
    state.isAuthenticated = false;
    state.currentUser = "全員";
    state.currentUserRole = "member";

    closeSettingsModal();
    closePasswordModal();
    closeTaskModal();

    dom.passcodeModal.classList.remove("hidden");
    dom.passcodeInput.value = "";
    dom.passcodeError.classList.add("hidden");
    populateLoginUserOptions();
    setTimeout(() => dom.passcodeInput.focus(), 150);

    showToast("ログアウトしました", "info");
  }

  /* ==========================================================================
     個人パスワード変更（一般ユーザー用）
     ========================================================================== */
  function openPasswordModal() {
    dom.changePwUsername.textContent = `${state.currentUser}`;
    dom.newPersonalPassInput.value = "";
    dom.userPasswordModal.classList.remove("hidden");
    setTimeout(() => dom.newPersonalPassInput.focus(), 100);
  }

  function closePasswordModal() {
    dom.userPasswordModal.classList.add("hidden");
  }

  async function handleSavePersonalPassword() {
    const newPass = dom.newPersonalPassInput.value.trim();
    if (newPass.length < 4) {
      showToast("パスワードは4文字以上で入力してください", "warning");
      return;
    }

    // メンバーリスト内の該当ユーザーのパスワードを更新
    const members = [...(state.systemSettings.members || [])];
    const index = members.findIndex(m => m.name === state.currentUser);
    if (index >= 0) {
      members[index].password = newPass;
    } else {
      members.push({ name: state.currentUser, password: newPass });
    }
    state.systemSettings.members = members;

    showLoading(true);
    const res = await window.dbService.saveAppSettings(state.systemSettings);
    showLoading(false);

    if (res.success) {
      closePasswordModal();
      showToast("パスワードを更新しました。次回から新しいパスワードでログインしてください。", "success");
    } else {
      showToast("クラウド保存に失敗しました。再試行してください。", "error");
    }
  }

  /* ==========================================================================
     データ読み込み・CRUD
     ========================================================================== */
  async function loadTasks() {
    showLoading(true);
    const res = await window.dbService.getTasks();
    showLoading(false);

    if (res.success) {
      state.tasks = res.data || [];
      renderTasks();
    } else {
      showToast("データの取得に失敗しました: " + res.error, "error");
    }
  }

  async function handleToggleComplete(id, currentStatus) {
    const newStatus = !currentStatus;
    // 楽観的UI更新
    state.tasks = state.tasks.map(t => t.id === id ? { ...t, is_completed: newStatus } : t);
    renderTasks();

    const res = await window.dbService.updateTask(id, { is_completed: newStatus });
    if (!res.success) {
      showToast("状態更新に失敗しました", "error");
      // ロールバック
      state.tasks = state.tasks.map(t => t.id === id ? { ...t, is_completed: currentStatus } : t);
      renderTasks();
    }
  }

  async function handleSaveTask(e) {
    e.preventDefault();
    const title = dom.taskTitleInput.value.trim();
    if (!title) {
      showToast("タスク名を入力してください", "warning");
      return;
    }

    const dueDateVal = dom.taskDueDateInput.value;
    const scope = dom.taskScopeSelect.value;
    
    // 個人タスクの場合は担当者を自分に固定
    let assignee = dom.taskAssigneeSelect.value;
    if (scope === "personal") {
      assignee = state.currentUser;
    }

    const taskData = {
      title,
      description: dom.taskDescInput.value.trim(),
      due_date: dueDateVal ? new Date(dueDateVal).toISOString() : null,
      assignee: assignee,
      scope: scope,
      priority: dom.taskPrioritySelect.value,
      category: dom.taskCategorySelect.value
    };

    setModalLoading(true);
    if (state.editingTaskId) {
      // 更新
      const res = await window.dbService.updateTask(state.editingTaskId, taskData);
      setModalLoading(false);
      if (res.success) {
        showToast("タスクを更新しました", "success");
        closeTaskModal();
        loadTasks();
      } else {
        showToast("更新に失敗しました: " + res.error, "error");
      }
    } else {
      // 新規作成
      taskData.is_completed = false;
      const res = await window.dbService.createTask(taskData);
      setModalLoading(false);
      if (res.success) {
        showToast("タスクを追加しました", "success");
        closeTaskModal();

        // 個人タスクとして登録された場合、個人タスクタブへ自動切り替え
        if (taskData.scope === "personal") {
          setScopeTab("personal");
        }

        loadTasks();
      } else {
        showToast("追加に失敗しました: " + res.error, "error");
      }
    }
  }

  function confirmDelete(id) {
    showConfirmDialog("このタスクを削除しますか？この操作は取り消せません。", async () => {
      showLoading(true);
      const res = await window.dbService.deleteTask(id);
      showLoading(false);
      if (res.success) {
        showToast("タスクを削除しました", "success");
        closeTaskModal();
        loadTasks();
      } else {
        showToast("削除に失敗しました: " + res.error, "error");
      }
    });
  }

  // タブ切り替え制御関数
  function setScopeTab(tabName) {
    state.currentScopeTab = tabName;
    if (tabName === "all") {
      dom.tabAll.className = "flex-1 py-2 text-xs font-bold text-center border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 transition-colors";
      dom.tabPersonal.className = "flex-1 py-2 text-xs font-medium text-center text-slate-500 hover:text-slate-700 dark:text-slate-400 transition-colors";
      dom.taskListTitleLabel.textContent = "全員共有タスク一覧";
    } else {
      dom.tabPersonal.className = "flex-1 py-2 text-xs font-bold text-center border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 transition-colors";
      dom.tabAll.className = "flex-1 py-2 text-xs font-medium text-center text-slate-500 hover:text-slate-700 dark:text-slate-400 transition-colors";
      dom.taskListTitleLabel.textContent = `${state.currentUser} さんの個人タスク`;
    }
    renderTasks();
  }

  /* ==========================================================================
     フィルタリング & レンダリング（個人タスクの保護）
     ========================================================================== */
  function getFilteredTasks() {
    const now = new Date();

    return state.tasks.filter(t => {
      // 1. スコープとプライバシー制御
      if (state.currentScopeTab === "personal") {
        if (t.scope !== "personal") return false;
        
        // ★重要: 個人タスクはログイン中の本人のものしか見せない
        if (t.assignee !== state.currentUser) {
          return false;
        }
      } else {
        // 全員タスクタブ
        if (t.scope !== "all") return false;

        // 全員タスクタブ内の担当者絞り込み（adminのみ表示されるドロップダウン選択時）
        if (state.currentUserRole === "admin") {
          const filterAssignee = dom.userSelect.value;
          if (filterAssignee && filterAssignee !== "全員" && t.assignee !== "全員" && t.assignee !== filterAssignee) {
            return false;
          }
        }
      }

      // 2. カテゴリフィルター
      if (state.filterCategory !== "all" && t.category !== state.filterCategory) {
        return false;
      }

      // 3. 状態フィルター（未完了 / すべて / 過去のタスク / 完了済み）
      if (state.filterStatus === "incomplete") {
        if (t.is_completed) return false;
      } else if (state.filterStatus === "completed") {
        if (!t.is_completed) return false;
      } else if (state.filterStatus === "past") {
        const isPastDue = t.due_date && new Date(t.due_date) < now;
        if (!isPastDue && !t.is_completed) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (state.sortBy === "due_date_asc") {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date) - new Date(b.due_date);
      } else if (state.sortBy === "due_date_desc") {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(b.due_date) - new Date(a.due_date);
      } else if (state.sortBy === "priority") {
        const pOrder = { high: 1, medium: 2, low: 3 };
        return (pOrder[a.priority] || 4) - (pOrder[b.priority] || 4);
      }
      return 0;
    });
  }

  function renderTasks() {
    const filtered = getFilteredTasks();
    dom.taskCountBadge.textContent = `${filtered.length}件`;

    // カレンダービュー更新（表示中のタスクのみをカレンダーに渡すことでプライバシー維持）
    if (calendarInstance) {
      calendarInstance.setTasks(filtered);
      const dayTasks = calendarInstance.getDayTasks(state.selectedCalendarDate);
      renderCalendarSelectedTasks(state.selectedCalendarDate, dayTasks);
    }

    // リストビュー描画
    if (filtered.length === 0) {
      dom.taskListContainer.innerHTML = `
        <div class="text-center py-12 px-4">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <p class="text-slate-500 dark:text-slate-400 text-sm font-medium">該当するタスクはありません</p>
          <p class="text-slate-400 dark:text-slate-500 text-xs mt-1">右下の「＋」ボタンから追加してみましょう</p>
        </div>
      `;
      return;
    }

    dom.taskListContainer.innerHTML = filtered.map(t => createTaskCardHtml(t)).join("");
    setupTaskCardEvents();
  }

  function createTaskCardHtml(t) {
    const now = new Date();
    const dueDate = t.due_date ? new Date(t.due_date) : null;
    
    // 期限バッジ計算
    let dueBadgeHtml = '';
    if (dueDate) {
      const isOverdue = !t.is_completed && dueDate < now;
      const isToday = !t.is_completed && 
                      dueDate.getFullYear() === now.getFullYear() &&
                      dueDate.getMonth() === now.getMonth() &&
                      dueDate.getDate() === now.getDate();

      const timeStr = `${dueDate.getMonth() + 1}/${dueDate.getDate()} ${String(dueDate.getHours()).padStart(2, '0')}:${String(dueDate.getMinutes()).padStart(2, '0')}`;

      if (isOverdue) {
        dueBadgeHtml = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 animate-pulse">
          ⚠️ 超過 ${timeStr}
        </span>`;
      } else if (isToday) {
        dueBadgeHtml = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
          ⏳ 今日 ${timeStr}
        </span>`;
      } else {
        dueBadgeHtml = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300">
          📅 ${timeStr}
        </span>`;
      }
    }

    // 優先度バッジ
    const priorityMap = {
      high: { label: "高", class: "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800" },
      medium: { label: "中", class: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
      low: { label: "低", class: "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700" }
    };
    const pInfo = priorityMap[t.priority] || priorityMap.medium;

    return `
      <div class="task-card bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-500 transition-all cursor-pointer ${t.is_completed ? 'opacity-60 bg-slate-50 dark:bg-slate-850/60' : ''}" data-id="${t.id}">
        <div class="flex items-start gap-3">
          <!-- 完了チェックボタン -->
          <button type="button" class="toggle-complete-btn mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${t.is_completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500 text-transparent'}">
            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
          </button>

          <!-- メイン情報 -->
          <div class="flex-1 min-w-0 task-body">
            <div class="flex items-start justify-between gap-2">
              <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug break-words ${t.is_completed ? 'line-through text-slate-400 dark:text-slate-500' : ''}">
                ${escapeHtml(t.title)}
              </h3>
            </div>

            ${t.description ? `
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                ${escapeHtml(t.description)}
              </p>
            ` : ''}

            <!-- メタ情報バッジ郡 -->
            <div class="flex flex-wrap items-center gap-1.5 mt-2.5">
              ${dueBadgeHtml}
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${pInfo.class}">
                ${pInfo.label}
              </span>
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                🏷️ ${escapeHtml(t.category)}
              </span>
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${t.scope === 'personal' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}">
                ${t.scope === 'personal' ? '🔒 個人' : '👥 ' + escapeHtml(t.assignee)}
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function setupTaskCardEvents() {
    // 完了トグル
    dom.taskListContainer.querySelectorAll(".toggle-complete-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const card = btn.closest(".task-card");
        const id = card.getAttribute("data-id");
        const task = state.tasks.find(t => t.id === id);
        if (task) handleToggleComplete(id, task.is_completed);
      });
    });

    // 編集モーダル展開
    dom.taskListContainer.querySelectorAll(".edit-task-btn, .task-body").forEach(el => {
      el.addEventListener("click", (e) => {
        const card = el.closest(".task-card");
        const id = card.getAttribute("data-id");
        openTaskModal(id);
      });
    });
  }

  function renderCalendarSelectedTasks(date, dayTasks) {
    if (!dom.calSelectedDateLabel) return;
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    dom.calSelectedDateLabel.textContent = `${y}年${m}月${d}日のタスク (${dayTasks.length}件)`;

    if (dayTasks.length === 0) {
      dom.calDayTasksList.innerHTML = `<div class="text-xs text-slate-400 py-3 text-center">この日のタスクはありません</div>`;
      return;
    }

    dom.calDayTasksList.innerHTML = dayTasks.map(t => createTaskCardHtml(t)).join("");
    
    // カレンダー下部のタスクカードイベント
    dom.calDayTasksList.querySelectorAll(".toggle-complete-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const card = btn.closest(".task-card");
        const id = card.getAttribute("data-id");
        const task = state.tasks.find(t => t.id === id);
        if (task) handleToggleComplete(id, task.is_completed);
      });
    });

    dom.calDayTasksList.querySelectorAll(".edit-task-btn, .task-body").forEach(el => {
      el.addEventListener("click", (e) => {
        const card = el.closest(".task-card");
        const id = card.getAttribute("data-id");
        openTaskModal(id);
      });
    });
  }

  /* ==========================================================================
     タスク登録・編集モーダル操作
     ========================================================================= */
  function openTaskModal(taskId = null) {
    state.editingTaskId = taskId;
    updateTaskAssigneeOptions();

    if (taskId) {
      const task = state.tasks.find(t => t.id === taskId);
      if (!task) return;
      dom.taskModalTitle.textContent = "タスクの編集";
      dom.taskTitleInput.value = task.title;
      dom.taskDescInput.value = task.description || "";
      dom.taskDueDateInput.value = task.due_date ? formatDateTimeLocal(task.due_date) : "";
      dom.taskScopeSelect.value = task.scope || "all";
      updateTaskAssigneeOptions();
      dom.taskAssigneeSelect.value = task.assignee || (task.scope === "personal" ? state.currentUser : "全員");
      dom.taskPrioritySelect.value = task.priority || "medium";
      dom.taskCategorySelect.value = task.category || "業務";
      dom.deleteTaskBtn.classList.remove("hidden");
    } else {
      dom.taskModalTitle.textContent = "新しいタスク";
      dom.taskForm.reset();
      dom.taskScopeSelect.value = state.currentScopeTab;
      updateTaskAssigneeOptions();
      dom.taskPrioritySelect.value = "medium";
      dom.taskCategorySelect.value = "業務";
      dom.deleteTaskBtn.classList.add("hidden");
    }
    dom.taskModal.classList.remove("hidden");
    setTimeout(() => dom.taskTitleInput.focus(), 100);
  }

  function closeTaskModal() {
    dom.taskModal.classList.add("hidden");
    state.editingTaskId = null;
  }

  /* ==========================================================================
     管理者設定モーダル（Supabase同期機能）
     ========================================================================== */
  let editingMembers = [];
  let editingCategories = [];

  function openSettingsModal() {
    if (state.currentUserRole !== "admin") {
      showToast("管理者権限が必要です", "warning");
      return;
    }

    dom.adminPasscodeInput.value = state.systemSettings.adminPassword || window.APP_CONFIG.DEFAULT_ADMIN_PASS;
    
    // 現在のメンバー一覧・カテゴリー一覧をコピーして編集用配列へ
    editingMembers = (state.systemSettings.members || []).map(m => ({ ...m }));
    editingCategories = [...(state.systemSettings.categories || window.APP_CONFIG.DEFAULT_CATEGORIES)];

    renderEditingMembers();
    renderEditingCategories();

    dom.settingsModal.classList.remove("hidden");
  }

  // メンバー一覧描画（名前とパスワード）
  function renderEditingMembers() {
    dom.memberCountLabel.textContent = `${editingMembers.length}名`;
    dom.membersListContainer.innerHTML = "";

    if (editingMembers.length === 0) {
      dom.membersListContainer.innerHTML = `<p class="text-[11px] text-slate-400 py-1 text-center">メンバーが登録されていません</p>`;
      return;
    }

    editingMembers.forEach((member, index) => {
      const row = document.createElement("div");
      row.className = "flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80";

      // メンバー名入力フィールド
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = member.name;
      nameInput.placeholder = "名前";
      nameInput.maxLength = 20;
      nameInput.className = "flex-1 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500";
      nameInput.addEventListener("change", (e) => {
        const val = e.target.value.trim();
        if (!val) {
          showToast("メンバー名は空にできません", "warning");
          e.target.value = editingMembers[index].name;
          return;
        }
        if (val === "全員" || val === "admin") {
          showToast("「全員」「admin」は予約語のため使用できません", "warning");
          e.target.value = editingMembers[index].name;
          return;
        }
        editingMembers[index].name = val;
      });

      // パスワード入力フィールド
      const passInput = document.createElement("input");
      passInput.type = "text";
      passInput.value = member.password || window.APP_CONFIG.DEFAULT_MEMBER_PASS;
      passInput.placeholder = "PW";
      passInput.maxLength = 20;
      passInput.className = "w-20 px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500";
      passInput.title = `${member.name} さんのログインパスワード`;
      passInput.addEventListener("change", (e) => {
        const val = e.target.value.trim();
        if (val.length < 4) {
          showToast("パスワードは4文字以上で設定してください", "warning");
          e.target.value = editingMembers[index].password || window.APP_CONFIG.DEFAULT_MEMBER_PASS;
          return;
        }
        editingMembers[index].password = val;
      });

      // 削除ボタン
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors";
      delBtn.title = "メンバーを削除";
      delBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`;
      delBtn.addEventListener("click", () => {
        if (editingMembers.length <= 1) {
          showToast("メンバーは最低1名必要です", "warning");
          return;
        }
        editingMembers.splice(index, 1);
        renderEditingMembers();
      });

      row.appendChild(nameInput);
      row.appendChild(passInput);
      row.appendChild(delBtn);
      dom.membersListContainer.appendChild(row);
    });
  }

  // メンバー追加
  function handleAddMember() {
    const name = dom.newMemberInput.value.trim();
    const pass = dom.newMemberPassInput.value.trim() || window.APP_CONFIG.DEFAULT_MEMBER_PASS;

    if (!name) {
      showToast("メンバー名を入力してください", "warning");
      return;
    }
    if (name === "全員" || name === "admin") {
      showToast("「全員」「admin」は予約語のため追加できません", "warning");
      return;
    }
    if (editingMembers.some(m => m.name === name)) {
      showToast("同名のメンバーが既に存在します", "warning");
      return;
    }
    if (pass.length < 4) {
      showToast("パスワードは4文字以上で設定してください", "warning");
      return;
    }

    editingMembers.push({ name, password: pass });
    dom.newMemberInput.value = "";
    dom.newMemberPassInput.value = "";
    renderEditingMembers();
    dom.membersListContainer.scrollTop = dom.membersListContainer.scrollHeight;
  }

  // カテゴリー一覧描画
  function renderEditingCategories() {
    dom.categoryCountLabel.textContent = `${editingCategories.length}件`;
    dom.categoriesListContainer.innerHTML = "";

    if (editingCategories.length === 0) {
      dom.categoriesListContainer.innerHTML = `<p class="text-[11px] text-slate-400 py-1 text-center">カテゴリーが登録されていません</p>`;
      return;
    }

    editingCategories.forEach((cat, index) => {
      const row = document.createElement("div");
      row.className = "flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80";

      const input = document.createElement("input");
      input.type = "text";
      input.value = cat;
      input.maxLength = 20;
      input.className = "flex-1 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500";
      input.addEventListener("change", (e) => {
        const val = e.target.value.trim();
        if (!val) {
          showToast("カテゴリー名は空にできません", "warning");
          e.target.value = editingCategories[index];
          return;
        }
        editingCategories[index] = val;
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors";
      delBtn.title = "カテゴリーを削除";
      delBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`;
      delBtn.addEventListener("click", () => {
        if (editingCategories.length <= 1) {
          showToast("カテゴリーは最低1件必要です", "warning");
          return;
        }
        editingCategories.splice(index, 1);
        renderEditingCategories();
      });

      row.appendChild(input);
      row.appendChild(delBtn);
      dom.categoriesListContainer.appendChild(row);
    });
  }

  // カテゴリー追加
  function handleAddCategory() {
    const catName = dom.newCategoryInput.value.trim();
    if (!catName) {
      showToast("カテゴリー名を入力してください", "warning");
      return;
    }
    if (editingCategories.includes(catName)) {
      showToast("同名のカテゴリーが既に存在します", "warning");
      return;
    }

    editingCategories.push(catName);
    dom.newCategoryInput.value = "";
    renderEditingCategories();
    dom.categoriesListContainer.scrollTop = dom.categoriesListContainer.scrollHeight;
  }

  function closeSettingsModal() {
    dom.settingsModal.classList.add("hidden");
  }

  /**
   * 設定保存処理（Supabaseへアップロードして全携帯・全端末に即時同期）
   */
  async function handleSaveSettings() {
    const adminPass = dom.adminPasscodeInput.value.trim();

    if (adminPass.length < 4) {
      showToast("管理者パスワードは4文字以上で指定してください", "warning");
      return;
    }

    if (editingMembers.length === 0) {
      showToast("メンバーは最低1名登録してください", "warning");
      return;
    }

    if (editingCategories.length === 0) {
      showToast("カテゴリーは最低1件登録してください", "warning");
      return;
    }

    const newSettings = {
      adminPassword: adminPass,
      members: editingMembers,
      categories: editingCategories
    };

    showLoading(true);
    const res = await window.dbService.saveAppSettings(newSettings);
    showLoading(false);

    if (res.success) {
      state.systemSettings = newSettings;

      // 各種セレクトボックスの再構築
      populateLoginUserOptions();
      populateMemberOptions();
      populateCategoryOptions();

      closeSettingsModal();
      showToast("設定をクラウドに保存しました（全端末へ反映されます）", "success");
    } else {
      showToast("保存に失敗しました。再試行してください。", "error");
    }
  }

  /* ==========================================================================
     イベントリスナー登録
     ========================================================================== */
  function setupEventListeners() {
    // ログイン処理
    dom.passcodeSubmitBtn.addEventListener("click", handleLoginSubmit);
    dom.passcodeInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") handleLoginSubmit();
    });

    // パスワード表示/非表示トグル
    dom.togglePasswordVisibility.addEventListener("click", () => {
      if (dom.passcodeInput.type === "password") {
        dom.passcodeInput.type = "text";
        dom.eyeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/>`;
      } else {
        dom.passcodeInput.type = "password";
        dom.eyeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>`;
      }
    });

    // ヘッダーログアウトボタン（常時表示）
    dom.headerLogoutBtn.addEventListener("click", handleLogout);

    // 個人パスワード変更モーダル
    dom.changePasswordBtn.addEventListener("click", openPasswordModal);
    dom.closePasswordModalBtn.addEventListener("click", closePasswordModal);
    dom.savePersonalPassBtn.addEventListener("click", handleSavePersonalPassword);

    // 管理者設定モーダル
    dom.settingsBtn.addEventListener("click", openSettingsModal);
    dom.closeSettingsBtn.addEventListener("click", closeSettingsModal);
    dom.saveSettingsBtn.addEventListener("click", handleSaveSettings);
    dom.logoutBtn.addEventListener("click", handleLogout);

    // メンバー追加
    dom.addMemberBtn.addEventListener("click", handleAddMember);
    dom.newMemberInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddMember();
      }
    });

    // カテゴリー追加
    dom.addCategoryBtn.addEventListener("click", handleAddCategory);
    dom.newCategoryInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddCategory();
      }
    });

    // 全員タスク表示時の担当絞り込みセレクター
    dom.userSelect.addEventListener("change", () => {
      renderTasks();
    });

    // タブ切替（全員 / 個人）
    dom.tabAll.addEventListener("click", () => setScopeTab("all"));
    dom.tabPersonal.addEventListener("click", () => setScopeTab("personal"));

    // ビュー切替（リスト / カレンダー）
    dom.viewListBtn.addEventListener("click", () => {
      state.currentView = "list";
      dom.viewListBtn.className = "p-1.5 rounded-md bg-white dark:bg-slate-700 shadow-2xs text-indigo-600 dark:text-indigo-400";
      dom.viewCalBtn.className = "p-1.5 rounded-md text-slate-500 dark:text-slate-400";
      dom.listViewSection.classList.remove("hidden");
      dom.calViewSection.classList.add("hidden");
    });

    dom.viewCalBtn.addEventListener("click", () => {
      state.currentView = "calendar";
      dom.viewCalBtn.className = "p-1.5 rounded-md bg-white dark:bg-slate-700 shadow-2xs text-indigo-600 dark:text-indigo-400";
      dom.viewListBtn.className = "p-1.5 rounded-md text-slate-500 dark:text-slate-400";
      dom.listViewSection.classList.add("hidden");
      dom.calViewSection.classList.remove("hidden");
      if (calendarInstance) {
        calendarInstance.render();
      }
    });

    // 絞り込み & ソート
    dom.categoryFilter.addEventListener("change", (e) => {
      state.filterCategory = e.target.value;
      renderTasks();
    });

    dom.statusFilter.addEventListener("change", (e) => {
      state.filterStatus = e.target.value;
      renderTasks();
    });

    dom.sortFilter.addEventListener("change", (e) => {
      state.sortBy = e.target.value;
      renderTasks();
    });

    // タスク登録・編集
    dom.fabBtn.addEventListener("click", () => openTaskModal());
    dom.closeTaskModalBtn.addEventListener("click", closeTaskModal);
    dom.taskForm.addEventListener("submit", handleSaveTask);
    dom.deleteTaskBtn.addEventListener("click", () => {
      if (state.editingTaskId) confirmDelete(state.editingTaskId);
    });

    // 共有範囲切り替え時に担当者を連動
    dom.taskScopeSelect.addEventListener("change", () => {
      updateTaskAssigneeOptions();
    });

    // モーダル背景クリックで閉じる
    window.addEventListener("click", (e) => {
      if (e.target === dom.taskModal) closeTaskModal();
      if (e.target === dom.settingsModal) closeSettingsModal();
      if (e.target === dom.userPasswordModal) closePasswordModal();
    });

    // 確認ダイアログキャンセル
    dom.confirmCancelBtn.addEventListener("click", closeConfirmDialog);
  }

  /* ==========================================================================
     UIユーティリティ
     ========================================================================== */
  function showLoading(show) {
    if (show) {
      dom.loadingBar.classList.remove("hidden");
    } else {
      dom.loadingBar.classList.add("hidden");
    }
  }

  function setModalLoading(loading) {
    dom.saveTaskBtn.disabled = loading;
    if (loading) {
      dom.saveTaskBtn.textContent = "保存中...";
      dom.saveTaskBtn.classList.add("opacity-70");
    } else {
      dom.saveTaskBtn.textContent = "保存";
      dom.saveTaskBtn.classList.remove("opacity-70");
    }
  }

  let confirmCallback = null;
  function showConfirmDialog(message, onOk) {
    dom.confirmMessage.textContent = message;
    confirmCallback = onOk;
    dom.confirmDialog.classList.remove("hidden");
    dom.confirmOkBtn.onclick = () => {
      closeConfirmDialog();
      if (confirmCallback) confirmCallback();
    };
  }

  function closeConfirmDialog() {
    dom.confirmDialog.classList.add("hidden");
    confirmCallback = null;
  }

  function showToast(message, type = "info") {
    const existing = document.getElementById("toast-notification");
    if (existing) existing.remove();

    const colors = {
      success: "bg-emerald-600 text-white",
      error: "bg-rose-600 text-white",
      warning: "bg-amber-600 text-white",
      info: "bg-slate-800 text-white"
    };

    const toast = document.createElement("div");
    toast.id = "toast-notification";
    toast.className = `fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold z-50 transition-all duration-300 transform scale-95 opacity-0 ${colors[type] || colors.info}`;
    toast.textContent = message;

    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.remove("scale-95", "opacity-0");
      toast.classList.add("scale-100", "opacity-100");
    });

    setTimeout(() => {
      toast.classList.remove("scale-100", "opacity-100");
      toast.classList.add("scale-95", "opacity-0");
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  function formatDateTimeLocal(isoString) {
    const d = new Date(isoString);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // アプリ実行開始
  init();
});
