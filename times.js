// 全局变量
let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
let events = JSON.parse(localStorage.getItem('scheduleEvents')) || [];
let editingEventId = null;
let currentViewMode = localStorage.getItem('viewMode') || 'week'; // day, week, month, year
let selectedDate = new Date(); // 用户点击选中的日期
let viewStartDate = getViewStartDate(selectedDate, currentViewMode);
let currentAIMode = localStorage.getItem('aiMode') || 'balanced'; // fast, balanced, wise

// AI 回答模式 prompt
const AI_MODE_PROMPTS = {
    fast: '请直接输出最终结果，无需任何解释、推理过程、前言或总结。仅当输入信息缺失导致无法完成任务时，才用一句话说明缺什么。保持回复尽可能简短。现在处理：',
    balanced: '在回答前，请先在内部完成正向推导与反向验证。遵循以下输出规则：\n- 若自审确认无误：直接输出最终答案，不展示任何推理过程。\n- 若自审发现错误或不确定：先输出简短的修正说明（不超过3句话），再输出修正后的最终答案。\n- 始终确保事实准确、逻辑自洽，避免幻觉。\n现在处理：',
    wise: '你是严谨的AI推理引擎。在输出最终答案之前，你必须严格执行以下「四步自审机制」，并将完整思考过程原样展示在【推理过程】区块中，不得跳过或省略任何步骤：\n\n1. 【正向推理】：基于已知信息，逐步推导出初步结论，标明每一步的依据。\n2. 【逆向推理】：假设初步结论是错的，反推会出现什么矛盾或漏洞；再从结论倒推前提，验证逻辑链是否闭环。\n3. 【多维审阅】：核查事实准确性、数据一致性、潜在偏见、边界条件及可能的反例。\n4. 【最终裁决】：若发现问题，明确写出修正内容及理由；若确认无误，说明验证通过的依据。\n输出格式严格如下：\n【推理过程】\n（完整展示上述4个步骤的详细思考）\n【最终答案】\n（仅输出经过验证的、高可靠性的最终结果，不包含任何推理内容）\n现在处理：'
};

// 视图名称映射
const viewNames = {
    day: '日视图',
    week: '周视图',
    month: '月视图',
    year: '年视图'
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    renderCalendar();
    updateViewStartDate();
    renderGanttChart();
    setupEventListeners();
    loadSettings();
    loadBackgroundSettings();
    setupClockWeatherAlarm();
    initVoiceSearch();
    
    // 每分钟更新一次事件优先级
    setInterval(() => {
        renderGanttChart();
    }, 60000);
});

// 获取视图起始日期
function getViewStartDate(date, mode) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    
    switch (mode) {
        case 'day':
            return d;
        case 'week':
            return getWeekStart(d);
        case 'month':
            return new Date(d.getFullYear(), d.getMonth(), 1);
        case 'year':
            // 返回该年第一个周一
            const jan1 = new Date(d.getFullYear(), 0, 1);
            return getWeekStart(jan1);
        default:
            return getWeekStart(d);
    }
}

// 获取本周的周一日期
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// 更新视图起始日期
function updateViewStartDate() {
    viewStartDate = getViewStartDate(selectedDate, currentViewMode);
}

// 设置事件监听器
function setupEventListeners() {
    // 日历导航
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar();
    });
    
    document.getElementById('nextMonth').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar();
    });
    
    // 紧急度滑块实时显示数值和颜色预览
    document.getElementById('eventUrgency').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('urgencyValue').textContent = val;
        const color = urgencyToColor(val);
        document.getElementById('urgencyColorPreview').style.backgroundColor = color;
    });
    
    // 视图模式切换
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchViewMode(view);
        });
    });
    
    // 添加事件按钮
    document.getElementById('addEventBtn').addEventListener('click', () => {
        openEventModal();
    });
    
    // 导出 Excel 按钮
    document.getElementById('exportBtn').addEventListener('click', () => {
        exportToExcel();
    });
    
    // 导入 Excel 按钮
    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importFileInput').click();
    });
    
    // 文件选择后处理
    document.getElementById('importFileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            importFromExcel(file);
        }
        // 重置 input，允许重复导入同一文件
        e.target.value = '';
    });
    
    // 设置按钮
    document.getElementById('settingsBtn').addEventListener('click', () => {
        openSettingsModal();
    });
    
    // 事件表单提交
    document.getElementById('eventForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveEvent();
    });
    
    // 设置保存按钮
    document.getElementById('saveBgBtn').addEventListener('click', () => {
        saveBackgroundSettings();
    });
    
    // 保存按钮主题颜色
    document.getElementById('saveBtnColorBtn').addEventListener('click', () => {
        saveBtnColor();
    });
    
    // 取消按钮
    document.getElementById('cancelEventBtn').addEventListener('click', () => {
        closeEventModal();
    });
    
    document.getElementById('cancelSettingsBtn').addEventListener('click', () => {
        closeSettingsModal();
    });
    
    // 折叠面板点击
    document.querySelectorAll('.settings-section-header').forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.dataset.target;
            const body = document.getElementById(targetId);
            if (body) {
                header.classList.toggle('collapsed');
                body.classList.toggle('collapsed');
            }
        });
    });
    
    // 删除事件按钮
    document.getElementById('deleteEventBtn').addEventListener('click', () => {
        deleteEvent();
    });
    
    // 周期性事件复选框切换
    document.getElementById('eventRecurring').addEventListener('change', (e) => {
        const isRecurring = e.target.checked;
        document.getElementById('recurringOptions').style.display = isRecurring ? 'block' : 'none';
        document.getElementById('recurringTimeGroup').style.display = isRecurring ? 'block' : 'none';
        document.getElementById('normalTimeGroup').style.display = isRecurring ? 'none' : 'block';
        document.getElementById('normalTimeGroupEnd').style.display = isRecurring ? 'none' : 'block';
        // 更新必填属性
        document.getElementById('eventStart').required = !isRecurring;
        document.getElementById('eventEnd').required = !isRecurring;
        // 默认显示结束日期字段（custom模式需要）
        updateRecurringEndDateVisibility();
        
        // 设置开始日期默认为今天
        if (isRecurring && !document.getElementById('recurringStartDate').value) {
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            document.getElementById('recurringStartDate').value = todayStr;
        }
    });
    
    // 循环模式切换
    document.getElementById('recurringMode').addEventListener('change', updateRecurringEndDateVisibility);
    
    // 时段变化检测跨天
    document.getElementById('recurringStartTime').addEventListener('change', checkCrossDay);
    document.getElementById('recurringEndTime').addEventListener('change', checkCrossDay);
    
    // 关闭模态框
    document.querySelectorAll('.close').forEach(el => {
        el.addEventListener('click', () => {
            closeEventModal();
            closeSettingsModal();
        });
    });
    
    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
        const eventModal = document.getElementById('eventModal');
        const settingsModal = document.getElementById('settingsModal');
        if (e.target === eventModal) closeEventModal();
        if (e.target === settingsModal) closeSettingsModal();
    });
    
    // 背景图片上传功能
    setupBackgroundUpload();
}

// 背景图片上传功能
function setupBackgroundUpload() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('bgFileInput');
    const uploadContent = document.getElementById('uploadContent');
    const previewContent = document.getElementById('previewContent');
    const uploadProgress = document.getElementById('uploadProgress');
    const previewImage = document.getElementById('previewImage');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const confirmBtn = document.getElementById('confirmUpload');
    const cancelBtn = document.getElementById('cancelUpload');
    const bgStyleOptions = document.getElementById('bgStyleOptions');
    const bgSizeSelect = document.getElementById('bgSizeSelect');
    const bgPositionSelect = document.getElementById('bgPositionSelect');
    const bgRepeatSelect = document.getElementById('bgRepeatSelect');
    const removeBgBtn = document.getElementById('removeBgBtn');
    
    let pendingImage = null;
    
    // 点击上传区域触发文件选择
    uploadZone.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON' && !e.target.closest('.preview-actions')) {
            fileInput.click();
        }
    });
    
    // 文件选择
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileSelect(file);
        }
    });
    
    // 拖放功能
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });
    
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileSelect(file);
        }
    });
    
    // 文件处理
    function handleFileSelect(file) {
        // 文件类型验证
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            alert('请上传 JPG、PNG 或 WEBP 格式的图片');
            return;
        }
        
        // 文件大小验证（限制10MB）
        if (file.size > 10 * 1024 * 1024) {
            alert('图片大小不能超过 10MB');
            return;
        }
        
        // 显示进度条
        uploadContent.style.display = 'none';
        previewContent.style.display = 'none';
        uploadProgress.style.display = 'block';
        
        // 模拟加载进度
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 10;
            progressFill.style.width = progress + '%';
            progressText.textContent = `加载中... ${progress}%`;
            
            if (progress >= 100) {
                clearInterval(progressInterval);
                progressText.textContent = '加载完成！';
                
                // 读取文件并预览
                const reader = new FileReader();
                reader.onload = (e) => {
                    pendingImage = e.target.result;
                    previewImage.src = pendingImage;
                    
                    setTimeout(() => {
                        uploadProgress.style.display = 'none';
                        previewContent.style.display = 'block';
                        progressFill.style.width = '0%';
                    }, 500);
                };
                reader.readAsDataURL(file);
            }
        }, 100);
    }
    
    // 确认上传
    confirmBtn.addEventListener('click', () => {
        if (pendingImage) {
            applyBackground(pendingImage);
            previewContent.style.display = 'none';
            uploadContent.style.display = 'block';
            bgStyleOptions.style.display = 'block';
            fileInput.value = '';
            pendingImage = null;
        }
    });
    
    // 取消上传
    cancelBtn.addEventListener('click', () => {
        previewContent.style.display = 'none';
        uploadContent.style.display = 'block';
        fileInput.value = '';
        pendingImage = null;
    });
    
    // 背景样式选项
    bgSizeSelect.addEventListener('change', () => {
        updateBackgroundStyle();
    });
    
    bgPositionSelect.addEventListener('change', () => {
        updateBackgroundStyle();
    });
    
    bgRepeatSelect.addEventListener('change', () => {
        updateBackgroundStyle();
    });
    
    // 移除背景
    removeBgBtn.addEventListener('click', () => {
        if (confirm('确定要移除背景图片吗？')) {
            document.body.style.backgroundImage = '';
            document.body.style.backgroundSize = '';
            document.body.style.backgroundPosition = '';
            document.body.style.backgroundRepeat = '';
            localStorage.removeItem('bgImageData');
            localStorage.removeItem('bgSize');
            localStorage.removeItem('bgPosition');
            localStorage.removeItem('bgRepeat');
            bgStyleOptions.style.display = 'none';
        }
    });
}

// 应用背景图片
function applyBackground(imageData) {
    document.body.style.backgroundImage = `url(${imageData})`;
    updateBackgroundStyle();
    
    // 保存到本地存储
    try {
        localStorage.setItem('bgImageData', imageData);
    } catch (e) {
        console.warn('图片太大，无法保存到本地存储');
        alert('图片已应用，但由于文件过大无法保存到本地存储，刷新页面后将恢复默认背景');
    }
}

// 更新背景样式
function updateBackgroundStyle() {
    const bgSize = document.getElementById('bgSizeSelect').value;
    const bgPosition = document.getElementById('bgPositionSelect').value;
    const bgRepeat = document.getElementById('bgRepeatSelect').value;
    
    document.body.style.backgroundSize = bgSize;
    document.body.style.backgroundPosition = bgPosition;
    document.body.style.backgroundRepeat = bgRepeat;
    
    // 保存设置
    localStorage.setItem('bgSize', bgSize);
    localStorage.setItem('bgPosition', bgPosition);
    localStorage.setItem('bgRepeat', bgRepeat);
}

// 加载背景设置
function loadBackgroundSettings() {
    const bgImageData = localStorage.getItem('bgImageData');
    const bgSize = localStorage.getItem('bgSize');
    const bgPosition = localStorage.getItem('bgPosition');
    const bgRepeat = localStorage.getItem('bgRepeat');
    
    if (bgImageData) {
        document.body.style.backgroundImage = `url(${bgImageData})`;
        document.getElementById('bgStyleOptions').style.display = 'block';
        document.getElementById('removeBgBtn').style.display = 'inline-block';
    }
    
    if (bgSize) {
        document.getElementById('bgSizeSelect').value = bgSize;
        document.body.style.backgroundSize = bgSize;
    }
    
    if (bgPosition) {
        document.getElementById('bgPositionSelect').value = bgPosition;
        document.body.style.backgroundPosition = bgPosition;
    }
    
    if (bgRepeat) {
        document.getElementById('bgRepeatSelect').value = bgRepeat;
        document.body.style.backgroundRepeat = bgRepeat;
    }
}

// 切换视图模式
function switchViewMode(mode) {
    currentViewMode = mode;
    localStorage.setItem('viewMode', mode);
    
    // 更新按钮状态
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === mode);
    });
    
    updateViewStartDate();
    renderGanttChart();
}

// 渲染日历
function renderCalendar() {
    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                        '七月', '八月', '九月', '十月', '十一月', '十二月'];
    
    document.getElementById('currentMonth').textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const prevLastDay = new Date(currentYear, currentMonth, 0);
    
    const firstDayIndex = firstDay.getDay();
    const lastDate = lastDay.getDate();
    const prevLastDate = prevLastDay.getDate();
    
    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';
    
    const today = new Date();
    
    // 上个月的日期
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const day = createCalendarDay(prevLastDate - i, currentMonth - 1, currentYear, true);
        calendarDays.appendChild(day);
    }
    
    // 本月的日期
    for (let i = 1; i <= lastDate; i++) {
        const day = createCalendarDay(i, currentMonth, currentYear, false);
        calendarDays.appendChild(day);
    }
    
    // 下个月的日期
    const totalCells = firstDayIndex + lastDate;
    const remainingCells = 42 - totalCells;
    for (let i = 1; i <= remainingCells && totalCells + i <= 42; i++) {
        const day = createCalendarDay(i, currentMonth + 1, currentYear, true);
        calendarDays.appendChild(day);
    }
}

// 创建日历日期元素
function createCalendarDay(day, month, year, isOtherMonth) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    if (isOtherMonth) dayEl.classList.add('other-month');
    
    const date = new Date(year, month, day);
    const today = new Date();
    
    // 检查是否是今天
    if (day === today.getDate() && 
        month === today.getMonth() && 
        year === today.getFullYear()) {
        dayEl.classList.add('today');
    }
    
    // 检查是否是选中日期
    if (date.toDateString() === selectedDate.toDateString()) {
        dayEl.classList.add('selected');
    }
    
    dayEl.textContent = day;
    
    // 点击日期切换视图
    dayEl.addEventListener('click', () => {
        selectedDate = new Date(year, month, day);
        // 如果点击的是其他月的日期，切换月份
        if (isOtherMonth) {
            currentMonth = month;
            currentYear = year;
            renderCalendar();
        } else {
            // 只更新选中状态
            renderCalendar();
        }
        updateViewStartDate();
        renderGanttChart();
    });
    
    return dayEl;
}

// 渲染甘特图
function renderGanttChart() {
    const titleEl = document.getElementById('ganttTitle');
    const chartInner = document.querySelector('.gantt-chart-inner');
    const daysHeader = document.querySelector('.gantt-days-header');
    const eventsContainer = document.querySelector('.gantt-events');
    const labelsContainer = document.querySelector('.gantt-labels');
    const timelineBar = document.querySelector('.gantt-timeline-bar');
    
    titleEl.textContent = viewNames[currentViewMode];
    daysHeader.innerHTML = '';
    eventsContainer.innerHTML = '';
    labelsContainer.innerHTML = '';
    timelineBar.innerHTML = '';
    
    // 移除旧的视图类
    chartInner.className = 'gantt-chart-inner';
    daysHeader.className = 'gantt-days-header';
    timelineBar.className = 'gantt-timeline-bar';
    daysHeader.style.gridTemplateColumns = '';
    timelineBar.style.gridTemplateColumns = '';
    
    // 添加新的视图类到容器
    chartInner.classList.add(`${currentViewMode}-view`);
    daysHeader.classList.add(`${currentViewMode}-view`);
    timelineBar.classList.add(`${currentViewMode}-view`);
    
    switch (currentViewMode) {
        case 'day':
            renderDayView(daysHeader, eventsContainer, labelsContainer, timelineBar);
            break;
        case 'week':
            renderWeekView(daysHeader, eventsContainer, labelsContainer, timelineBar);
            break;
        case 'month':
            renderMonthView(daysHeader, eventsContainer, labelsContainer, timelineBar);
            break;
        case 'year':
            renderYearView(daysHeader, eventsContainer, labelsContainer, timelineBar);
            break;
    }
    
    // 渲染时间轴
    renderTimeline(timelineBar);
}

// 日视图 - 按小时显示（24小时）
function renderDayView(daysHeader, eventsContainer, labelsContainer, timelineBar) {
    const startDate = new Date(viewStartDate);
    const endDate = new Date(viewStartDate);
    endDate.setDate(endDate.getDate() + 1);
    
    // 设置网格列数（24小时）
    daysHeader.style.gridTemplateColumns = 'repeat(24, 1fr)';
    timelineBar.style.gridTemplateColumns = 'repeat(24, 1fr)';
    
    // 渲染小时头部
    for (let i = 0; i < 24; i++) {
        const hourDiv = document.createElement('div');
        hourDiv.className = 'gantt-day';
        hourDiv.textContent = `${i}:00`;
        daysHeader.appendChild(hourDiv);
    }
    
    // 过滤当天的事件
    const dayEvents = getEventsInRange(startDate, endDate);
    
    // 渲染事件
    renderEventBars(dayEvents, startDate, endDate, eventsContainer, labelsContainer, 24 * 60 * 60 * 1000);
}

// 周视图 - 按天显示（7天）
function renderWeekView(daysHeader, eventsContainer, labelsContainer, timelineBar) {
    const startDate = new Date(viewStartDate);
    const endDate = new Date(viewStartDate);
    endDate.setDate(endDate.getDate() + 7);
    
    // 设置网格列数（7天）
    daysHeader.style.gridTemplateColumns = 'repeat(7, 1fr)';
    timelineBar.style.gridTemplateColumns = 'repeat(7, 1fr)';
    
    const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    
    // 渲染日期头部
    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(startDate);
        dayDate.setDate(dayDate.getDate() + i);
        
        const dayDiv = document.createElement('div');
        dayDiv.className = 'gantt-day';
        dayDiv.textContent = `${dayNames[i]} ${dayDate.getDate()}/${dayDate.getMonth() + 1}`;
        daysHeader.appendChild(dayDiv);
    }
    
    // 过滤本周的事件
    const weekEvents = getEventsInRange(startDate, endDate);
    
    // 渲染事件
    renderEventBars(weekEvents, startDate, endDate, eventsContainer, labelsContainer, 7 * 24 * 60 * 60 * 1000);
}

// 月视图 - 按天显示
function renderMonthView(daysHeader, eventsContainer, labelsContainer, timelineBar) {
    const startDate = new Date(viewStartDate);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    const monthDays = endDate.getDate();
    
    // 动态设置网格列数
    daysHeader.style.gridTemplateColumns = `repeat(${monthDays}, 1fr)`;
    timelineBar.style.gridTemplateColumns = `repeat(${monthDays}, 1fr)`;
    
    // 渲染日期头部（当月所有天）
    for (let i = 1; i <= monthDays; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'gantt-day';
        dayDiv.textContent = `${i}`;
        daysHeader.appendChild(dayDiv);
    }
    
    // 过滤当月的事件
    const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
    const monthEvents = getEventsInRange(startDate, monthEnd);
    
    // 渲染事件
    const totalDuration = monthDays * 24 * 60 * 60 * 1000;
    renderEventBars(monthEvents, startDate, monthEnd, eventsContainer, labelsContainer, totalDuration);
}

// 年视图 - 按周显示（52周）
function renderYearView(daysHeader, eventsContainer, labelsContainer, timelineBar) {
    const year = selectedDate.getFullYear();
    const startDate = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);
    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                        '七月', '八月', '九月', '十月', '十一月', '十二月'];
    
    // 设置网格列数（12个月）
    daysHeader.style.gridTemplateColumns = 'repeat(12, 1fr)';
    timelineBar.style.gridTemplateColumns = 'repeat(12, 1fr)';
    
    // 渲染12个月份头部（单行）
    for (let i = 0; i < 12; i++) {
        const monthDiv = document.createElement('div');
        monthDiv.className = 'gantt-day';
        monthDiv.textContent = monthNames[i];
        daysHeader.appendChild(monthDiv);
    }
    
    // 过滤当年的事件
    const yearEvents = getEventsInRange(startDate, yearEnd);
    
    // 渲染事件（按实际天数计算）
    const totalDuration = yearEnd - startDate;
    renderEventBars(yearEvents, startDate, yearEnd, eventsContainer, labelsContainer, totalDuration);
}

// 获取时间范围内的事件（自动展开周期性事件）
function getEventsInRange(start, end) {
    const result = [];
    
    events.forEach(event => {
        if (event.recurring) {
            // 展开周期性事件
            const instances = expandRecurringEvent(event, start, end);
            result.push(...instances);
        } else {
            // 普通事件
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);
            if (eventStart < end && eventEnd > start) {
                result.push(event);
            }
        }
    });
    
    return result;
}

// 展开周期性事件为指定范围内的实例
function expandRecurringEvent(event, rangeStart, rangeEnd) {
    const instances = [];
    const recurring = event.recurring;
    const mode = recurring.mode || 'weekly';
    
    // 提取原始事件的"时间部分"（时:分:秒）
    const originalStart = new Date(event.start);
    const originalEnd = new Date(event.end);
    const duration = originalEnd - originalStart;
    
    // 判断是否跨天（结束时间的小时 < 开始时间的小时，或持续时间超过24小时）
    const isCrossDay = duration > 24 * 60 * 60 * 1000 || 
                       (originalEnd.getHours() < originalStart.getHours()) ||
                       (originalEnd.getHours() === originalStart.getHours() && originalEnd.getMinutes() < originalStart.getMinutes());
    
    // 计算结束条件
    let maxEnd;
    if (recurring.endDate) {
        maxEnd = new Date(recurring.endDate);
        // 对于跨天事件，结束日期那天的实例也要包含
        maxEnd.setHours(23, 59, 59, 999);
    } else {
        // 默认一年后
        maxEnd = new Date(originalStart);
        maxEnd.setFullYear(maxEnd.getFullYear() + 1);
    }
    
    // 获取开始时间的时分秒
    const startHour = originalStart.getHours();
    const startMinute = originalStart.getMinutes();
    const startSecond = originalStart.getSeconds();
    
    // 从原始日期开始，逐步生成实例
    let currentDate = new Date(originalStart);
    currentDate.setHours(0, 0, 0, 0); // 归零到当天零点
    
    const maxIterations = 2000; // 安全上限
    let iteration = 0;
    
    while (iteration < maxIterations) {
        iteration++;
        
        // 根据模式决定跳到下一个日期
        if (iteration > 1) {
            switch (mode) {
                case 'weekly':
                    currentDate.setDate(currentDate.getDate() + 7);
                    break;
                case 'monthly':
                    currentDate.setMonth(currentDate.getMonth() + 1);
                    break;
                case 'custom':
                    currentDate.setDate(currentDate.getDate() + 1); // 自定义=每天
                    break;
                default:
                    currentDate.setDate(currentDate.getDate() + 7);
            }
        }
        
        // 构建当前实例的开始时间（保持原始时分秒）
        const instanceStart = new Date(currentDate);
        instanceStart.setHours(startHour, startMinute, startSecond, 0);
        const instanceEnd = new Date(instanceStart.getTime() + duration);
        
        // 超过最大结束日期则停止
        if (instanceStart > maxEnd) break;
        
        // 检查是否与查询范围有交集
        if (instanceEnd > rangeStart && instanceStart < rangeEnd) {
            instances.push({
                ...event,
                id: event.id + '_' + iteration,
                start: instanceStart.toISOString(),
                end: instanceEnd.toISOString(),
                isRecurringInstance: true,
                parentId: event.id
            });
        }
        
        // 如果已超出查询范围且超过最大结束时间，提前退出
        if (instanceStart > rangeEnd && instanceStart > maxEnd) break;
    }
    
    return instances;
}

// 渲染时间轴
function renderTimeline(timelineBar) {
    if (!timelineBar) return;
    
    // 根据视图模式确定时间单位和范围
    let timeUnits = [];
    
    switch (currentViewMode) {
        case 'day': {
            // 24小时
            const dayStart = new Date(viewStartDate);
            dayStart.setHours(0, 0, 0, 0);
            for (let i = 0; i < 24; i++) {
                const hourStart = new Date(dayStart);
                hourStart.setHours(i, 0, 0, 0);
                const hourEnd = new Date(dayStart);
                hourEnd.setHours(i + 1, 0, 0, 0);
                timeUnits.push({
                    label: `${i}:00`,
                    start: hourStart,
                    end: hourEnd,
                    type: 'hour'
                });
            }
            break;
        }
        case 'week': {
            // 7天
            const weekStart = new Date(viewStartDate);
            const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
            for (let i = 0; i < 7; i++) {
                const dayStart = new Date(weekStart);
                dayStart.setDate(dayStart.getDate() + i);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(dayStart);
                dayEnd.setDate(dayEnd.getDate() + 1);
                timeUnits.push({
                    label: `${dayNames[i]} ${dayStart.getDate()}/${dayStart.getMonth() + 1}`,
                    start: dayStart,
                    end: dayEnd,
                    type: 'day'
                });
            }
            break;
        }
        case 'month': {
            // 当月所有天
            const monthStart = new Date(viewStartDate);
            const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
            const monthDays = monthEnd.getDate();
            for (let i = 1; i <= monthDays; i++) {
                const dayStart = new Date(monthStart.getFullYear(), monthStart.getMonth(), i);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1);
                timeUnits.push({
                    label: `${i}`,
                    start: dayStart,
                    end: dayEnd,
                    type: 'day'
                });
            }
            break;
        }
        case 'year': {
            // 12个月
            const year = selectedDate.getFullYear();
            const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                                '七月', '八月', '九月', '十月', '十一月', '十二月'];
            for (let i = 0; i < 12; i++) {
                const monthStart = new Date(year, i, 1);
                const monthEnd = new Date(year, i + 1, 1);
                timeUnits.push({
                    label: monthNames[i],
                    start: monthStart,
                    end: monthEnd,
                    type: 'month'
                });
            }
            break;
        }
    }
    
    // 计算每个时间单位的事件数量
    const eventCounts = timeUnits.map(unit => {
        return getEventsInRange(unit.start, unit.end).length;
    });
    
    // 找到最大事件数量
    const maxCount = Math.max(...eventCounts, 1);
    
    // 设置网格列数
    timelineBar.style.gridTemplateColumns = `repeat(${timeUnits.length}, 1fr)`;
    
    // 渲染时间块
    timeUnits.forEach((unit, index) => {
        const count = eventCounts[index];
        const block = document.createElement('div');
        block.className = 'timeline-block';
        
        if (count === 0) {
            block.classList.add('empty');
            block.textContent = '0';
        } else {
            // 计算光谱颜色：事件越少越红(hue=0)，越多越紫(hue=270)
            const ratio = count / maxCount;
            const hue = Math.round(270 * ratio);
            const color = `hsl(${hue}, 80%, 50%)`;
            block.style.backgroundColor = color;
            block.textContent = count;
        }
        
        // 点击显示详细信息
        block.addEventListener('click', (e) => {
            e.stopPropagation();
            showTimelineTooltip(unit, count, e);
        });
        
        timelineBar.appendChild(block);
    });
}

// 显示时间轴提示弹窗
function showTimelineTooltip(unit, count, event) {
    // 移除已有的弹窗
    const existingTooltip = document.querySelector('.timeline-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }
    
    // 创建弹窗
    const tooltip = document.createElement('div');
    tooltip.className = 'timeline-tooltip show';
    
    // 获取该时间段的事件
    const periodEvents = getEventsInRange(unit.start, unit.end);
    
    // 格式化时间标签
    let timeLabel = '';
    if (unit.type === 'hour') {
        timeLabel = `${unit.start.getFullYear()}年${unit.start.getMonth() + 1}月${unit.start.getDate()}日 ${unit.start.getHours()}:00`;
    } else if (unit.type === 'day') {
        timeLabel = `${unit.start.getFullYear()}年${unit.start.getMonth() + 1}月${unit.start.getDate()}日`;
    } else if (unit.type === 'month') {
        timeLabel = `${unit.start.getFullYear()}年${unit.start.getMonth() + 1}月`;
    }
    
    // 构建事件列表
    let eventListHtml = '';
    if (periodEvents.length > 0) {
        eventListHtml = '<div class="task-list">';
        periodEvents.forEach(evt => {
            eventListHtml += `<div class="task-item">${evt.name}</div>`;
        });
        eventListHtml += '</div>';
    }
    
    tooltip.innerHTML = `
        <button class="timeline-tooltip-close">&times;</button>
        <div class="timeline-tooltip-header">${timeLabel}</div>
        <div class="timeline-tooltip-body">
            <span class="task-count">${count} 个任务</span>
            ${eventListHtml}
        </div>
    `;
    
    // 定位弹窗
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 10}px`;
    
    document.body.appendChild(tooltip);
    
    // 关闭按钮
    tooltip.querySelector('.timeline-tooltip-close').addEventListener('click', () => {
        tooltip.remove();
    });
    
    // 点击外部关闭
    setTimeout(() => {
        document.addEventListener('click', function closeTooltip(e) {
            if (!tooltip.contains(e.target)) {
                tooltip.remove();
                document.removeEventListener('click', closeTooltip);
            }
        });
    }, 0);
}

// 渲染事件条
function renderEventBars(filteredEvents, rangeStart, rangeEnd, eventsContainer, labelsContainer, totalDuration) {
    // 按紧急度降序排序（紧急度越高越靠上），周期性事件不参与排序，放在最后
    const sortedEvents = [...filteredEvents].sort((a, b) => {
        const aRecurring = a.recurring || a.isRecurringInstance;
        const bRecurring = b.recurring || b.isRecurringInstance;
        // 非周期性事件优先，周期性事件排在后面
        if (aRecurring && !bRecurring) return 1;
        if (!aRecurring && bRecurring) return -1;
        // 同为非周期性事件时按紧急度排序
        if (!aRecurring && !bRecurring) {
            const urgencyA = a.urgency !== undefined ? a.urgency : 50;
            const urgencyB = b.urgency !== undefined ? b.urgency : 50;
            return urgencyB - urgencyA;
        }
        // 同为周期性事件，保持原始顺序
        return 0;
    });
    
    // 子行机制：每个 track 代表一个标签组（或无标签行），内部可包含多个 subRow
    // track 结构: { tag, events: [{start, end, subRow, urgency}], subRowCount, urgencySum, urgencyCount }
    const tracks = [];
    // 每个事件分配: { trackIndex, subRow }
    const eventPositions = [];
    
    sortedEvents.forEach((event) => {
        const eventStart = new Date(event.start).getTime();
        const eventEnd = new Date(event.end).getTime();
        const eventTag = event.tag || '';
        const urgency = event.urgency !== undefined ? event.urgency : 50;
        
        let placed = false;
        
        if (eventTag) {
            // 有标签：找到或创建该标签的 track
            let targetTrack = tracks.find(t => t.tag === eventTag);
            
            if (!targetTrack) {
                // 创建新标签 track
                targetTrack = { tag: eventTag, events: [], subRowCount: 1, urgencySum: 0, urgencyCount: 0 };
                tracks.push(targetTrack);
            }
            
            // 在该 track 内找不重叠的 subRow
            let assigned = false;
            for (let sr = 0; sr < targetTrack.subRowCount; sr++) {
                const overlap = targetTrack.events.some(e => 
                    e.subRow === sr && eventStart < e.end && eventEnd > e.start
                );
                if (!overlap) {
                    targetTrack.events.push({ start: eventStart, end: eventEnd, subRow: sr, urgency });
                    targetTrack.urgencySum += urgency;
                    targetTrack.urgencyCount++;
                    eventPositions.push({ trackIndex: tracks.indexOf(targetTrack), subRow: sr });
                    assigned = true;
                    break;
                }
            }
            
            if (!assigned) {
                // 所有 subRow 都重叠，新增 subRow
                targetTrack.events.push({ start: eventStart, end: eventEnd, subRow: targetTrack.subRowCount, urgency });
                targetTrack.urgencySum += urgency;
                targetTrack.urgencyCount++;
                eventPositions.push({ trackIndex: tracks.indexOf(targetTrack), subRow: targetTrack.subRowCount });
                targetTrack.subRowCount++;
            }
            
            placed = true;
        }
        
        if (!placed) {
            // 无标签事件：按不重叠规则分配到任意 track 的 subRow
            for (let t = 0; t < tracks.length; t++) {
                // 无标签事件只能放在没有标签的 track 中，或空 track
                if (tracks[t].tag !== '') continue;
                
                for (let sr = 0; sr < tracks[t].subRowCount; sr++) {
                    const overlap = tracks[t].events.some(e => 
                        e.subRow === sr && eventStart < e.end && eventEnd > e.start
                    );
                    if (!overlap) {
                        tracks[t].events.push({ start: eventStart, end: eventEnd, subRow: sr, urgency });
                        tracks[t].urgencySum = (tracks[t].urgencySum || 0) + urgency;
                        tracks[t].urgencyCount = (tracks[t].urgencyCount || 0) + 1;
                        eventPositions.push({ trackIndex: t, subRow: sr });
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
                
                // 该 track 所有 subRow 都满了，新增 subRow
                tracks[t].events.push({ start: eventStart, end: eventEnd, subRow: tracks[t].subRowCount, urgency });
                tracks[t].urgencySum = (tracks[t].urgencySum || 0) + urgency;
                tracks[t].urgencyCount = (tracks[t].urgencyCount || 0) + 1;
                eventPositions.push({ trackIndex: t, subRow: tracks[t].subRowCount });
                tracks[t].subRowCount++;
                placed = true;
                break;
            }
            
            if (!placed) {
                // 创建新的无标签 track
                const newTrack = { tag: '', events: [{ start: eventStart, end: eventEnd, subRow: 0, urgency }], subRowCount: 1, urgencySum: urgency, urgencyCount: 1 };
                tracks.push(newTrack);
                eventPositions.push({ trackIndex: tracks.length - 1, subRow: 0 });
            }
        }
    });
    
    // 按标签内事件的平均紧急度排序（平均值越高越靠前）
    // 不直接排序 tracks（会打乱 eventPositions 的索引），而是创建排序后的渲染顺序
    const sortedTrackOrder = tracks.map((_, i) => i).sort((a, b) => {
        const avgA = tracks[a].urgencyCount > 0 ? tracks[a].urgencySum / tracks[a].urgencyCount : 0;
        const avgB = tracks[b].urgencyCount > 0 ? tracks[b].urgencySum / tracks[b].urgencyCount : 0;
        return avgB - avgA;
    });
    
    // 计算每个 track 的起始视觉行号（按排序后的顺序累加）
    const trackStartRows = new Array(tracks.length);
    let cumulativeRow = 0;
    sortedTrackOrder.forEach((trackIdx, orderIdx) => {
        trackStartRows[trackIdx] = cumulativeRow;
        cumulativeRow += tracks[trackIdx].subRowCount;
    });
    
    // 记录已显示标签的周期性事件父ID，避免重复显示
    const labeledRecurringParents = new Set();
    
    const now = Date.now();
    
    sortedEvents.forEach((event, index) => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        const eventEndTime = eventEnd.getTime();
        
        // 计算事件在甘特图中的位置（裁剪到视图范围内）
        const rangeStartTime = rangeStart.getTime();
        const rangeEndTime = rangeEnd.getTime();
        const eventStartTime = eventStart.getTime();
        
        // 裁剪后的起止时间
        const clippedStart = Math.max(eventStartTime, rangeStartTime);
        const clippedEnd = Math.min(eventEndTime, rangeEndTime);
        
        const startOffset = Math.max(0, (clippedStart - rangeStartTime) / totalDuration);
        const width = Math.max(0, (clippedEnd - clippedStart) / totalDuration) * 100;
        const left = startOffset * 100;
        
        // 每个实例独立计算紧急度
        const priority = calculatePriority(eventEnd);
        
        // 计算最终视觉行号 = track起始行 + subRow
        const pos = eventPositions[index];
        const visualRow = trackStartRows[pos.trackIndex] + pos.subRow;
        
        // 判断是否为周期性事件实例
        const isRecurringInstance = event.isRecurringInstance;
        const parentId = event.parentId;
        
        // 周期性事件实例只创建一次标签（已结束的实例不创建标签）
        let shouldCreateLabel = true;
        if (isRecurringInstance) {
            if (labeledRecurringParents.has(parentId) || eventEndTime <= now) {
                shouldCreateLabel = false;
            } else {
                labeledRecurringParents.add(parentId);
            }
        }
        
        if (shouldCreateLabel) {
            // 创建事件标签
            const labelDiv = document.createElement('div');
            labelDiv.className = `event-label priority-${priority}`;
            const tagHtml = event.tag ? `<span class="event-tag-badge" style="background: ${hexToRgba(getTagColor(event.tag) || '#90caf9', 0.2)}; color: ${getTagColor(event.tag) || '#1976d2'}; border-color: ${getTagColor(event.tag) || '#90caf9'}">${event.tag}</span>` : '';
            labelDiv.innerHTML = `
                ${event.name}
                ${tagHtml}
                <span class="priority-badge priority-${priority}">
                    ${priority === 1 ? '超紧急' : priority === 2 ? '紧急' : '普通'}
                </span>
            `;
            labelDiv.addEventListener('click', () => {
                const eventId = parentId || event.id;
                openEventModal(eventId);
            });
            labelsContainer.appendChild(labelDiv);
        }
        
        // 创建甘特图事件条
        const eventDiv = document.createElement('div');
        eventDiv.className = `gantt-event priority-${priority}`;
        eventDiv.style.left = `${left}%`;
        eventDiv.style.width = `${width}%`;
        eventDiv.style.top = `${visualRow * 50 + 10}px`;
        const urgency = event.urgency !== undefined ? event.urgency : 50;
        eventDiv.style.backgroundColor = urgencyToColor(urgency);
        const tagColor = event.tag ? (getTagColor(event.tag) || getDefaultTagColor(event.tag)) : null;
        const recurringIcon = event.recurring || event.isRecurringInstance ? '<span class="recurring-icon">🔄</span>' : '';
        eventDiv.innerHTML = `<span class="event-bar-name">${event.name}</span>${recurringIcon}${event.tag ? `<span class="event-bar-tag" style="background: ${hexToRgba(tagColor, 0.3)}; border-color: ${tagColor}">${event.tag}</span>` : ''}`;
        eventDiv.title = `${event.name}\n${event.description || ''}\n开始: ${formatDateTime(eventStart)}\n结束: ${formatDateTime(eventEnd)}${event.tag ? '\n标签: ' + event.tag : ''}${event.recurring || event.isRecurringInstance ? '\n 周期性事件' : ''}`;
        
        eventDiv.addEventListener('click', () => {
            // 如果是周期性事件实例，打开父事件
            const eventId = event.parentId || event.id;
            openEventModal(eventId);
        });
        
        eventsContainer.appendChild(eventDiv);
    });
    
    // 动态设置事件容器高度
    const totalRows = cumulativeRow;
    eventsContainer.style.minHeight = `${totalRows * 50 + 20}px`;
    
    // 为有标签的 track 添加背景分组标识（按排序后顺序渲染）
    sortedTrackOrder.forEach(trackIdx => {
        const track = tracks[trackIdx];
        if (track.tag) {
            const tagColor = getTagColor(track.tag) || getDefaultTagColor(track.tag);
            const topPx = trackStartRows[trackIdx] * 50 + 5;
            const heightPx = track.subRowCount * 50;
            
            const band = document.createElement('div');
            band.className = 'track-group-band';
            band.style.top = `${topPx}px`;
            band.style.height = `${heightPx}px`;
            band.style.background = hexToRgba(tagColor, 0.15);
            band.style.borderLeft = `3px solid ${tagColor}`;
            band.dataset.tag = track.tag;
            eventsContainer.insertBefore(band, eventsContainer.firstChild);
        }
    });
    
    // 渲染标签列按钮（按排序后顺序渲染）
    const tagColumn = document.getElementById('ganttTagColumn');
    if (tagColumn) {
        tagColumn.innerHTML = '';
        tagColumn.style.minHeight = `${totalRows * 50 + 20}px`;
        
        const tagColors = JSON.parse(localStorage.getItem('tagColors') || '{}');
        
        sortedTrackOrder.forEach(trackIdx => {
            const track = tracks[trackIdx];
            if (!track.tag) return;
            
            const tagColor = tagColors[track.tag] || getDefaultTagColor(track.tag);
            const topPx = trackStartRows[trackIdx] * 50 + 56;
            const heightPx = track.subRowCount * 50;
            
            const btn = document.createElement('div');
            btn.className = 'tag-column-btn';
            btn.style.top = `${topPx}px`;
            btn.style.height = `${heightPx}px`;
            btn.style.background = tagColor;
            btn.dataset.tag = track.tag;
            btn.innerHTML = `<span class="tag-column-btn-name">${track.tag}</span>`;
            tagColumn.appendChild(btn);
        });
        
        // 点击标签按钮弹出颜色选择
        tagColumn.querySelectorAll('.tag-column-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tag = btn.dataset.tag;
                const input = document.createElement('input');
                input.type = 'color';
                input.value = tagColors[tag] || getDefaultTagColor(tag);
                
                // 使用极小不可见的输入框触发系统原生颜色选择器
                const rect = btn.getBoundingClientRect();
                input.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;opacity:0;width:1px;height:1px;pointer-events:none;z-index:10000;`;
                
                document.body.appendChild(input);
                input.addEventListener('input', (ev) => {
                    const newColor = ev.target.value;
                    tagColors[tag] = newColor;
                    localStorage.setItem('tagColors', JSON.stringify(tagColors));
                    btn.style.background = newColor;
                    document.querySelectorAll('.track-group-band').forEach(band => {
                        if (band.dataset.tag === tag) {
                            band.style.background = hexToRgba(newColor, 0.15);
                            band.style.borderLeftColor = newColor;
                        }
                    });
                });
                input.addEventListener('change', () => {
                    setTimeout(() => input.remove(), 200);
                });
                // 触发系统原生颜色选择器弹窗
                requestAnimationFrame(() => input.click());
            });
        });
    }
}

// 获取标签颜色
function getTagColor(tagName) {
    if (!tagName) return null;
    const tagColors = JSON.parse(localStorage.getItem('tagColors') || '{}');
    return tagColors[tagName] || null;
}

// 将十六进制颜色转换为 rgba
function hexToRgba(hex, alpha) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(144, 202, 249, ${alpha})`;
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 根据标签名生成默认颜色
function getDefaultTagColor(tagName) {
    const colors = ['#90caf9', '#f48fb1', '#a5d6a7', '#ffcc80', '#ce93d8', '#80deea', '#ef9a9a', '#fff59d'];
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
        hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

// 将紧急度映射为颜色（0%红色 → 100%紫色，按光谱顺序：红橙黄绿青蓝紫）
function urgencyToColor(urgency) {
    // 使用 HSL 色相：红(0°) → 橙(30°) → 黄(60°) → 绿(120°) → 青(180°) → 蓝(240°) → 紫(270°)
    const hue = (urgency / 100) * 270;
    return `hsl(${hue}, 100%, 50%)`;
}

// 计算事件优先级
function calculatePriority(endTime) {
    const now = new Date();
    const timeDiff = endTime - now;
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    if (hoursDiff < 0) {
        return 3; // 已结束，普通
    } else if (hoursDiff < 1) {
        return 1; // 一级事件（超紧急）
    } else if (hoursDiff < 10) {
        return 2; // 二级事件（紧急）
    } else {
        return 3; // 三级事件（普通）
    }
}

// 格式化日期时间
function formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 打开事件模态框
function openEventModal(eventId = null) {
    const modal = document.getElementById('eventModal');
    const form = document.getElementById('eventForm');
    const modalTitle = document.getElementById('modalTitle');
    const deleteBtn = document.getElementById('deleteEventBtn');
    
    form.reset();
    document.getElementById('recurringOptions').style.display = 'none';
    document.getElementById('recurringTimeGroup').style.display = 'none';
    document.getElementById('normalTimeGroup').style.display = 'block';
    document.getElementById('normalTimeGroupEnd').style.display = 'block';
    document.getElementById('eventRecurring').checked = false;
    document.getElementById('eventStart').required = true;
    document.getElementById('eventEnd').required = true;
    document.getElementById('crossDayHint').style.display = 'none';
    
    if (eventId) {
        editingEventId = eventId;
        const event = events.find(e => e.id === eventId);
        if (event) {
            modalTitle.textContent = '编辑事件';
            document.getElementById('eventName').value = event.name;
            document.getElementById('eventDesc').value = event.description || '';
            document.getElementById('eventStart').value = formatDateTimeLocal(new Date(event.start));
            document.getElementById('eventEnd').value = formatDateTimeLocal(new Date(event.end));
            const urgency = event.urgency !== undefined ? event.urgency : 50;
            document.getElementById('eventUrgency').value = urgency;
            document.getElementById('urgencyValue').textContent = urgency;
            document.getElementById('urgencyColorPreview').style.backgroundColor = urgencyToColor(urgency);
            document.getElementById('eventTag').value = event.tag || '';
            deleteBtn.style.display = 'block';
            
            // 填充周期性设置
            if (event.recurring) {
                document.getElementById('eventRecurring').checked = true;
                document.getElementById('recurringOptions').style.display = 'block';
                document.getElementById('recurringTimeGroup').style.display = 'block';
                document.getElementById('normalTimeGroup').style.display = 'none';
                document.getElementById('normalTimeGroupEnd').style.display = 'none';
                document.getElementById('eventStart').required = false;
                document.getElementById('eventEnd').required = false;
                
                document.getElementById('recurringMode').value = event.recurring.mode || 'weekly';
                updateRecurringEndDateVisibility();
                
                if (event.recurring.endDate) {
                    document.getElementById('recurringEndDate').value = event.recurring.endDate;
                }
                
                // 从事件的 start/end 提取日期和时段
                const evStart = new Date(event.start);
                const evEnd = new Date(event.end);
                const startDateStr = `${evStart.getFullYear()}-${String(evStart.getMonth() + 1).padStart(2, '0')}-${String(evStart.getDate()).padStart(2, '0')}`;
                document.getElementById('recurringStartDate').value = startDateStr;
                document.getElementById('recurringStartTime').value = `${String(evStart.getHours()).padStart(2, '0')}:${String(evStart.getMinutes()).padStart(2, '0')}`;
                document.getElementById('recurringEndTime').value = `${String(evEnd.getHours()).padStart(2, '0')}:${String(evEnd.getMinutes()).padStart(2, '0')}`;
                checkCrossDay();
            }
        }
    } else {
        editingEventId = null;
        modalTitle.textContent = '添加事件';
        deleteBtn.style.display = 'none';
        
        // 设置默认时间为选中日期的当前时间
        const now = new Date();
        const later = new Date(now.getTime() + 60 * 60 * 1000); // 1小时后
        document.getElementById('eventStart').value = formatDateTimeLocal(now);
        document.getElementById('eventEnd').value = formatDateTimeLocal(later);
        document.getElementById('eventUrgency').value = 50;
        document.getElementById('urgencyValue').textContent = 50;
        document.getElementById('urgencyColorPreview').style.backgroundColor = urgencyToColor(50);
        document.getElementById('eventTag').value = '';
    }
    
    modal.style.display = 'block';
}

// 关闭事件模态框
function closeEventModal() {
    document.getElementById('eventModal').style.display = 'none';
    editingEventId = null;
}

// 打开设置模态框
function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    
    // 更新按钮颜色选择器的值
    const btnColorPicker = document.getElementById('btnColor');
    if (btnColorPicker) {
        btnColorPicker.value = getComputedStyle(document.documentElement).getPropertyValue('--btn-color').trim() || '#4CAF50';
    }
    
    modal.style.display = 'block';
    initRingtoneUI();
}

// 关闭设置模态框
function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
}

// 更新周期性结束日期字段的可见性
function updateRecurringEndDateVisibility() {
    const mode = document.getElementById('recurringMode').value;
    document.getElementById('recurringEndDateField').style.display = mode === 'custom' ? 'block' : 'none';
}

// 检测是否跨天
function checkCrossDay() {
    const startTime = document.getElementById('recurringStartTime').value;
    const endTime = document.getElementById('recurringEndTime').value;
    if (startTime && endTime && endTime <= startTime) {
        document.getElementById('crossDayHint').style.display = 'block';
    } else {
        document.getElementById('crossDayHint').style.display = 'none';
    }
}

// 格式化日期时间为本地时间格式
function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// 保存事件
function saveEvent() {
    const name = document.getElementById('eventName').value;
    const description = document.getElementById('eventDesc').value;
    const urgency = parseInt(document.getElementById('eventUrgency').value);
    const tag = document.getElementById('eventTag').value.trim();
    const color = urgencyToColor(urgency);
    
    const isRecurring = document.getElementById('eventRecurring').checked;
    let startDate, endDate;
    
    if (isRecurring) {
        // 周期性事件：从日期+时段组合
        const recurringStartDate = document.getElementById('recurringStartDate').value;
        const startTime = document.getElementById('recurringStartTime').value;
        const endTime = document.getElementById('recurringEndTime').value;
        
        if (!name || !recurringStartDate || !startTime || !endTime) {
            alert('请填写必要字段');
            return;
        }
        
        // 组合开始时间
        startDate = new Date(`${recurringStartDate}T${startTime}`);
        
        // 组合结束时间（处理跨天）
        endDate = new Date(`${recurringStartDate}T${endTime}`);
        if (endTime <= startTime) {
            // 跨天：结束时间加一天
            endDate.setDate(endDate.getDate() + 1);
        }
    } else {
        // 普通事件
        const start = document.getElementById('eventStart').value;
        const end = document.getElementById('eventEnd').value;
        
        if (!name || !start || !end) {
            alert('请填写必要字段');
            return;
        }
        
        startDate = new Date(start);
        endDate = new Date(end);
        
        if (endDate <= startDate) {
            alert('结束时间必须晚于开始时间');
            return;
        }
    }
    
    // 如果是新标签且没有颜色，自动分配默认颜色
    if (tag) {
        const tagColors = JSON.parse(localStorage.getItem('tagColors') || '{}');
        if (!tagColors[tag]) {
            tagColors[tag] = getDefaultTagColor(tag);
            localStorage.setItem('tagColors', JSON.stringify(tagColors));
        }
    }
    
    // 处理周期性事件配置
    let recurringConfig = null;
    if (isRecurring) {
        const mode = document.getElementById('recurringMode').value;
        const endDateStr = mode === 'custom' ? document.getElementById('recurringEndDate').value : null;
        
        recurringConfig = {
            mode: mode,
            endDate: endDateStr || null
        };
    }
    
    if (editingEventId) {
        // 更新现有事件
        const index = events.findIndex(e => e.id === editingEventId);
        if (index !== -1) {
            events[index] = {
                ...events[index],
                name,
                description,
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                color,
                urgency,
                tag,
                recurring: recurringConfig
            };
        }
    } else {
        // 创建新事件
        const newEvent = {
            id: Date.now().toString(),
            name,
            description,
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            color,
            urgency,
            tag,
            recurring: recurringConfig
        };
        events.push(newEvent);
    }
    
    // 保存到本地存储
    localStorage.setItem('scheduleEvents', JSON.stringify(events));
    
    closeEventModal();
    renderGanttChart();
}

// 删除事件
function deleteEvent() {
    if (!editingEventId) return;
    
    if (confirm('确定要删除这个事件吗？')) {
        events = events.filter(e => e.id !== editingEventId);
        localStorage.setItem('scheduleEvents', JSON.stringify(events));
        closeEventModal();
        renderGanttChart();
    }
}

// 保存按钮主题颜色
function saveBtnColor() {
    const btnColor = document.getElementById('btnColor').value;
    document.documentElement.style.setProperty('--btn-color', btnColor);
    
    // 计算 hover 颜色（稍微暗一点）
    const hoverColor = adjustColor(btnColor, -10);
    document.documentElement.style.setProperty('--btn-color-hover', hoverColor);
    
    localStorage.setItem('btnColor', btnColor);
    localStorage.setItem('btnColorHover', hoverColor);
    
    alert('按钮主题颜色已保存！');
}

// 加载按钮主题颜色
function loadBtnColor() {
    const btnColor = localStorage.getItem('btnColor');
    if (btnColor) {
        document.documentElement.style.setProperty('--btn-color', btnColor);
        const hoverColor = localStorage.getItem('btnColorHover') || adjustColor(btnColor, -10);
        document.documentElement.style.setProperty('--btn-color-hover', hoverColor);
        
        // 更新颜色选择器的值
        const colorPicker = document.getElementById('btnColor');
        if (colorPicker) {
            colorPicker.value = btnColor;
        }
    }
}

// 加载设置
function loadSettings() {
    loadBtnColor();
    
    // 恢复视图模式
    const savedView = localStorage.getItem('viewMode');
    if (savedView && viewNames[savedView]) {
        currentViewMode = savedView;
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === currentViewMode);
        });
    }
}

// 调整颜色亮度（用于生成 hover 颜色）
function adjustColor(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ========== 时钟、天气、闹钟功能 ==========

// 更新数显时钟
function updateDigitalClock() {
    const clockEl = document.getElementById('digitalClock');
    if (!clockEl) return;
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    clockEl.textContent = `${h}:${m}:${s}`;
}

// 更新日期显示
function updateDateDisplay() {
    const dateEl = document.getElementById('currentDate');
    if (!dateEl) return;
    const now = new Date();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    dateEl.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${weekdays[now.getDay()]}`;
}

// 获取天气
function fetchWeather(lat, lon) {
    // 使用 Open-Meteo 免费天气API（无需API Key）
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.current_weather) {
                const w = data.current_weather;
                document.getElementById('weatherIcon').textContent = getWeatherIcon(w.weathercode);
                document.getElementById('weatherTemp').textContent = `${w.temperature}°C`;
                document.getElementById('weatherDesc').textContent = getWeatherDesc(w.weathercode);
            }
        })
        .catch(() => {
            document.getElementById('weatherDesc').textContent = '获取失败';
        });

    // 反向地理编码获取详细位置信息（使用 OpenStreetMap Nominatim）
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh`)
        .then(res => res.json())
        .then(data => {
            if (data && data.address) {
                const addr = data.address;
                // 省份
                const province = addr.state || addr.province || '';
                
                // 从 display_name 中提取完整位置信息
                // display_name 格式: "蓝球场, 芷阳路, 临潼区, 西安市, 陕西省, 710600, 中国"
                // 顺序：街道, 路, 区, 市, 省, 邮编, 国家
                let city = '';
                let county = '';
                let street = '';
                
                if (data.display_name) {
                    const parts = data.display_name.split(',').map(p => p.trim());
                    // 找到省份的位置
                    const provIdx = parts.findIndex(p => p.includes('省') || p.includes('自治区') || p.includes('特别行政区'));
                    // 省份前面是市，市前面是区，区前面是街道
                    if (provIdx > 0) city = parts[provIdx - 1];
                    if (provIdx > 1) county = parts[provIdx - 2];
                    if (provIdx > 2) street = parts[provIdx - 3];
                }
                
                // 回退到 addr 字段
                if (!city) city = addr.city || addr.town || addr.prefecture || '';
                if (!county) county = addr.county || addr.district || addr.city_district || '';
                if (!street) street = addr.road || addr.suburb || addr.neighbourhood || addr.village || '';

                document.getElementById('weatherProvince').textContent = province || '--';
                document.getElementById('weatherCity').textContent = city || '--';
                document.getElementById('weatherDistrict').textContent = county || '--';
                document.getElementById('weatherDetail').textContent = street || '--';
            }
        })
        .catch(() => {
            document.getElementById('weatherProvince').textContent = '未知';
            document.getElementById('weatherCity').textContent = '未知';
            document.getElementById('weatherDistrict').textContent = '未知';
            document.getElementById('weatherDetail').textContent = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
        });
}

function getWeatherIcon(code) {
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 48) return '️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 82) return '🌧️';
    if (code <= 86) return '❄️';
    if (code <= 99) return '⛈️';
    return '🌤️';
}

function getWeatherDesc(code) {
    const descs = {
        0: '晴', 1: '大部晴朗', 2: '多云', 3: '阴天',
        45: '雾', 48: '雾凇', 51: '小毛毛雨', 53: '中毛毛雨',
        55: '大毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨',
        71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒',
        80: '小阵雨', 81: '中阵雨', 82: '大阵雨',
        95: '雷暴', 96: '雷暴+小冰雹', 99: '雷暴+大冰雹'
    };
    return descs[code] || '未知';
}

function requestLocation() {
    document.getElementById('weatherDesc').textContent = '定位中...';
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                fetchWeather(pos.coords.latitude, pos.coords.longitude);
            },
            () => {
                // 定位失败，尝试IP定位
                fetchIPLocation();
            },
            { timeout: 5000 }
        );
    } else {
        fetchIPLocation();
    }
}

// 基于IP的备选定位
function fetchIPLocation() {
    fetch('https://ipapi.co/json/')
        .then(res => res.json())
        .then(data => {
            if (data.latitude && data.longitude) {
                fetchWeather(data.latitude, data.longitude);
            } else {
                document.getElementById('weatherDesc').textContent = '定位失败';
                document.getElementById('weatherProvince').textContent = '未知';
                document.getElementById('weatherCity').textContent = '未知';
                document.getElementById('weatherDistrict').textContent = '未知';
                document.getElementById('weatherDetail').textContent = '未知';
            }
        })
        .catch(() => {
            document.getElementById('weatherDesc').textContent = '定位失败';
        });
}

// ========== 闹钟列表功能 ==========
let alarms = JSON.parse(localStorage.getItem('alarms') || '[]');
let alarmCheckInterval = null;
let editingAlarmId = null;

// 星期名称
const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const weekdayShort = ['日', '一', '二', '三', '四', '五', '六'];

// 保存闹钟到本地存储
function saveAlarms() {
    localStorage.setItem('alarms', JSON.stringify(alarms));
}

// 获取时间段描述
function getTimePeriod(hour) {
    if (hour >= 0 && hour < 6) return '凌晨';
    if (hour >= 6 && hour < 12) return '早上';
    if (hour >= 12 && hour < 14) return '中午';
    if (hour >= 14 && hour < 18) return '下午';
    if (hour >= 18 && hour < 22) return '晚上';
    return '深夜';
}

// 获取重复描述
function getRepeatDesc(alarm) {
    if (!alarm.repeatDays || alarm.repeatDays.length === 0) return '不重复';
    if (alarm.repeatDays.length === 7) return '每天';
    const weekdays = alarm.repeatDays.map(d => weekdayShort[d]).join(' ');
    return weekdays;
}

// 计算下次响铃时间
function getNextAlarmTime(alarm) {
    const now = new Date();
    const [h, m] = alarm.time.split(':').map(Number);
    
    if (alarm.repeatDays && alarm.repeatDays.length > 0) {
        // 重复闹钟：找到下一个触发日
        for (let i = 0; i < 7; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() + i);
            d.setHours(h, m, 0, 0);
            const dayOfWeek = d.getDay();
            if (alarm.repeatDays.includes(dayOfWeek) && d > now) {
                return d;
            }
        }
        return null;
    } else {
        // 不重复：今天或明天
        const today = new Date(now);
        today.setHours(h, m, 0, 0);
        if (today > now) return today;
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(h, m, 0, 0);
        return tomorrow;
    }
}

// 计算距离下次响铃的时间描述
function getTimeUntilNext(alarm) {
    const next = getNextAlarmTime(alarm);
    if (!next) return '';
    const now = new Date();
    const diff = next - now;
    const totalMinutes = Math.floor(diff / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}小时${minutes}分钟后响铃`;
    return `${minutes}分钟后响铃`;
}

// 渲染闹钟列表
function renderAlarmList() {
    const listEl = document.getElementById('alarmList');
    const nextInfoEl = document.getElementById('alarmNextInfo');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    
    // 按时间排序
    alarms.sort((a, b) => a.time.localeCompare(b.time));
    
    // 更新下次响铃信息
    let nextAlarm = null;
    let nextTime = Infinity;
    alarms.forEach(alarm => {
        if (alarm.enabled) {
            const t = getNextAlarmTime(alarm);
            if (t && t.getTime() < nextTime) {
                nextTime = t.getTime();
                nextAlarm = alarm;
            }
        }
    });
    
    if (nextAlarm && nextInfoEl) {
        const desc = getTimeUntilNext(nextAlarm);
        nextInfoEl.textContent = desc || '';
    } else if (nextInfoEl) {
        nextInfoEl.textContent = '';
    }
    
    alarms.forEach(alarm => {
        const [h, m] = alarm.time.split(':').map(Number);
        const period = getTimePeriod(h);
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const repeatDesc = getRepeatDesc(alarm);
        
        const item = document.createElement('div');
        item.className = 'alarm-item' + (alarm.enabled ? '' : ' disabled');
        item.innerHTML = `
            <div class="alarm-item-info">
                <div class="alarm-item-time">${period} ${timeStr}</div>
                <div class="alarm-item-repeat">闹钟，${repeatDesc}</div>
            </div>
            <div class="alarm-item-controls">
                <label class="alarm-toggle">
                    <input type="checkbox" ${alarm.enabled ? 'checked' : ''} data-id="${alarm.id}">
                    <span class="alarm-toggle-slider"></span>
                </label>
                <button class="alarm-delete-btn" data-id="${alarm.id}" title="删除">×</button>
            </div>
        `;
        listEl.appendChild(item);
    });
    
    // 绑定事件
    listEl.querySelectorAll('.alarm-toggle input').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            const alarm = alarms.find(a => a.id === id);
            if (alarm) {
                alarm.enabled = e.target.checked;
                saveAlarms();
                renderAlarmList();
            }
        });
    });
    
    listEl.querySelectorAll('.alarm-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.dataset.id);
            alarms = alarms.filter(a => a.id !== id);
            saveAlarms();
            renderAlarmList();
        });
    });
}

// 打开添加闹钟弹窗
function openAlarmModal() {
    editingAlarmId = null;
    document.getElementById('alarmModalTime').value = '07:00';
    document.getElementById('alarmModalTitle').textContent = '添加闹钟';
    document.getElementById('alarmModalSave').textContent = '保存';
    document.getElementById('alarmModalDelete').style.display = 'none';
    // 默认选中工作日
    document.querySelectorAll('.alarm-modal-weekday').forEach(cb => {
        const day = parseInt(cb.dataset.day);
        cb.checked = day >= 1 && day <= 5;
    });
    document.getElementById('alarmModal').style.display = 'block';
}

// 打开编辑闹钟弹窗
function openEditAlarmModal(id) {
    const alarm = alarms.find(a => a.id === id);
    if (!alarm) return;
    editingAlarmId = id;
    document.getElementById('alarmModalTime').value = alarm.time;
    document.getElementById('alarmModalTitle').textContent = '编辑闹钟';
    document.getElementById('alarmModalSave').textContent = '保存';
    document.getElementById('alarmModalDelete').style.display = 'inline-block';
    document.querySelectorAll('.alarm-modal-weekday').forEach(cb => {
        const day = parseInt(cb.dataset.day);
        cb.checked = alarm.repeatDays && alarm.repeatDays.includes(day);
    });
    document.getElementById('alarmModal').style.display = 'block';
}

// 保存闹钟
function saveAlarmModal() {
    const time = document.getElementById('alarmModalTime').value;
    if (!time) return;
    
    const repeatDays = [];
    document.querySelectorAll('.alarm-modal-weekday:checked').forEach(cb => {
        repeatDays.push(parseInt(cb.dataset.day));
    });
    
    if (editingAlarmId !== null) {
        const alarm = alarms.find(a => a.id === editingAlarmId);
        if (alarm) {
            alarm.time = time;
            alarm.repeatDays = repeatDays;
        }
    } else {
        alarms.push({
            id: Date.now(),
            time: time,
            repeatDays: repeatDays,
            enabled: true
        });
    }
    
    saveAlarms();
    renderAlarmList();
    document.getElementById('alarmModal').style.display = 'none';
}

// 删除闹钟（从编辑弹窗）
function deleteAlarmFromModal() {
    if (editingAlarmId !== null) {
        alarms = alarms.filter(a => a.id !== editingAlarmId);
        saveAlarms();
        renderAlarmList();
        document.getElementById('alarmModal').style.display = 'none';
    }
}

// ========== 铃声引擎 ==========
const RINGTONES = [
    { id: 'classic', name: '经典闹钟' },
    { id: 'electronic', name: '电子提示' },
    { id: 'gentle', name: '温柔唤醒' },
    { id: 'urgent', name: '急促提醒' },
    { id: 'nature', name: '自然鸟鸣' }
];

let ringtoneSettings = JSON.parse(localStorage.getItem('ringtoneSettings')) || {
    selectedRingtone: 'classic',
    volume: 80,
    duration: 15,
    fadeIn: true,
    overrideMute: true
};

let audioCtx = null;
let currentRingtoneOscillators = [];
let ringtoneTimeout = null;
let fadeInInterval = null;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function stopCurrentRingtone() {
    if (ringtoneTimeout) {
        clearTimeout(ringtoneTimeout);
        ringtoneTimeout = null;
    }
    if (fadeInInterval) {
        clearInterval(fadeInInterval);
        fadeInInterval = null;
    }
    currentRingtoneOscillators.forEach(osc => {
        try {
            osc.gainNode.gain.cancelScheduledValues(0);
            osc.gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            osc.osc.stop(audioCtx.currentTime + 0.01);
        } catch (e) {}
    });
    currentRingtoneOscillators = [];
}

function playRingtone(ringtoneId, duration, volume, fadeIn, overrideMute) {
    stopCurrentRingtone();
    
    const ctx = getAudioContext();
    const masterGain = ctx.createGain();
    const targetVolume = volume / 100;
    
    if (overrideMute) {
        masterGain.gain.value = targetVolume;
    } else {
        masterGain.gain.value = targetVolume;
    }
    
    if (fadeIn) {
        masterGain.gain.setValueAtTime(0, ctx.currentTime);
        masterGain.gain.linearRampToValueAtTime(targetVolume, ctx.currentTime + 2);
    } else {
        masterGain.gain.setValueAtTime(targetVolume, ctx.currentTime);
    }
    
    masterGain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    const oscillators = [];
    
    switch (ringtoneId) {
        case 'classic': {
            // 经典双音闹钟：叮-咚 重复
            for (let i = 0; i < 20; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = i % 2 === 0 ? 880 : 660;
                gain.gain.setValueAtTime(0, now + i * 0.3);
                gain.gain.linearRampToValueAtTime(1, now + i * 0.3 + 0.05);
                gain.gain.linearRampToValueAtTime(0, now + i * 0.3 + 0.25);
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(now + i * 0.3);
                osc.stop(now + i * 0.3 + 0.3);
                oscillators.push({ osc, gainNode: gain });
            }
            break;
        }
        case 'electronic': {
            // 电子提示：短促数字音
            for (let i = 0; i < 15; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'square';
                osc.frequency.value = 1000 + (i % 3) * 200;
                gain.gain.setValueAtTime(0, now + i * 0.2);
                gain.gain.linearRampToValueAtTime(0.5, now + i * 0.2 + 0.02);
                gain.gain.linearRampToValueAtTime(0, now + i * 0.2 + 0.15);
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(now + i * 0.2);
                osc.stop(now + i * 0.2 + 0.2);
                oscillators.push({ osc, gainNode: gain });
            }
            break;
        }
        case 'gentle': {
            // 温柔唤醒：柔和和弦
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            for (let i = 0; i < 8; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = notes[i % 4];
                gain.gain.setValueAtTime(0, now + i * 0.5);
                gain.gain.linearRampToValueAtTime(0.8, now + i * 0.5 + 0.3);
                gain.gain.linearRampToValueAtTime(0, now + i * 0.5 + 0.8);
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(now + i * 0.5);
                osc.stop(now + i * 0.5 + 1);
                oscillators.push({ osc, gainNode: gain });
            }
            break;
        }
        case 'urgent': {
            // 急促提醒：快速连续音
            for (let i = 0; i < 30; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.value = 800 + (i % 2) * 400;
                gain.gain.setValueAtTime(0, now + i * 0.1);
                gain.gain.linearRampToValueAtTime(0.6, now + i * 0.1 + 0.02);
                gain.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.08);
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(now + i * 0.1);
                osc.stop(now + i * 0.1 + 0.1);
                oscillators.push({ osc, gainNode: gain });
            }
            break;
        }
        case 'nature': {
            // 自然鸟鸣：模拟鸟叫声
            for (let i = 0; i < 12; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                const baseFreq = 2000 + Math.random() * 1000;
                osc.frequency.setValueAtTime(baseFreq, now + i * 0.4);
                osc.frequency.linearRampToValueAtTime(baseFreq + 500, now + i * 0.4 + 0.1);
                osc.frequency.linearRampToValueAtTime(baseFreq - 200, now + i * 0.4 + 0.3);
                gain.gain.setValueAtTime(0, now + i * 0.4);
                gain.gain.linearRampToValueAtTime(0.5, now + i * 0.4 + 0.05);
                gain.gain.linearRampToValueAtTime(0, now + i * 0.4 + 0.35);
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(now + i * 0.4);
                osc.stop(now + i * 0.4 + 0.4);
                oscillators.push({ osc, gainNode: gain });
            }
            break;
        }
    }
    
    currentRingtoneOscillators = oscillators;
    
    // 设置持续时间
    if (duration > 0) {
        ringtoneTimeout = setTimeout(() => {
            stopCurrentRingtone();
        }, duration * 1000);
    }
}

function initRingtoneUI() {
    const ringtoneList = document.getElementById('ringtoneList');
    if (!ringtoneList) return;
    
    ringtoneList.innerHTML = '';
    RINGTONES.forEach(rt => {
        const item = document.createElement('div');
        item.className = 'ringtone-item' + (rt.id === ringtoneSettings.selectedRingtone ? ' active' : '');
        item.innerHTML = `
            <div class="ringtone-item-info">
                <span class="ringtone-name">${rt.name}</span>
            </div>
            <button class="ringtone-test-btn" data-id="${rt.id}">试听</button>
        `;
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('ringtone-test-btn')) return;
            ringtoneSettings.selectedRingtone = rt.id;
            document.querySelectorAll('.ringtone-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            saveRingtoneSettings();
        });
        ringtoneList.appendChild(item);
    });
    
    // 试听按钮
    ringtoneList.querySelectorAll('.ringtone-test-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            stopCurrentRingtone();
            playRingtone(id, 3, ringtoneSettings.volume, false, ringtoneSettings.overrideMute);
        });
    });
    
    // 音量滑块
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeValue = document.getElementById('volumeValue');
    if (volumeSlider) {
        volumeSlider.value = ringtoneSettings.volume;
        volumeValue.textContent = ringtoneSettings.volume;
        volumeSlider.addEventListener('input', () => {
            ringtoneSettings.volume = parseInt(volumeSlider.value);
            volumeValue.textContent = ringtoneSettings.volume;
            saveRingtoneSettings();
        });
    }
    
    // 持续时间
    const durationSelect = document.getElementById('durationSelect');
    if (durationSelect) {
        durationSelect.value = ringtoneSettings.duration;
        durationSelect.addEventListener('change', () => {
            ringtoneSettings.duration = parseInt(durationSelect.value);
            saveRingtoneSettings();
        });
    }
    
    // 渐强
    const fadeInToggle = document.getElementById('fadeInToggle');
    if (fadeInToggle) {
        fadeInToggle.checked = ringtoneSettings.fadeIn;
        fadeInToggle.addEventListener('change', () => {
            ringtoneSettings.fadeIn = fadeInToggle.checked;
            saveRingtoneSettings();
        });
    }
    
    // 覆盖静音
    const overrideMuteToggle = document.getElementById('overrideMuteToggle');
    if (overrideMuteToggle) {
        overrideMuteToggle.checked = ringtoneSettings.overrideMute;
        overrideMuteToggle.addEventListener('change', () => {
            ringtoneSettings.overrideMute = overrideMuteToggle.checked;
            saveRingtoneSettings();
        });
    }
}

function saveRingtoneSettings() {
    localStorage.setItem('ringtoneSettings', JSON.stringify(ringtoneSettings));
}

function triggerAlarmSound() {
    playRingtone(
        ringtoneSettings.selectedRingtone,
        ringtoneSettings.duration,
        ringtoneSettings.volume,
        ringtoneSettings.fadeIn,
        ringtoneSettings.overrideMute
    );
}

// 检查闹钟和事件截止提醒
function checkAlarms() {
    const now = new Date();
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const currentS = now.getSeconds();
    const currentTime = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;
    const currentDay = now.getDay();
    
    // 检查闹钟
    alarms.forEach(alarm => {
        if (!alarm.enabled) return;
        if (alarm.time !== currentTime) return;
        if (currentS !== 0) return; // 只在整分钟触发
        
        // 检查重复日
        if (alarm.repeatDays && alarm.repeatDays.length > 0) {
            if (!alarm.repeatDays.includes(currentDay)) return;
        } else {
            // 不重复的闹钟，触发后自动关闭
            alarm.enabled = false;
            saveAlarms();
            renderAlarmList();
        }
        
        triggerAlarmSound();
        showNotification(`⏰ 闹钟时间到！\n${currentTime}`);
    });
    
    // 检查事件截止提醒
    const pad2 = n => String(n).padStart(2, '0');
    const localDateTime = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}T${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    events.forEach(event => {
        if (event.end === localDateTime && currentS === 0) {
            triggerAlarmSound();
            showNotification(`⏰ 事件截止提醒！\n「${event.name}」已到期`);
        }
    });
}

// 显示通知弹窗（替代 alert）
function showNotification(message) {
    let notif = document.getElementById('notificationPopup');
    if (!notif) {
        notif = document.createElement('div');
        notif.id = 'notificationPopup';
        notif.innerHTML = `
            <div class="notif-content">
                <p class="notif-message"></p>
                <div class="notif-actions">
                    <button class="btn btn-danger" id="stopRingtoneBtn">停止铃声</button>
                    <button class="btn" id="closeNotifBtn">关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(notif);
        
        document.getElementById('stopRingtoneBtn').addEventListener('click', () => {
            stopCurrentRingtone();
        });
        document.getElementById('closeNotifBtn').addEventListener('click', () => {
            stopCurrentRingtone();
            notif.style.display = 'none';
        });
    }
    notif.querySelector('.notif-message').textContent = message;
    notif.style.display = 'flex';
}

// 初始化闹钟
function initAlarmSystem() {
    renderAlarmList();
    if (alarmCheckInterval) clearInterval(alarmCheckInterval);
    alarmCheckInterval = setInterval(checkAlarms, 1000);
}

// 初始化时钟、天气、闹钟
function setupClockWeatherAlarm() {
    updateDigitalClock();
    updateDateDisplay();
    setInterval(() => {
        updateDigitalClock();
        updateDateDisplay();
    }, 1000);

    // 天气按钮
    const getLocationBtn = document.getElementById('getLocationBtn');
    if (getLocationBtn) {
        getLocationBtn.addEventListener('click', requestLocation);
    }

    // 闹钟按钮
    const addAlarmBtn = document.getElementById('addAlarmBtn');
    if (addAlarmBtn) addAlarmBtn.addEventListener('click', openAlarmModal);

    // 闹钟弹窗按钮
    const alarmModalSave = document.getElementById('alarmModalSave');
    const alarmModalDelete = document.getElementById('alarmModalDelete');
    const alarmModalCancel = document.getElementById('alarmModalCancel');
    if (alarmModalSave) alarmModalSave.addEventListener('click', saveAlarmModal);
    if (alarmModalDelete) alarmModalDelete.addEventListener('click', deleteAlarmFromModal);
    if (alarmModalCancel) alarmModalCancel.addEventListener('click', () => {
        document.getElementById('alarmModal').style.display = 'none';
    });

    // 点击弹窗外部关闭
    window.addEventListener('click', (e) => {
        const alarmModal = document.getElementById('alarmModal');
        if (e.target === alarmModal) alarmModal.style.display = 'none';
    });

    initAlarmSystem();
    
    // 页面加载时自动尝试获取位置
    setTimeout(() => {
        requestLocation();
    }, 500);

    // 初始化 AI 智能助手
    initAIAssistant();
}

// ==================== 数据分析器（前端版） ====================

class DataAnalyzer {
  analyzeAll(events, weather, alarms) {
    return {
      totalEvents: events.length,
      todayEvents: this.getTodayEvents(events),
      weekEvents: this.getWeekEvents(events),
      monthEvents: this.getMonthEvents(events),
      highPriorityEvents: this.getHighPriorityEvents(events),
      activeAlarms: this.getActiveAlarms(alarms),
      nextAlarm: this.getNextAlarm(alarms),
      weekScheduledHours: this.calculateWeekScheduledHours(events),
      avgDailyEvents: this.calculateAvgDailyEvents(events),
      conflicts: this.detectConflicts(events),
      tagDistribution: this.getTagDistribution(events),
      timeDistribution: this.getTimeDistribution(events),
      busyDays: this.getBusyDays(events)
    };
  }

  getTodayEvents(events) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    // 使用 getEventsInRange 自动展开周期性事件
    return getEventsInRange(today, tomorrow);
  }

  getWeekEvents(events) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    return getEventsInRange(weekStart, weekEnd);
  }

  getMonthEvents(events) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return getEventsInRange(monthStart, monthEnd);
  }

  getHighPriorityEvents(events) {
    return events.filter(e => e.urgency >= 80);
  }

  getActiveAlarms(alarms) {
    if (!alarms || !Array.isArray(alarms)) return 0;
    return alarms.filter(a => a.enabled).length;
  }

  getNextAlarm(alarms) {
    if (!alarms || !Array.isArray(alarms) || alarms.length === 0) return null;
    const now = new Date();
    const enabledAlarms = alarms.filter(a => a.enabled);
    if (enabledAlarms.length === 0) return null;
    let nextAlarm = null;
    let minDiff = Infinity;
    enabledAlarms.forEach(alarm => {
      const [hours, minutes] = alarm.time.split(':');
      const alarmDate = new Date();
      alarmDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      if (alarmDate < now) alarmDate.setDate(alarmDate.getDate() + 1);
      const diff = alarmDate - now;
      if (diff < minDiff) { minDiff = diff; nextAlarm = alarmDate; }
    });
    return nextAlarm ? nextAlarm.toLocaleString('zh-CN') : null;
  }

  calculateWeekScheduledHours(events) {
    const weekEvents = this.getWeekEvents(events);
    let totalMinutes = 0;
    weekEvents.forEach(e => {
      const start = new Date(e.start);
      const end = new Date(e.end);
      totalMinutes += (end - start) / (1000 * 60);
    });
    return totalMinutes / 60;
  }

  calculateAvgDailyEvents(events) {
    if (events.length === 0) return 0;
    const dates = new Set();
    events.forEach(e => { dates.add(new Date(e.start).toDateString()); });
    return events.length / dates.size;
  }

  detectConflicts(events) {
    const conflicts = [];
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const e1Start = new Date(events[i].start);
        const e1End = new Date(events[i].end);
        const e2Start = new Date(events[j].start);
        const e2End = new Date(events[j].end);
        if (e1Start < e2End && e2Start < e1End) {
          const overlapStart = new Date(Math.max(e1Start, e2Start));
          const overlapEnd = new Date(Math.min(e1End, e2End));
          const overlap = overlapStart < overlapEnd ? (overlapEnd - overlapStart) / (1000 * 60) : 0;
          conflicts.push({ event1: events[i].name, event2: events[j].name, overlap });
        }
      }
    }
    return conflicts;
  }

  getTagDistribution(events) {
    const distribution = {};
    events.forEach(e => {
      const tag = e.tag || '未分类';
      distribution[tag] = (distribution[tag] || 0) + 1;
    });
    return distribution;
  }

  getTimeDistribution(events) {
    const distribution = new Array(24).fill(0);
    events.forEach(e => { distribution[new Date(e.start).getHours()]++; });
    return distribution;
  }

  getBusyDays(events) {
    const dayCounts = {};
    events.forEach(e => {
      const date = new Date(e.start).toDateString();
      dayCounts[date] = (dayCounts[date] || 0) + 1;
    });
    return Object.values(dayCounts).filter(count => count >= 5).length;
  }
}

const dataAnalyzer = new DataAnalyzer();

// ==================== AI 智能助手 ====================

// AI 状态
let aiChatHistory = [];
let aiIsTyping = false;

// 获取 AI 配置（从 localStorage）
function getAiConfig() {
    const saved = JSON.parse(localStorage.getItem('aiConfig') || '{}');
    return {
        provider: saved.provider || 'openai',
        apiKey: saved.apiKey || '',
        model: saved.model || '',
        baseUrl: saved.baseUrl || ''
    };
}

// 初始化 AI 助手
function initAIAssistant() {
    const aiSendBtn = document.getElementById('aiSendBtn');
    const aiChatInput = document.getElementById('aiChatInput');
    const aiSummaryBtn = document.getElementById('aiSummaryBtn');
    const aiSuggestBtn = document.getElementById('aiSuggestBtn');
    const aiQuickBtns = document.querySelectorAll('.ai-quick-btn');

    // 加载历史聊天记录
    loadAIChatHistory();

    // 发送消息
    aiSendBtn.addEventListener('click', sendAIMessage);
    aiChatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAIMessage();
        }
    });

    // 自动调整输入框高度
    aiChatInput.addEventListener('input', () => {
        aiChatInput.style.height = 'auto';
        aiChatInput.style.height = Math.min(aiChatInput.scrollHeight, 60) + 'px';
    });

    // 快捷按钮
    aiQuickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 摘要和建议按钮有独立的处理函数，不通过快捷按钮逻辑
            if (btn.id === 'aiSummaryBtn' || btn.id === 'aiSuggestBtn') return;
            aiChatInput.value = btn.dataset.question;
            sendAIMessage();
        });
    });

    // 生成摘要
    aiSummaryBtn.addEventListener('click', () => generateAISummary());

    // 获取建议
    aiSuggestBtn.addEventListener('click', () => getAISuggestions());

    // AI 回答模式切换
    const modeBtns = document.querySelectorAll('.ai-mode-btn');
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentAIMode = btn.dataset.mode;
            localStorage.setItem('aiMode', currentAIMode);
        });
    });

    // 恢复上次选择的模式
    const savedMode = localStorage.getItem('aiMode');
    if (savedMode) {
        currentAIMode = savedMode;
        modeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === savedMode);
        });
    }

    // AI 配置相关
    setupAiConfigListeners();

    // 检查后端连接
    checkAIBackend();
}

// 设置 AI 配置面板的事件监听
function setupAiConfigListeners() {
    const saveBtn = document.getElementById('saveAiConfigBtn');
    const testBtn = document.getElementById('testAiConfigBtn');
    const providerSelect = document.getElementById('aiProvider');

    if (!saveBtn) return;

    // 加载已保存的配置
    loadAiConfig();

    // 保存配置
    saveBtn.addEventListener('click', () => {
        const config = {
            provider: providerSelect.value,
            apiKey: document.getElementById('aiApiKey').value.trim(),
            model: document.getElementById('aiModel').value.trim(),
            baseUrl: document.getElementById('aiBaseUrl').value.trim()
        };
        localStorage.setItem('aiConfig', JSON.stringify(config));
        alert('AI 配置已保存！');
    });

    // 测试连接
    testBtn.addEventListener('click', async () => {
        const config = {
            provider: providerSelect.value,
            apiKey: document.getElementById('aiApiKey').value.trim(),
            model: document.getElementById('aiModel').value.trim(),
            baseUrl: document.getElementById('aiBaseUrl').value.trim()
        };

        if (!config.apiKey) {
            alert('请先填写 API Key');
            return;
        }

        testBtn.textContent = '测试中...';
        testBtn.disabled = true;

        try {
            const messages = [
                { role: 'user', content: '请回复"连接成功"四个字。' }
            ];
            const response = await callAIAPI(messages, config);
            alert('连接成功！AI 服务正常工作。回复：' + response);
        } catch (error) {
            alert('连接失败：' + error.message);
        } finally {
            testBtn.textContent = '测试连接';
            testBtn.disabled = false;
        }
    });

    // 切换提供商时自动填充默认模型名
    providerSelect.addEventListener('change', () => {
        const modelInput = document.getElementById('aiModel');
        const baseUrlInput = document.getElementById('aiBaseUrl');
        switch (providerSelect.value) {
            case 'openai':
                modelInput.placeholder = '例如：gpt-4, gpt-3.5-turbo';
                baseUrlInput.placeholder = '例如：https://api.openai.com/v1';
                break;
            case 'anthropic':
                modelInput.placeholder = '例如：claude-3-sonnet-20240229';
                baseUrlInput.placeholder = '留空使用默认地址';
                break;
            case 'qwen':
                modelInput.placeholder = '例如：qwen-max, qwen-plus';
                baseUrlInput.placeholder = '留空使用默认地址';
                break;
        }
    });
}

// 加载已保存的 AI 配置到表单
function loadAiConfig() {
    const config = getAiConfig();
    const providerSelect = document.getElementById('aiProvider');
    const apiKeyInput = document.getElementById('aiApiKey');
    const modelInput = document.getElementById('aiModel');
    const baseUrlInput = document.getElementById('aiBaseUrl');

    if (providerSelect) providerSelect.value = config.provider;
    if (apiKeyInput) apiKeyInput.value = config.apiKey;
    if (modelInput) modelInput.value = config.model;
    if (baseUrlInput) baseUrlInput.value = config.baseUrl;
}

// 检查 AI 配置状态（纯前端，无需后端）
function checkAIBackend() {
    const statusEl = document.getElementById('aiStatus');
    const config = getAiConfig();
    if (config.apiKey) {
        statusEl.classList.add('online');
        statusEl.classList.remove('offline');
    } else {
        statusEl.classList.add('offline');
        statusEl.classList.remove('online');
    }
}

// 发送消息（前端直接调用 AI API）
async function sendAIMessage() {
    const aiChatInput = document.getElementById('aiChatInput');
    const message = aiChatInput.value.trim();

    if (!message || aiIsTyping) return;

    const config = getAiConfig();
    if (!config.apiKey) {
        addAIMessage('ai', '请先在「设置 → AI 模型配置」中填写 API Key。');
        return;
    }

    addAIMessage('user', message);
    aiChatInput.value = '';
    aiChatInput.style.height = 'auto';

    showAITyping();

    try {
        const data = collectAllData();
        const analysis = dataAnalyzer.analyzeAll(data.events, data.weather, data.alarms);
        const systemPrompt = buildAISystemPrompt(analysis, data.weather);
        const contextMessage = buildAIContextMessage(data.events, data.todayEvents, data.weather);

        // 根据当前模式添加指令 prompt
        const modePrompt = AI_MODE_PROMPTS[currentAIMode] || AI_MODE_PROMPTS.balanced;
        const userMessage = modePrompt + message;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contextMessage },
            { role: 'user', content: userMessage }
        ];

        const response = await callAIAPI(messages, config);
        hideAITyping();
        addAIMessage('ai', response);
    } catch (error) {
        hideAITyping();
        addAIMessage('ai', 'AI 请求失败：' + error.message);
        console.error('AI 请求错误:', error);
    }
}

// 生成摘要（前端直接调用 AI API）
async function generateAISummary() {
    if (aiIsTyping) return;

    const config = getAiConfig();
    if (!config.apiKey) {
        addAIMessage('ai', '请先在「设置 → AI 模型配置」中填写 API Key。');
        return;
    }

    addAIMessage('user', '请生成今日日程摘要');
    showAITyping();

    try {
        const data = collectAllData();
        const analysis = dataAnalyzer.analyzeAll(data.events, data.weather, data.alarms);
        const systemPrompt = buildAISystemPrompt(analysis, data.weather);
        const contextMessage = buildAIContextMessage(data.events, data.todayEvents, data.weather);

        const prompt = `${contextMessage}

请为用户生成一份简洁的日程摘要（200字以内），包括：
1. 今日重点事项
2. 本周忙碌程度评估
3. 需要注意的时间冲突
4. 整体时间分配评价

用友好、专业的语气，让用户快速了解自己的时间状况。`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ];

        const response = await callAIAPI(messages, config);
        hideAITyping();
        addAIMessage('ai', response);
    } catch (error) {
        hideAITyping();
        addAIMessage('ai', '生成摘要失败：' + error.message);
        console.error('AI 摘要错误:', error);
    }
}

// 获取建议（前端直接调用 AI API）
async function getAISuggestions() {
    if (aiIsTyping) return;

    const config = getAiConfig();
    if (!config.apiKey) {
        addAIMessage('ai', '请先在「设置 → AI 模型配置」中填写 API Key。');
        return;
    }

    addAIMessage('user', '请给我一些时间管理建议');
    showAITyping();

    try {
        const data = collectAllData();
        const analysis = dataAnalyzer.analyzeAll(data.events, data.weather, data.alarms);
        const systemPrompt = buildAISystemPrompt(analysis, data.weather);
        const contextMessage = buildAIContextMessage(data.events, data.todayEvents, data.weather);

        const prompt = `${contextMessage}

请根据以上数据，主动为用户提供 3-5 条实用的建议，包括：
1. 今日日程优化建议
2. 时间管理改进点
3. 需要注意的事项（如冲突、高优先级任务等）
4. 天气相关的提醒（如果有影响）

请用简洁的列表形式呈现，每条建议不超过 2 句话。`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ];

        const response = await callAIAPI(messages, config);
        hideAITyping();
        addAIMessage('ai', response);
    } catch (error) {
        hideAITyping();
        addAIMessage('ai', '获取建议失败：' + error.message);
        console.error('AI 建议错误:', error);
    }
}

// 构建 AI 系统提示词
function buildAISystemPrompt(analysis, weather) {
    const now = new Date();
    const currentTime = now.toLocaleString('zh-CN');

    return `你是一个智能时间管理助手，专门为用户的"时空规划调度系统"提供智能分析和建议。

当前时间：${currentTime}

## 用户数据分析：

### 事件统计
- 总事件数：${analysis.totalEvents}
- 今日事件：${analysis.todayEvents.length} 个
- 本周事件：${analysis.weekEvents.length} 个
- 本月事件：${analysis.monthEvents.length} 个
- 高优先级事件（紧急度>=80%）：${analysis.highPriorityEvents.length} 个

### 闹钟状态
- 活跃闹钟：${analysis.activeAlarms} 个
- 下次闹钟：${analysis.nextAlarm || '无'}

### 天气信息
${weather ? `当前天气：${weather.description}，温度 ${weather.temperature}°C，湿度 ${weather.humidity}%` : '天气信息未获取'}

### 时间分析
- 本周已安排时间：${analysis.weekScheduledHours.toFixed(1)} 小时
- 平均每日事件数：${analysis.avgDailyEvents.toFixed(1)} 个
- 时间冲突：${analysis.conflicts.length > 0 ? `${analysis.conflicts.length} 个冲突` : '无冲突'}

### 标签分布
${Object.entries(analysis.tagDistribution).map(([tag, count]) => `- ${tag}: ${count} 个事件`).join('\n') || '无标签事件'}

## 你的职责：
1. 根据用户的日程安排提供优化建议
2. 分析时间分配是否合理
3. 检测时间冲突并提醒用户
4. 考虑天气因素对日程的影响
5. 用友好、专业的语气与用户交流
6. 提供具体的、可操作的建议

请用中文回答用户的问题，回答要简洁、实用、有温度。
重要：请不要使用任何 Markdown 格式（如 #、**、*、- 等符号），直接用纯文本分段回答即可。

## 页面控制指令
你可以在回复中使用以下指令来控制用户的页面，指令格式为 @指令名，可以放在回复的任意位置：

@scroll up - 向上滚动页面
@scroll down - 向下滚动页面
@scroll top - 滚动到页面顶部
@scroll bottom - 滚动到页面底部
@switch view day - 切换到日视图
@switch view week - 切换到周视图
@switch view month - 切换到月视图
@switch view year - 切换到年视图
@add event - 打开添加事件窗口
@open settings - 打开设置面板
@today - 跳转到今天

使用示例：用户问"帮我看看今天的安排"，你可以回复"好的，我来帮你查看今天的安排。@switch view day @scroll top"`;
}

// 构建 AI 上下文消息
function buildAIContextMessage(events, todayEvents, weather) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return `## 当前详细数据：

### 今日事件（${todayEvents.length} 个）
${todayEvents.map(e => {
    const start = new Date(e.start);
    const end = new Date(e.end);
    const startDateStr = start.toLocaleDateString('zh-CN', {month: 'numeric', day: 'numeric'});
    const endDateStr = end.toLocaleDateString('zh-CN', {month: 'numeric', day: 'numeric'});
    const startTimeStr = start.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
    const endTimeStr = end.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
    const isMultiDay = start.toDateString() !== end.toDateString();
    const timeRange = isMultiDay 
        ? `${startDateStr} ${startTimeStr} ~ ${endDateStr} ${endTimeStr}（跨${Math.ceil((end - start) / (24*60*60*1000))}天）`
        : `${startTimeStr} ~ ${endTimeStr}`;
    return `- ${e.name}（${timeRange}）紧急度: ${e.urgency}%${e.tag ? ` [${e.tag}]` : ''}${e.isRecurringInstance ? ' (周期性事件)' : ''}`;
}).join('\n') || '今天没有安排事件'}

### 所有事件列表
${events.map(e => {
    const start = new Date(e.start);
    const end = new Date(e.end);
    const startDateStr = start.toLocaleDateString('zh-CN');
    const endDateStr = end.toLocaleDateString('zh-CN');
    const startTimeStr = start.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
    const endTimeStr = end.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
    const isMultiDay = start.toDateString() !== end.toDateString();
    const timeRange = isMultiDay 
        ? `${startDateStr} ${startTimeStr} ~ ${endDateStr} ${endTimeStr}（跨${Math.ceil((end - start) / (24*60*60*1000))}天）`
        : `${startDateStr} ${startTimeStr} ~ ${endTimeStr}`;
    return `- ${e.name}（${timeRange}）紧急度: ${e.urgency}%${e.tag ? ` [${e.tag}]` : ''}${e.recurring ? ' (周期性: ' + (e.recurring.mode || 'weekly') + ')' : ''}`;
}).join('\n') || '暂无事件'}

### 近期高优先级事件
${events.filter(e => e.urgency >= 80).slice(0, 5).map(e => {
    const start = new Date(e.start);
    const end = new Date(e.end);
    const isMultiDay = start.toDateString() !== end.toDateString();
    const timeRange = isMultiDay 
        ? `${start.toLocaleDateString('zh-CN')} ~ ${end.toLocaleDateString('zh-CN')}`
        : start.toLocaleDateString('zh-CN');
    return `- ${e.name}: ${timeRange} 紧急度 ${e.urgency}%`;
}).join('\n') || '近期无高优先级事件'}

### 天气详情
${weather ? `地区：${weather.city || ''} ${weather.district || ''}\n天气：${weather.description}\n温度：${weather.temperature}°C` : '未获取天气信息'}`;
}

// 直接调用 AI API（前端）
async function callAIAPI(messages, config) {
    const provider = config.provider || 'openai';
    const apiKey = config.apiKey;
    const model = config.model || '';
    const baseUrl = config.baseUrl || '';

    switch (provider) {
        case 'openai':
            return await callOpenAI(messages, apiKey, model, baseUrl);
        case 'anthropic':
            return await callAnthropic(messages, apiKey, model);
        case 'qwen':
            return await callQwen(messages, apiKey, model);
        default:
            throw new Error(`不支持的 AI 提供商: ${provider}`);
    }
}

// CORS 代理列表（当直接请求被浏览器阻止时使用）
const CORS_PROXIES = [
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

// 带 CORS 代理回退的 fetch
async function fetchWithProxy(url, options) {
    // 先尝试直接请求
    try {
        const response = await fetch(url, options);
        if (response.ok || response.status < 500) return response;
    } catch (e) {
        // 直接请求失败，尝试代理
    }
    // 逐个尝试 CORS 代理
    for (const proxyFn of CORS_PROXIES) {
        try {
            const proxyUrl = proxyFn(url);
            const response = await fetch(proxyUrl, options);
            if (response.ok || response.status < 500) return response;
        } catch (e) {
            continue;
        }
    }
    throw new Error('所有请求方式均失败，请检查网络或 API 配置');
}

// 调用 OpenAI API
async function callOpenAI(messages, apiKey, model, baseUrl) {
    const url = (baseUrl || 'https://api.openai.com/v1') + '/chat/completions';
    const response = await fetchWithProxy(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model || 'gpt-4',
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI API 请求失败 (${response.status})`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// 调用 Anthropic API
async function callAnthropic(messages, apiKey, model) {
    const systemMsg = messages.find(m => m.role === 'system');
    const userMsgs = messages.filter(m => m.role !== 'system');

    const response = await fetchWithProxy('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: model || 'claude-3-sonnet-20240229',
            max_tokens: 1000,
            system: systemMsg ? systemMsg.content : '',
            messages: userMsgs.map(m => ({ role: m.role, content: m.content }))
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Anthropic API 请求失败 (${response.status})`);
    }

    const data = await response.json();
    return data.content[0].text;
}

// 调用通义千问 API
async function callQwen(messages, apiKey, model) {
    const response = await fetchWithProxy('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model || 'qwen-max',
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `通义千问 API 请求失败 (${response.status})`);
    }

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
    }
    throw new Error('通义千问返回格式异常');
}

// 收集所有数据
function collectAllData() {
    // 获取今天的开始和结束时间
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // 使用 getEventsInRange 自动展开周期性事件
    const todayEvents = getEventsInRange(today, tomorrow);
    
    const eventsData = events.map(e => ({
        name: e.name,
        description: e.description,
        start: e.start,
        end: e.end,
        urgency: e.urgency,
        tag: e.tag
    }));

    let weatherData = null;
    const weatherTemp = document.getElementById('weatherTemp')?.textContent;
    const weatherDesc = document.getElementById('weatherDesc')?.textContent;
    const weatherCity = document.getElementById('weatherCity')?.textContent;
    const weatherDistrict = document.getElementById('weatherDistrict')?.textContent;

    if (weatherTemp && weatherTemp !== '--°C') {
        weatherData = {
            temperature: weatherTemp.replace('°C', ''),
            description: weatherDesc,
            city: weatherCity,
            district: weatherDistrict
        };
    }

    const alarmsData = (typeof alarms !== 'undefined' ? alarms : []).map(a => ({
        time: a.time,
        enabled: a.enabled,
        repeat: a.repeat
    }));

    return { events: eventsData, todayEvents: todayEvents, weather: weatherData, alarms: alarmsData };
}

// 清理 AI 回复中的 Markdown 格式符号
function cleanMarkdown(text) {
    return text
        // 移除标题符号 #
        .replace(/^#{1,6}\s+/gm, '')
        // 移除粗体 ** 和 __
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        // 移除斜体 * 和 _
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/_(.+?)_/g, '$1')
        // 移除列表符号
        .replace(/^[\s]*[-*+]\s+/gm, '')
        // 移除行内代码 `
        .replace(/`(.+?)`/g, '$1')
        // 移除多余空行
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// 添加消息到聊天界面
function addAIMessage(sender, content) {
    const aiChatMessages = document.getElementById('aiChatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-message ${sender === 'user' ? 'user' : 'ai-assistant'}`;

    let displayContent = content;

    // 解析并执行页面控制指令（在清理 Markdown 之前执行，确保 @ 指令不被破坏）
    if (sender === 'ai-assistant') {
        executePageCommands(content);
        // 从显示内容中移除指令
        displayContent = content.replace(/@\w+(?:\s+\w+)*/g, '').trim();
    }

    // AI 回复清理 Markdown 格式
    displayContent = sender === 'ai-assistant' ? cleanMarkdown(displayContent) : displayContent;

    const formattedContent = displayContent
        .split('\n')
        .filter(line => line.trim())
        .map(line => `<p>${line}</p>`)
        .join('');

    messageDiv.innerHTML = `<div class="ai-message-content">${formattedContent}</div>`;

    aiChatMessages.appendChild(messageDiv);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

    aiChatHistory.push({ sender, content });
    saveAIChatHistory();
}

// 执行页面控制指令（通过关键词自动检测）
function executePageCommands(content) {
    const lowerContent = content.toLowerCase();
    
    // 滚动控制
    if (lowerContent.includes('向上滚动') || lowerContent.includes('往上滚') || lowerContent.includes('scroll up')) {
        window.scrollBy({ top: -300, behavior: 'smooth' });
    }
    if (lowerContent.includes('向下滚动') || lowerContent.includes('往下滚') || lowerContent.includes('scroll down')) {
        window.scrollBy({ top: 300, behavior: 'smooth' });
    }
    if (lowerContent.includes('滚动到顶部') || lowerContent.includes('回到顶部') || lowerContent.includes('scroll top')) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (lowerContent.includes('滚动到底部') || lowerContent.includes('去底部') || lowerContent.includes('scroll bottom')) {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
    
    // 视图切换
    if (lowerContent.includes('切换到日视图') || lowerContent.includes('日视图') || lowerContent.includes('switch view day')) {
        const viewBtn = document.querySelector('.view-btn[data-view="day"]');
        if (viewBtn) viewBtn.click();
    }
    if (lowerContent.includes('切换到周视图') || lowerContent.includes('周视图') || lowerContent.includes('switch view week')) {
        const viewBtn = document.querySelector('.view-btn[data-view="week"]');
        if (viewBtn) viewBtn.click();
    }
    if (lowerContent.includes('切换到月视图') || lowerContent.includes('月视图') || lowerContent.includes('switch view month')) {
        const viewBtn = document.querySelector('.view-btn[data-view="month"]');
        if (viewBtn) viewBtn.click();
    }
    if (lowerContent.includes('切换到年视图') || lowerContent.includes('年视图') || lowerContent.includes('switch view year')) {
        const viewBtn = document.querySelector('.view-btn[data-view="year"]');
        if (viewBtn) viewBtn.click();
    }
    
    // 添加事件
    if (lowerContent.includes('添加事件') || lowerContent.includes('新建事件') || lowerContent.includes('add event')) {
        const addEventBtn = document.getElementById('addEventBtn');
        if (addEventBtn) addEventBtn.click();
    }
    
    // 打开设置
    if (lowerContent.includes('打开设置') || lowerContent.includes('设置面板') || lowerContent.includes('open settings')) {
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) settingsBtn.click();
    }
    
    // 跳转到今天
    if (lowerContent.includes('今天') && (lowerContent.includes('跳转') || lowerContent.includes('回到') || lowerContent.includes('@today'))) {
        currentDate = new Date();
        currentMonth = currentDate.getMonth();
        currentYear = currentDate.getFullYear();
        selectedDate = new Date();
        renderCalendar();
        updateViewStartDate();
        renderGanttChart();
    }
}

// 保存聊天记录到 localStorage
function saveAIChatHistory() {
    try {
        // 只保留最近 100 条消息
        const toSave = aiChatHistory.slice(-100);
        localStorage.setItem('aiChatHistory', JSON.stringify(toSave));
    } catch (e) {
        // localStorage 满了就清理旧消息
        aiChatHistory = aiChatHistory.slice(-50);
        localStorage.setItem('aiChatHistory', JSON.stringify(aiChatHistory));
    }
}

// 从 localStorage 加载聊天记录
function loadAIChatHistory() {
    try {
        const saved = localStorage.getItem('aiChatHistory');
        if (saved) {
            aiChatHistory = JSON.parse(saved);
            const aiChatMessages = document.getElementById('aiChatMessages');
            aiChatMessages.innerHTML = '';
            aiChatHistory.forEach(msg => {
                const messageDiv = document.createElement('div');
                messageDiv.className = `ai-message ${msg.sender === 'user' ? 'user' : 'ai-assistant'}`;
                const displayContent = msg.sender === 'ai-assistant' ? cleanMarkdown(msg.content) : msg.content;
                const formattedContent = displayContent
                    .split('\n')
                    .filter(line => line.trim())
                    .map(line => `<p>${line}</p>`)
                    .join('');
                messageDiv.innerHTML = `<div class="ai-message-content">${formattedContent}</div>`;
                aiChatMessages.appendChild(messageDiv);
            });
            aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
        }
    } catch (e) {
        console.error('加载聊天记录失败:', e);
    }
}

// 清除聊天记录
function clearAIChatHistory() {
    if (confirm('确定要清除所有聊天记录吗？')) {
        aiChatHistory = [];
        localStorage.removeItem('aiChatHistory');
        document.getElementById('aiChatMessages').innerHTML = '';
    }
}

// 显示打字指示器
function showAITyping() {
    aiIsTyping = true;
    const aiChatMessages = document.getElementById('aiChatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'ai-message ai-assistant';
    typingDiv.id = 'aiTypingIndicator';
    typingDiv.innerHTML = `
        <div class="ai-message-content">
            <div class="ai-typing">
                <div class="ai-typing-dot"></div>
                <div class="ai-typing-dot"></div>
                <div class="ai-typing-dot"></div>
            </div>
        </div>
    `;
    aiChatMessages.appendChild(typingDiv);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
    document.getElementById('aiSendBtn').disabled = true;
}

// 隐藏打字指示器
function hideAITyping() {
    aiIsTyping = false;
    const typingIndicator = document.getElementById('aiTypingIndicator');
    if (typingIndicator) typingIndicator.remove();
    document.getElementById('aiSendBtn').disabled = false;
}

// ==================== 导出 Excel 功能 ====================

function exportToExcel() {
    if (typeof XLSX === 'undefined') {
        alert('Excel 导出库未加载，请检查网络连接后刷新页面。');
        return;
    }

    if (events.length === 0) {
        alert('当前没有事件可导出。');
        return;
    }

    // 准备导出数据
    const exportData = events.map((e, index) => {
        const isRecurring = !!e.recurring;
        const recurringModeMap = { weekly: '按周循环', monthly: '按月循环', custom: '自定义日期范围' };
        return {
            '序号': index + 1,
            '事件名称': e.name,
            '描述': e.description || '',
            '开始时间': formatDateTime(e.start),
            '结束时间': formatDateTime(e.end),
            '紧急程度': e.urgency + '%',
            '标签': e.tag || '未分类',
            '持续时间(分钟)': calculateDuration(e.start, e.end),
            '是否周期性': isRecurring ? '是' : '否',
            '循环模式': isRecurring ? (recurringModeMap[e.recurring.mode] || e.recurring.mode) : '',
            '周期结束日期': isRecurring && e.recurring.endDate ? e.recurring.endDate : ''
        };
    });

    // 创建工作簿
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // 设置列宽
    ws['!cols'] = [
        { wch: 6 },   // 序号
        { wch: 25 },  // 事件名称
        { wch: 30 },  // 描述
        { wch: 20 },  // 开始时间
        { wch: 20 },  // 结束时间
        { wch: 10 },  // 紧急程度
        { wch: 12 },  // 标签
        { wch: 14 },  // 持续时间
        { wch: 12 },  // 是否周期性
        { wch: 16 },  // 循环模式
        { wch: 16 }   // 周期结束日期
    ];

    // 添加工作表
    XLSX.utils.book_append_sheet(wb, ws, '事件列表');

    // 生成文件名（带时间戳）
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `时空规划事件_${timestamp}.xlsx`;

    // 下载文件
    XLSX.writeFile(wb, filename);
}

// 格式化日期时间
function formatDateTime(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 计算持续时间（分钟）
function calculateDuration(startStr, endStr) {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diff = (end - start) / (1000 * 60);
    return Math.round(diff);
}

// ==================== 导入 Excel 功能 ====================

function importFromExcel(file) {
    if (typeof XLSX === 'undefined') {
        alert('Excel 导入库未加载，请检查网络连接后刷新页面。');
        return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });

            // 读取第一个工作表
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

            if (jsonData.length === 0) {
                alert('文件中没有数据。');
                return;
            }

            // 解析并验证数据
            const newEvents = [];
            const errors = [];

            jsonData.forEach((row, index) => {
                const rowNum = index + 2; // Excel 行号（从1开始，加1是因为有表头）

                // 尝试匹配列名（支持中英文）
                const name = row['事件名称'] || row['name'] || row['名称'] || row['Name'] || '';
                const description = row['描述'] || row['description'] || row['Description'] || '';
                const startRaw = row['开始时间'] || row['start'] || row['Start'] || row['开始'] || '';
                const endRaw = row['结束时间'] || row['end'] || row['End'] || row['结束'] || '';
                const urgencyRaw = row['紧急程度'] || row['urgency'] || row['Urgency'] || row['紧急度'] || '50';
                const tag = row['标签'] || row['tag'] || row['Tag'] || row['分类'] || '';
                const isRecurringRaw = row['是否周期性'] || row['recurring'] || row['Recurring'] || '';
                const recurringModeRaw = row['循环模式'] || row['mode'] || row['Mode'] || '';
                const recurringEndDateRaw = row['周期结束日期'] || row['endDate'] || row['EndDate'] || '';

                // 验证必填字段
                if (!name) {
                    errors.push(`第 ${rowNum} 行：缺少事件名称`);
                    return;
                }

                // 解析时间
                const start = parseImportDate(startRaw);
                const end = parseImportDate(endRaw);

                if (!start) {
                    errors.push(`第 ${rowNum} 行：开始时间格式无效（"${startRaw}"）`);
                    return;
                }
                if (!end) {
                    errors.push(`第 ${rowNum} 行：结束时间格式无效（"${endRaw}"）`);
                    return;
                }
                if (end <= start) {
                    errors.push(`第 ${rowNum} 行：结束时间必须晚于开始时间`);
                    return;
                }

                // 解析紧急程度
                let urgency = parseInt(String(urgencyRaw).replace('%', '').trim());
                if (isNaN(urgency) || urgency < 0) urgency = 50;
                if (urgency > 100) urgency = 100;

                // 解析周期性配置
                const isRecurring = String(isRecurringRaw).trim() === '是';
                let recurringConfig = null;
                if (isRecurring) {
                    const modeMap = { '按周循环': 'weekly', '按月循环': 'monthly', '自定义日期范围': 'custom' };
                    const mode = modeMap[String(recurringModeRaw).trim()] || String(recurringModeRaw).trim() || 'weekly';
                    const endDate = recurringEndDateRaw ? String(recurringEndDateRaw).trim() : null;
                    recurringConfig = { mode, endDate };
                }

                newEvents.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    name: String(name).trim(),
                    description: String(description).trim(),
                    start: start.toISOString(),
                    end: end.toISOString(),
                    urgency: urgency,
                    tag: String(tag).trim(),
                    recurring: recurringConfig
                });
            });

            // 显示结果
            if (errors.length > 0) {
                const errorList = errors.slice(0, 10).join('\n');
                const moreMsg = errors.length > 10 ? `\n...还有 ${errors.length - 10} 个错误` : '';
                const proceed = confirm(
                    `导入过程中发现 ${errors.length} 个问题：\n\n${errorList}${moreMsg}\n\n是否继续导入 ${newEvents.length} 条有效事件？`
                );
                if (!proceed) return;
            }

            if (newEvents.length === 0) {
                alert('没有可导入的有效事件。');
                return;
            }

            // 确认导入方式
            const mode = confirm(
                `共解析出 ${newEvents.length} 条事件。\n\n` +
                `点击「确定」：追加到现有事件\n` +
                `点击「取消」：替换所有现有事件`
            );

            if (mode) {
                // 追加模式
                events = events.concat(newEvents);
            } else {
                // 替换模式
                events = newEvents;
            }

            // 保存到本地存储
            localStorage.setItem('scheduleEvents', JSON.stringify(events));

            // 刷新甘特图
            renderGanttChart();

            alert(`成功导入 ${newEvents.length} 条事件！`);

        } catch (error) {
            console.error('导入错误:', error);
            alert('文件解析失败：' + error.message + '\n\n请确保文件格式正确（.xlsx / .xls / .csv）');
        }
    };

    reader.onerror = () => {
        alert('文件读取失败，请重试。');
    };

    reader.readAsArrayBuffer(file);
}

// 解析导入的日期时间（支持多种格式）
function parseImportDate(value) {
    if (!value) return null;

    // 如果已经是 Date 对象（SheetJS 的 cellDates 选项）
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
    }

    const str = String(value).trim();

    // 尝试多种格式
    const formats = [
        // ISO 格式: 2026-06-19T14:30:00.000Z
        str,
        // 中文格式: 2026-06-19 14:30
        str.replace(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/, '$1-$2-$3T$4:$5:00'),
        // 斜杠格式: 2026/06/19 14:30
        str.replace(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/, '$1-$2-$3T$4:$5:00'),
        // 仅日期: 2026-06-19
        str.includes('-') && !str.includes(':') ? str + 'T09:00:00' : null,
        // Excel 序列号（数字）
        typeof value === 'number' ? new Date((value - 25569) * 86400 * 1000).toISOString() : null
    ];

    for (const fmt of formats) {
        if (!fmt) continue;
        const date = new Date(fmt);
        if (!isNaN(date.getTime())) return date;
    }

    return null;
}

// ==================== 语音搜索功能 ====================

// 语音搜索配置
let voiceConfig = {
    shortcut: localStorage.getItem('voiceShortcut') || 'Ctrl+Shift+V',
    duration: parseInt(localStorage.getItem('voiceDuration')) || 10,
    autoStop: localStorage.getItem('voiceAutoStop') === 'true'
};

// 语音识别相关变量
let recognition = null;
let isListening = false;
let voiceTimer = null;
let voiceStartTime = null;
let silenceTimer = null;
let lastVoiceTime = 0;

// 初始化语音搜索
function initVoiceSearch() {
    const voiceBtn = document.getElementById('aiVoiceBtn');
    const voiceStopBtn = document.getElementById('voiceStopBtn');
    const voiceShortcutInput = document.getElementById('voiceShortcut');
    const voiceDurationInput = document.getElementById('voiceDuration');
    const voiceAutoStopCheckbox = document.getElementById('voiceAutoStop');
    const saveVoiceConfigBtn = document.getElementById('saveVoiceConfigBtn');
    const resetVoiceShortcutBtn = document.getElementById('resetVoiceShortcutBtn');

    if (!voiceBtn) return;

    // 加载语音配置
    loadVoiceConfig();

    // 检查浏览器是否支持语音识别
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        voiceBtn.disabled = true;
        voiceBtn.title = '浏览器不支持语音识别';
        voiceBtn.style.opacity = '0.5';
        voiceBtn.style.cursor = 'not-allowed';
        return;
    }

    // 创建语音识别实例
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    recognition.onstart = () => {
        isListening = true;
        voiceBtn.classList.add('listening');
        document.getElementById('voiceStatusBar').classList.add('active');
        voiceStartTime = Date.now();
        lastVoiceTime = Date.now();
        updateVoiceTimer();
    };

    recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        if (finalTranscript) {
            const aiChatInput = document.getElementById('aiChatInput');
            aiChatInput.value = finalTranscript;
            stopVoiceListening();
            sendAIMessage();
        }

        lastVoiceTime = Date.now();
    };

    recognition.onerror = (event) => {
        console.error('语音识别错误:', event.error);
        if (event.error === 'no-speech') {
            // 无语音输入，继续监听
        } else {
            stopVoiceListening();
        }
    };

    recognition.onend = () => {
        if (isListening) {
            // 如果仍在监听状态，重新启动（某些浏览器会自动停止）
            try {
                recognition.start();
            } catch (e) {
                stopVoiceListening();
            }
        }
    };

    // 点击语音按钮
    voiceBtn.addEventListener('click', () => {
        if (isListening) {
            stopVoiceListening();
        } else {
            startVoiceListening();
        }
    });

    // 点击停止按钮
    if (voiceStopBtn) {
        voiceStopBtn.addEventListener('click', () => {
            stopVoiceListening();
        });
    }

    // 快捷键设置输入框
    if (voiceShortcutInput) {
        voiceShortcutInput.addEventListener('keydown', (e) => {
            e.preventDefault();
            const keys = [];
            if (e.ctrlKey) keys.push('Ctrl');
            if (e.shiftKey) keys.push('Shift');
            if (e.altKey) keys.push('Alt');
            if (e.metaKey) keys.push('Meta');
            
            // 添加主键
            if (e.key && !['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
                keys.push(e.key.toUpperCase());
            }
            
            if (keys.length > 0) {
                voiceShortcutInput.value = keys.join('+');
            }
        });
    }

    // 自动停止复选框变化
    if (voiceAutoStopCheckbox) {
        voiceAutoStopCheckbox.addEventListener('change', () => {
            if (voiceDurationInput) {
                voiceDurationInput.disabled = voiceAutoStopCheckbox.checked;
            }
        });
    }

    // 保存语音配置
    if (saveVoiceConfigBtn) {
        saveVoiceConfigBtn.addEventListener('click', () => {
            voiceConfig.shortcut = voiceShortcutInput.value || 'Ctrl+Shift+V';
            voiceConfig.duration = parseInt(voiceDurationInput.value) || 10;
            voiceConfig.autoStop = voiceAutoStopCheckbox.checked;
            
            localStorage.setItem('voiceShortcut', voiceConfig.shortcut);
            localStorage.setItem('voiceDuration', voiceConfig.duration);
            localStorage.setItem('voiceAutoStop', voiceConfig.autoStop);
            
            alert('语音搜索配置已保存！');
        });
    }

    // 重置快捷键
    if (resetVoiceShortcutBtn) {
        resetVoiceShortcutBtn.addEventListener('click', () => {
            voiceShortcutInput.value = 'Ctrl+Shift+V';
        });
    }

    // 全局快捷键监听
    document.addEventListener('keydown', (e) => {
        const keys = [];
        if (e.ctrlKey) keys.push('Ctrl');
        if (e.shiftKey) keys.push('Shift');
        if (e.altKey) keys.push('Alt');
        if (e.metaKey) keys.push('Meta');
        if (e.key && !['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
            keys.push(e.key.toUpperCase());
        }
        
        const currentShortcut = keys.join('+');
        if (currentShortcut === voiceConfig.shortcut) {
            e.preventDefault();
            if (isListening) {
                stopVoiceListening();
            } else {
                startVoiceListening();
            }
        }
    });
}

// 开始语音监听
function startVoiceListening() {
    if (!recognition || isListening) return;
    
    try {
        recognition.start();
    } catch (e) {
        console.error('启动语音识别失败:', e);
    }
}

// 停止语音监听
function stopVoiceListening() {
    isListening = false;
    if (recognition) {
        try {
            recognition.stop();
        } catch (e) {
            console.error('停止语音识别失败:', e);
        }
    }
    
    const voiceBtn = document.getElementById('aiVoiceBtn');
    if (voiceBtn) {
        voiceBtn.classList.remove('listening');
    }
    
    document.getElementById('voiceStatusBar').classList.remove('active');
    
    if (voiceTimer) {
        clearInterval(voiceTimer);
        voiceTimer = null;
    }
    
    if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
    }
}

// 更新语音计时器
function updateVoiceTimer() {
    if (!isListening) return;
    
    const elapsed = Math.floor((Date.now() - voiceStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timerEl = document.getElementById('voiceTimer');
    if (timerEl) {
        timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // 检查是否超过最大时长
    if (elapsed >= voiceConfig.duration) {
        stopVoiceListening();
        return;
    }
    
    // 检查是否启用自动停止
    if (voiceConfig.autoStop) {
        const silenceDuration = Date.now() - lastVoiceTime;
        if (silenceDuration > 3000) { // 3秒无声音则停止
            stopVoiceListening();
            return;
        }
    }
    
    voiceTimer = setTimeout(updateVoiceTimer, 100);
}

// 加载语音配置
function loadVoiceConfig() {
    const voiceShortcutInput = document.getElementById('voiceShortcut');
    const voiceDurationInput = document.getElementById('voiceDuration');
    const voiceAutoStopCheckbox = document.getElementById('voiceAutoStop');
    
    if (voiceShortcutInput) {
        voiceShortcutInput.value = voiceConfig.shortcut;
    }
    if (voiceDurationInput) {
        voiceDurationInput.value = voiceConfig.duration;
        voiceDurationInput.disabled = voiceConfig.autoStop;
    }
    if (voiceAutoStopCheckbox) {
        voiceAutoStopCheckbox.checked = voiceConfig.autoStop;
    }
}
