/**
 * カレンダー生成・タスク連動コンポーネント
 */
class CalendarView {
  constructor(containerId, onDateSelected) {
    this.container = document.getElementById(containerId);
    this.onDateSelected = onDateSelected;
    this.currentDate = new Date();
    this.selectedDate = new Date();
    this.tasks = [];
  }

  setTasks(tasks) {
    this.tasks = tasks;
    this.render();
  }

  prevMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.render();
  }

  nextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.render();
  }

  render() {
    if (!this.container) return;

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const prevLastDay = new Date(year, month, 0).getDate();

    const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
    const weekDays = ["日", "月", "火", "水", "木", "金", "土"];

    let html = `
      <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-4">
        <!-- カレンダーヘッダー -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <button id="cal-prev" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div class="font-bold text-slate-800 dark:text-white text-base">
            ${year}年 ${monthNames[month]}
          </div>
          <button id="cal-next" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>

        <!-- 曜日ヘッダー -->
        <div class="grid grid-cols-7 text-center py-2 bg-slate-50 dark:bg-slate-850 border-b border-slate-100 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400">
          ${weekDays.map((d, i) => `<div class="${i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : ''}">${d}</div>`).join('')}
        </div>

        <!-- カレンダーグリッド -->
        <div class="grid grid-cols-7 text-center divide-x divide-y divide-slate-100 dark:divide-slate-700/50">
    `;

    // 前月の日付埋め
    for (let x = firstDayIndex; x > 0; x--) {
      const dayNum = prevLastDay - x + 1;
      html += `<div class="min-h-[58px] p-1 text-slate-300 dark:text-slate-600 text-xs">${dayNum}</div>`;
    }

    const today = new Date();
    const isThisMonth = today.getFullYear() === year && today.getMonth() === month;

    // 当月の日付
    for (let i = 1; i <= lastDay; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isToday = isThisMonth && today.getDate() === i;
      const isSelected = this.selectedDate && 
        this.selectedDate.getFullYear() === year && 
        this.selectedDate.getMonth() === month && 
        this.selectedDate.getDate() === i;

      // この日のタスクを抽出
      const dayTasks = this.tasks.filter(t => {
        if (!t.due_date) return false;
        const d = new Date(t.due_date);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === i;
      });

      const hasOverdue = dayTasks.some(t => !t.is_completed && new Date(t.due_date) < today);
      const hasHigh = dayTasks.some(t => !t.is_completed && t.priority === 'high');

      html += `
        <div data-date="${dateStr}" class="cal-day-cell cursor-pointer min-h-[58px] p-1 transition-colors hover:bg-indigo-50/50 dark:hover:bg-slate-700/50 relative ${isSelected ? 'bg-indigo-50 dark:bg-slate-700/80 ring-2 ring-indigo-500 ring-inset rounded-sm' : ''}">
          <div class="flex items-center justify-center">
            <span class="w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold ${isToday ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-700 dark:text-slate-200'}">
              ${i}
            </span>
          </div>

          <!-- タスクドット / カウント -->
          <div class="flex flex-wrap items-center justify-center gap-1 mt-1">
            ${dayTasks.slice(0, 3).map(t => {
              let dotColor = t.is_completed ? 'bg-slate-400 dark:bg-slate-500' :
                             t.priority === 'high' ? 'bg-rose-500 ring-1 ring-rose-300' :
                             t.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500';
              return `<span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>`;
            }).join('')}
            ${dayTasks.length > 3 ? `<span class="text-[9px] font-bold text-slate-400">+${dayTasks.length - 3}</span>` : ''}
          </div>
        </div>
      `;
    }

    // 次月の日付埋め
    const totalCells = firstDayIndex + lastDay;
    const nextDays = (7 - (totalCells % 7)) % 7;
    for (let j = 1; j <= nextDays; j++) {
      html += `<div class="min-h-[58px] p-1 text-slate-300 dark:text-slate-600 text-xs">${j}</div>`;
    }

    html += `
        </div>
      </div>
    `;

    this.container.innerHTML = html;

    // イベントリスナーの登録
    document.getElementById("cal-prev")?.addEventListener("click", () => this.prevMonth());
    document.getElementById("cal-next")?.addEventListener("click", () => this.nextMonth());

    this.container.querySelectorAll(".cal-day-cell").forEach(cell => {
      cell.addEventListener("click", (e) => {
        const dateStr = cell.getAttribute("data-date");
        if (dateStr) {
          const [y, m, d] = dateStr.split("-").map(Number);
          this.selectedDate = new Date(y, m - 1, d);
          this.render();
          if (this.onDateSelected) {
            this.onDateSelected(this.selectedDate, this.getDayTasks(this.selectedDate));
          }
        }
      });
    });
  }

  getDayTasks(date) {
    if (!date) return [];
    const y = date.getFullYear();
    const m = date.getMonth();
    const d = date.getDate();
    return this.tasks.filter(t => {
      if (!t.due_date) return false;
      const td = new Date(t.due_date);
      return td.getFullYear() === y && td.getMonth() === m && td.getDate() === d;
    });
  }
}

window.CalendarView = CalendarView;
