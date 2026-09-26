/**
 * メインアプリケーション制御スクリプト
 */
document.addEventListener("DOMContentLoaded", () => {
  // アプリケーション状態
  const state = {
    isAuthenticated: false,
    currentUser: localStorage.getItem("current_user") || "全員",
    currentScopeTab: "all", // 'all' (全員タスク) | 'personal' (個人タスク)
    currentView: "list",    // 'list' | 'calendar'
    filterCategory: "all",
    filterStatus: "incomplete", // 'all' | 'incomplete' | 'completed'
    sortBy: "due_date_asc",
    tasks: [],
    editingTaskId: null,
    selectedCalendarDate: new Date()
  };

  // DOM要素キャッシュ
  const dom = {
    appContainer: document.getElementById("app-container"),
    passcodeModal: document.getElementById("passcode-modal"),
    passcodeInput: document.getElementById("passcode-input"),
    passcodeSubmitBtn: document.getElementById("passcode-submit-btn"),
    passcodeError: document.getElementById("passcode-error"),

    settingsModal: document.getElementById("settings-modal"),
    settingsBtn: document.getElementById("settings-btn"),
    saveSettingsBtn: document.getElementById("save-settings-btn"),
    closeSettingsBtn: document.getElementById("close-settings-btn"),
    supabaseUrlInput: document.getElementById("supabase-url-input"),
    supabaseKeyInput: document.getElementById("supabase-key-input"),
    customPasscodeInput: document.getElementById("custom-passcode-input"),
    membersListContainer: document.getElementById("members-list-container"),
    newMemberInput: document.getElementById("new-member-input"),
    addMemberBtn: document.getElementById("add-member-btn"),
    memberCountLabel: document.getElementById("member-count-label"),

    userSelect: document.getElementById("user-select"),
    tabAll: document.getElementById("tab-all"),
    tabPersonal: document.getElementById("tab-personal"),
    viewListBtn: document.getElementById("view-list-btn"),
    viewCalBtn: document.getElementById("view-cal-btn"),

    listViewSection: document.getElementById("list-view-section"),
    calViewSection: document.getElementById("cal-view-section"),
    calendarContainer: document.getElementById("calendar-container"),
    calDayTasksList: document.getElementById("cal-day-tasks-list"),
    calSelectedDateLabel: document.getElementById("cal-selected-date-label"),

    categoryFilter: document.getElementById("category-filter"),
    statusFilter: document.getElementById("status-filter"),
    sortFilter: document.getElementById("sort-filter"),
    taskListContainer: document.getElementById("task-list"),
    taskCountBadge: document.getElementById("task-count-badge"),
    loadingBar: document.getElementById("loading-bar"),

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
  function init() {
    populateMemberOptions();
    populateCategoryOptions();
    checkAuth();
    setupEventListeners();

    calendarInstance = new CalendarView("calendar-container", (selectedDate, dayTasks) => {
      state.selectedCalendarDate = selectedDate;
      renderCalendarSelectedTasks(selectedDate, dayTasks);
    });

    if (state.isAuthenticated) {
      loadTasks();
    }
  }

  // メンバーリストの取得（LocalStorage優先、なければconfigのデフォルト）
  function getMemberList() {
    const saved = localStorage.getItem("custom_members");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error("メンバー設定のパースエラー:", e);
      }
    }
    // デフォルト（"全員"を除くメンバー一覧）
    return window.APP_CONFIG.MEMBERS.filter(m => m !== "全員");
  }

  // メンバーセレクトボックスの選択肢構築
  function populateMemberOptions() {
    const customMembers = getMemberList();
    const allMembers = ["全員", ...customMembers];
    
    // 現在選択中のユーザーが削除されていた場合は「全員」にフォールバック
    if (!allMembers.includes(state.currentUser)) {
      state.currentUser = "全員";
      localStorage.setItem("current_user", "全員");
    }

    // ヘッダー用
    dom.userSelect.innerHTML = allMembers.map(m => 
      `<option value="${m}" ${m === state.currentUser ? 'selected' : ''}>${m === '全員' ? '👤 表示: 全員' : '👤 ' + m}</option>`
    ).join("");

    // タスク登録フォーム用
    dom.taskAssigneeSelect.innerHTML = allMembers.map(m => 
      `<option value="${m}">${m}</option>`
    ).join("");
  }

  // カテゴリセレクトボックスの選択肢構築
  function populateCategoryOptions() {
    const categories = window.APP_CONFIG.CATEGORIES;
    
    // フィルター用
    dom.categoryFilter.innerHTML = `<option value="all">すべてのカテゴリ</option>` + 
      categories.map(c => `<option value="${c}">${c}</option>`).join("");

    // タスク登録フォーム用
    dom.taskCategorySelect.innerHTML = categories.map(c => 
      `<option value="${c}">${c}</option>`
    ).join("");
  }

  /* ==========================================================================
     認証（合言葉ゲート）
     ========================================================================== */
  function checkAuth() {
    const isAuth = localStorage.getItem("app_authenticated");
    if (isAuth === "true") {
      state.isAuthenticated = true;
      dom.passcodeModal.classList.add("hidden");
    } else {
      state.isAuthenticated = false;
      dom.passcodeModal.classList.remove("hidden");
      dom.passcodeInput.focus();
    }
  }

  function handlePasscodeSubmit() {
    const inputCode = dom.passcodeInput.value.trim();
    const correctCode = localStorage.getItem("custom_passcode") || window.APP_CONFIG.DEFAULT_PASSCODE;

    if (inputCode === correctCode) {
      localStorage.setItem("app_authenticated", "true");
      state.isAuthenticated = true;
      dom.passcodeModal.classList.add("hidden");
      dom.passcodeError.classList.add("hidden");
      loadTasks();
    } else {
      dom.passcodeError.classList.remove("hidden");
      dom.passcodeInput.value = "";
      dom.passcodeInput.focus();
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
    const taskData = {
      title,
      description: dom.taskDescInput.value.trim(),
      due_date: dueDateVal ? new Date(dueDateVal).toISOString() : null,
      assignee: dom.taskAssigneeSelect.value,
      scope: dom.taskScopeSelect.value,
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

        // 個人タスクとして登録された場合、該当タスクがすぐに見えるよう個人タスクタブへ自動切り替え
        if (taskData.scope === "personal") {
          state.currentScopeTab = "personal";
          dom.tabPersonal.className = "flex-1 py-2 text-xs font-bold text-center border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 transition-colors";
          dom.tabAll.className = "flex-1 py-2 text-xs font-medium text-center text-slate-500 hover:text-slate-700 dark:text-slate-400 transition-colors";
          
          // 表示ユーザーが「全員」でなく、担当者とも異なる場合は、登録したタスクの担当者に切り替え
          if (state.currentUser !== "全員" && state.currentUser !== taskData.assignee) {
            state.currentUser = taskData.assignee;
            dom.userSelect.value = taskData.assignee;
            localStorage.setItem("current_user", state.currentUser);
          }
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
    } else {
      dom.tabPersonal.className = "flex-1 py-2 text-xs font-bold text-center border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 transition-colors";
      dom.tabAll.className = "flex-1 py-2 text-xs font-medium text-center text-slate-500 hover:text-slate-700 dark:text-slate-400 transition-colors";
    }
    renderTasks();
  }

  /* ==========================================================================
     フィルタリング & レンダリング
     ========================================================================== */
  function getFilteredTasks() {
    const now = new Date();

    return state.tasks.filter(t => {
      // 1. スコープ（全員共有 / 個人）
      if (state.currentScopeTab === "personal") {
        if (t.scope !== "personal") return false;
        // 個人タスクタブ: 表示ユーザーが「全員」以外ならその人の個人タスクのみ。
        // 「全員」表示時は全メンバーの個人タスクを一覧表示。
        if (state.currentUser !== "全員" && t.assignee !== state.currentUser) {
          return false;
        }
      } else {
        // 全員タスクタブ
        if (t.scope !== "all") return false;

        // 全員タスクタブ内で担当者絞り込み（「全員」選択時はすべて表示）
        if (state.currentUser !== "全員" && t.assignee !== "全員" && t.assignee !== state.currentUser) {
          return false;
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
        // 過去のタスク: 期限切れの未完了タスク または 完了済みのタスク
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

    // カレンダービュー更新
    if (calendarInstance) {
      calendarInstance.setTasks(state.tasks);
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
      <div class="task-card group relative bg-white dark:bg-slate-800 border ${t.is_completed ? 'border-slate-200 dark:border-slate-800 opacity-60' : 'border-slate-200/90 dark:border-slate-700 shadow-sm'} rounded-xl p-3.5 transition-all duration-200 hover:shadow-md" data-id="${t.id}">
        <div class="flex items-start gap-3">
          <!-- 完了チェックボックス -->
          <button class="toggle-complete-btn mt-0.5 flex-shrink-0 w-6 h-6 rounded-full border-2 ${t.is_completed ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500'} flex items-center justify-center transition-colors">
            ${t.is_completed ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>' : ''}
          </button>

          <!-- タスク詳細部 -->
          <div class="flex-1 min-w-0 task-body cursor-pointer">
            <div class="flex items-center gap-1.5 flex-wrap mb-1">
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${pInfo.class}">
                ${pInfo.label}
              </span>
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                ${t.category}
              </span>
              ${dueBadgeHtml}
            </div>

            <h3 class="text-sm font-semibold text-slate-800 dark:text-white leading-snug break-words ${t.is_completed ? 'line-through text-slate-400 dark:text-slate-500' : ''}">
              ${escapeHtml(t.title)}
            </h3>

            ${t.description ? `
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                ${escapeHtml(t.description)}
              </p>
            ` : ''}

            <div class="flex items-center gap-3 mt-2 text-[11px] text-slate-400 dark:text-slate-500">
              <span class="inline-flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                ${escapeHtml(t.assignee)}
              </span>
              <span class="inline-flex items-center gap-1">
                ${t.scope === 'personal' ? '🔒 個人' : '🌐 全員'}
              </span>
            </div>
          </div>

          <!-- アクションメニュー（編集・削除） -->
          <div class="flex items-center gap-1 flex-shrink-0">
            <button class="edit-task-btn p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title="編集">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
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
     モーダル操作
     ========================================================================= */
  function openTaskModal(taskId = null) {
    state.editingTaskId = taskId;
    if (taskId) {
      const task = state.tasks.find(t => t.id === taskId);
      if (!task) return;
      dom.taskModalTitle.textContent = "タスクの編集";
      dom.taskTitleInput.value = task.title;
      dom.taskDescInput.value = task.description || "";
      dom.taskDueDateInput.value = task.due_date ? formatDateTimeLocal(task.due_date) : "";
      dom.taskAssigneeSelect.value = task.assignee || "全員";
      dom.taskScopeSelect.value = task.scope || "all";
      dom.taskPrioritySelect.value = task.priority || "medium";
      dom.taskCategorySelect.value = task.category || "業務";
      dom.deleteTaskBtn.classList.remove("hidden");
    } else {
      dom.taskModalTitle.textContent = "新しいタスク";
      dom.taskForm.reset();
      dom.taskScopeSelect.value = state.currentScopeTab;
      
      // 個人タスクタブで開いた場合は担当者を個別メンバーに設定（「全員」は不可）
      if (state.currentScopeTab === "personal") {
        if (state.currentUser !== "全員") {
          dom.taskAssigneeSelect.value = state.currentUser;
        } else {
          const members = getMemberList();
          dom.taskAssigneeSelect.value = members[0] || "全員";
        }
      } else {
        dom.taskAssigneeSelect.value = state.currentUser !== "全員" ? state.currentUser : "全員";
      }

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

  // 設定画面の編集中メンバー一覧
  let editingMembers = [];

  function openSettingsModal() {
    dom.supabaseUrlInput.value = localStorage.getItem("supabase_url") || window.APP_CONFIG.SUPABASE_URL;
    dom.supabaseKeyInput.value = localStorage.getItem("supabase_anon_key") || window.APP_CONFIG.SUPABASE_ANON_KEY;
    dom.customPasscodeInput.value = localStorage.getItem("custom_passcode") || window.APP_CONFIG.DEFAULT_PASSCODE;
    
    // 現在のメンバー一覧をコピーして描画
    editingMembers = [...getMemberList()];
    renderEditingMembers();

    dom.settingsModal.classList.remove("hidden");
  }

  // 設定モーダル内のメンバー一覧描画
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

      // メンバー名入力フィールド（名前変更用）
      const input = document.createElement("input");
      input.type = "text";
      input.value = member;
      input.maxLength = 20;
      input.className = "flex-1 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500";
      input.addEventListener("change", (e) => {
        const val = e.target.value.trim();
        if (!val) {
          showToast("メンバー名は空にできません", "warning");
          e.target.value = editingMembers[index];
          return;
        }
        if (val === "全員") {
          showToast("「全員」はシステム予約のため使用できません", "warning");
          e.target.value = editingMembers[index];
          return;
        }
        editingMembers[index] = val;
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

      row.appendChild(input);
      row.appendChild(delBtn);
      dom.membersListContainer.appendChild(row);
    });
  }

  // メンバー追加処理
  function handleAddMember() {
    const name = dom.newMemberInput.value.trim();
    if (!name) {
      showToast("メンバー名を入力してください", "warning");
      return;
    }
    if (name === "全員") {
      showToast("「全員」はシステム予約のため追加できません", "warning");
      return;
    }
    if (editingMembers.includes(name)) {
      showToast("すでに同名のメンバーが存在します", "warning");
      return;
    }

    editingMembers.push(name);
    dom.newMemberInput.value = "";
    renderEditingMembers();
    // 追加したアイテムが見えるようにスクロール
    dom.membersListContainer.scrollTop = dom.membersListContainer.scrollHeight;
  }

  function closeSettingsModal() {
    dom.settingsModal.classList.add("hidden");
  }

  function handleSaveSettings() {
    const url = dom.supabaseUrlInput.value.trim();
    const key = dom.supabaseKeyInput.value.trim();
    const passcode = dom.customPasscodeInput.value.trim();

    if (passcode.length < 4) {
      showToast("合言葉は4桁以上で指定してください", "warning");
      return;
    }

    // 入力中のメンバー名から空や重複を除去
    const cleanMembers = editingMembers
      .map(m => m.trim())
      .filter(m => m.length > 0 && m !== "全員");

    if (cleanMembers.length === 0) {
      showToast("メンバーは最低1名登録してください", "warning");
      return;
    }

    // 重複チェック
    const uniqueMembers = [...new Set(cleanMembers)];
    if (uniqueMembers.length !== cleanMembers.length) {
      showToast("メンバー名に重複があります", "warning");
      return;
    }

    // LocalStorage に保存
    localStorage.setItem("custom_members", JSON.stringify(uniqueMembers));

    if (url) localStorage.setItem("supabase_url", url);
    else localStorage.removeItem("supabase_url");

    if (key) localStorage.setItem("supabase_anon_key", key);
    else localStorage.removeItem("supabase_anon_key");

    localStorage.setItem("custom_passcode", passcode);

    // UIのメンバー選択肢を即時更新
    populateMemberOptions();

    window.dbService.initClient();
    closeSettingsModal();
    showToast("設定を保存しました", "success");
    setTimeout(() => {
      loadTasks();
    }, 300);
  }

  /* ==========================================================================
     イベントリスナー登録
     ========================================================================== */
  function setupEventListeners() {
    // パスコード
    dom.passcodeSubmitBtn.addEventListener("click", handlePasscodeSubmit);
    dom.passcodeInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") handlePasscodeSubmit();
    });

    // 設定モーダル
    dom.settingsBtn.addEventListener("click", openSettingsModal);
    dom.closeSettingsBtn.addEventListener("click", closeSettingsModal);
    dom.saveSettingsBtn.addEventListener("click", handleSaveSettings);
    dom.addMemberBtn.addEventListener("click", handleAddMember);
    dom.newMemberInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddMember();
      }
    });

    // ユーザー切替
    dom.userSelect.addEventListener("change", (e) => {
      state.currentUser = e.target.value;
      localStorage.setItem("current_user", state.currentUser);
      renderTasks();
    });

    // タブ切替（全員 / 個人）
    dom.tabAll.addEventListener("click", () => setScopeTab("all"));
    dom.tabPersonal.addEventListener("click", () => setScopeTab("personal"));

    // ビュー切替（リスト / カレンダー）
    dom.viewListBtn.addEventListener("click", () => {
      state.currentView = "list";
      dom.viewListBtn.className = "p-1.5 rounded-md bg-white dark:bg-slate-700 shadow-xs text-indigo-600 dark:text-indigo-400";
      dom.viewCalBtn.className = "p-1.5 rounded-md text-slate-500 dark:text-slate-400";
      dom.listViewSection.classList.remove("hidden");
      dom.calViewSection.classList.add("hidden");
    });

    dom.viewCalBtn.addEventListener("click", () => {
      state.currentView = "calendar";
      dom.viewCalBtn.className = "p-1.5 rounded-md bg-white dark:bg-slate-700 shadow-xs text-indigo-600 dark:text-indigo-400";
      dom.viewListBtn.className = "p-1.5 rounded-md text-slate-500 dark:text-slate-400";
      dom.listViewSection.classList.add("hidden");
      dom.calViewSection.classList.remove("hidden");
      if (calendarInstance) calendarInstance.render();
    });

    // フィルター
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

    // FAB / タスク作成モーダル
    dom.fabBtn.addEventListener("click", () => openTaskModal(null));
    dom.closeTaskModalBtn.addEventListener("click", closeTaskModal);
    dom.taskForm.addEventListener("submit", handleSaveTask);

    // 共有範囲切り替え時の担当者アシスト
    dom.taskScopeSelect.addEventListener("change", (e) => {
      if (e.target.value === "personal" && dom.taskAssigneeSelect.value === "全員") {
        if (state.currentUser !== "全員") {
          dom.taskAssigneeSelect.value = state.currentUser;
        } else {
          const members = getMemberList();
          dom.taskAssigneeSelect.value = members[0] || "全員";
        }
      }
    });

    dom.deleteTaskBtn.addEventListener("click", () => {
      if (state.editingTaskId) {
        confirmDelete(state.editingTaskId);
      }
    });

    // 確認ダイアログキャンセル
    dom.confirmCancelBtn.addEventListener("click", () => {
      dom.confirmDialog.classList.add("hidden");
    });
  }

  /* ==========================================================================
     ユーティリティ & UI補助
     ========================================================================== */
  function showLoading(isLoading) {
    if (isLoading) {
      dom.loadingBar.classList.remove("hidden");
    } else {
      dom.loadingBar.classList.add("hidden");
    }
  }

  function setModalLoading(isLoading) {
    dom.saveTaskBtn.disabled = isLoading;
    dom.saveTaskBtn.innerHTML = isLoading ? 
      `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> 保存中...` : 
      `保存`;
  }

  function showConfirmDialog(msg, onOk) {
    dom.confirmMessage.textContent = msg;
    dom.confirmDialog.classList.remove("hidden");
    const okHandler = () => {
      dom.confirmOkBtn.removeEventListener("click", okHandler);
      dom.confirmDialog.classList.add("hidden");
      onOk();
    };
    dom.confirmOkBtn.addEventListener("click", okHandler, { once: true });
  }

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    const bgColors = {
      success: "bg-emerald-600 text-white",
      error: "bg-rose-600 text-white",
      warning: "bg-amber-600 text-white",
      info: "bg-slate-800 text-white"
    };
    toast.className = `fixed top-5 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full shadow-lg text-xs font-medium transition-all duration-300 z-50 flex items-center gap-2 ${bgColors[type] || bgColors.info}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translate(-50%, -20px)";
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function formatDateTimeLocal(isoString) {
    const d = new Date(isoString);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m]));
  }

  // アプリケーション開始
  init();
});
