class DataAnalyzer {
  constructor() {}

  // 分析所有数据
  analyzeAll(events, weather, alarms) {
    const now = new Date();
    
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

  // 获取今日事件
  getTodayEvents(events) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return events.filter(e => {
      const eventStart = new Date(e.start);
      return eventStart >= today && eventStart < tomorrow;
    });
  }

  // 获取本周事件
  getWeekEvents(events) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    return events.filter(e => {
      const eventStart = new Date(e.start);
      return eventStart >= weekStart && eventStart < weekEnd;
    });
  }

  // 获取本月事件
  getMonthEvents(events) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return events.filter(e => {
      const eventStart = new Date(e.start);
      return eventStart >= monthStart && eventStart < monthEnd;
    });
  }

  // 获取高优先级事件
  getHighPriorityEvents(events) {
    return events.filter(e => e.urgency >= 80);
  }

  // 获取活跃闹钟数量
  getActiveAlarms(alarms) {
    if (!alarms || !Array.isArray(alarms)) return 0;
    return alarms.filter(a => a.enabled).length;
  }

  // 获取下次闹钟时间
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

      // 如果今天的闹钟时间已过，设置为明天
      if (alarmDate < now) {
        alarmDate.setDate(alarmDate.getDate() + 1);
      }

      const diff = alarmDate - now;
      if (diff < minDiff) {
        minDiff = diff;
        nextAlarm = alarmDate;
      }
    });

    return nextAlarm ? nextAlarm.toLocaleString('zh-CN') : null;
  }

  // 计算本周已安排时间（小时）
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

  // 计算平均每日事件数
  calculateAvgDailyEvents(events) {
    if (events.length === 0) return 0;

    const dates = new Set();
    events.forEach(e => {
      const date = new Date(e.start).toDateString();
      dates.add(date);
    });

    return events.length / dates.size;
  }

  // 检测时间冲突
  detectConflicts(events) {
    const conflicts = [];
    
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const e1 = events[i];
        const e2 = events[j];
        
        const e1Start = new Date(e1.start);
        const e1End = new Date(e1.end);
        const e2Start = new Date(e2.start);
        const e2End = new Date(e2.end);

        // 检查是否重叠
        if (e1Start < e2End && e2Start < e1End) {
          conflicts.push({
            event1: e1.name,
            event2: e2.name,
            overlap: this.calculateOverlap(e1Start, e1End, e2Start, e2End)
          });
        }
      }
    }

    return conflicts;
  }

  // 计算重叠时间
  calculateOverlap(start1, end1, start2, end2) {
    const overlapStart = new Date(Math.max(start1, start2));
    const overlapEnd = new Date(Math.min(end1, end2));
    
    if (overlapStart >= overlapEnd) return 0;
    
    return (overlapEnd - overlapStart) / (1000 * 60); // 返回分钟数
  }

  // 获取标签分布
  getTagDistribution(events) {
    const distribution = {};
    
    events.forEach(e => {
      const tag = e.tag || '未分类';
      distribution[tag] = (distribution[tag] || 0) + 1;
    });

    return distribution;
  }

  // 获取时间分布（按小时）
  getTimeDistribution(events) {
    const distribution = new Array(24).fill(0);
    
    events.forEach(e => {
      const hour = new Date(e.start).getHours();
      distribution[hour]++;
    });

    return distribution;
  }

  // 获取忙碌天数（事件数>=5的天数）
  getBusyDays(events) {
    const dayCounts = {};
    
    events.forEach(e => {
      const date = new Date(e.start).toDateString();
      dayCounts[date] = (dayCounts[date] || 0) + 1;
    });

    return Object.values(dayCounts).filter(count => count >= 5).length;
  }
}

module.exports = new DataAnalyzer();
