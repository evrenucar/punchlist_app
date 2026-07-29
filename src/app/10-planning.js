    function hasOwn(object, key) {
      return Boolean(object && Object.hasOwn(object, key));
    }

    function durationToSeconds(value, unit) {
      const amount = Math.max(0, Math.floor(Number(value) || 0));
      return amount * (DURATION_UNIT_SECONDS[unit] || 1);
    }

    function secondsToDurationParts(seconds) {
      const total = Math.max(0, Math.floor(Number(seconds) || 0));
      for (const unit of ["days", "hours", "minutes"]) {
        const factor = DURATION_UNIT_SECONDS[unit];
        if (total >= factor && total % factor === 0) return { value: total / factor, unit };
      }
      return { value: total, unit: "seconds" };
    }

    function localDateString(date = new Date()) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    function describeRelativeDate(dateStr, now = new Date()) {
      if (!SCHEDULE_DATE_PATTERN.test(String(dateStr || ""))) return "";
      const [year, month, day] = String(dateStr).split("-").map(Number);
      const target = new Date(year, month - 1, day);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const days = Math.round((target - today) / 86400000);
      if (days === 0) return "today";
      if (days === 1) return "tomorrow";
      if (days === -1) return "yesterday";
      return days > 0 ? `in ${days} days` : `${-days} days ago`;
    }

    function describeRelativeDateTime(value, now = new Date()) {
      const at = Date.parse(value);
      if (!Number.isFinite(at)) return "";
      const target = new Date(at);
      const dayLabel = describeRelativeDate(localDateString(target), now);
      const time = `${String(target.getHours()).padStart(2, "0")}:${String(target.getMinutes()).padStart(2, "0")}`;
      return dayLabel ? `${dayLabel} at ${time}` : time;
    }

    function timelineTimeFromOffset(offsetPx) {
      const maxOffset = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60 - TIMELINE_SNAP_MINUTES;
      const snapped = Math.min(maxOffset, Math.max(0, Math.round((Number(offsetPx) || 0) / TIMELINE_SNAP_MINUTES) * TIMELINE_SNAP_MINUTES));
      const total = TIMELINE_START_HOUR * 60 + snapped;
      return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    }

    function setTaskSchedule(id, patch = {}) {
      const found = findTask(id);
      if (!found) return false;
      const item = resolveTaskItem(found.item);
      const clean = (value) => (value === "" || value === undefined ? null : value);
      const current = item.schedule || {};
      const nextDate = hasOwn(patch, "date") ? clean(patch.date) : current.date ?? null;
      const nextStart = hasOwn(patch, "startTime") ? clean(patch.startTime) : current.startTime ?? null;
      if (nextDate !== null && !SCHEDULE_DATE_PATTERN.test(String(nextDate))) return false;
      if (nextStart !== null && !SCHEDULE_TIME_PATTERN.test(String(nextStart))) return false;
      let nextPlanned = item.plannedMinutes;
      if (hasOwn(patch, "plannedMinutes")) {
        const raw = clean(patch.plannedMinutes);
        if (raw === null) nextPlanned = null;
        else {
          const minutes = Number(raw);
          if (!Number.isFinite(minutes) || minutes <= 0) return false;
          nextPlanned = Math.round(minutes);
        }
      }
      let nextReminder = item.reminderAt;
      if (hasOwn(patch, "reminderAt")) {
        const raw = clean(patch.reminderAt);
        if (raw !== null && !Number.isFinite(Date.parse(raw))) return false;
        nextReminder = raw;
      }
      item.schedule = nextDate === null && nextStart === null ? null : { date: nextDate, startTime: nextStart };
      item.plannedMinutes = nextPlanned;
      if (nextReminder !== item.reminderAt) {
        item.reminderAt = nextReminder;
        announcedReminders.delete(item.id);
      }
      saveState();
      return true;
    }

    function getTimelineEntries(date) {
      const scheduled = [];
      const unscheduled = [];
      function walk(tasks, group) {
        (tasks || []).forEach((placement) => {
          if (!placement.linkType && placement.schedule?.date === date) {
            if (placement.schedule.startTime) {
              const [hours, minutes] = placement.schedule.startTime.split(":").map(Number);
              scheduled.push({
                item: placement,
                group,
                startMinutes: hours * 60 + minutes,
                durationMinutes: Number(placement.plannedMinutes) > 0 ? Number(placement.plannedMinutes) : null,
              });
            } else {
              unscheduled.push({ item: placement, group });
            }
          }
          walk(placement.children, group);
        });
      }
      state.groups.forEach((group) => walk(group.tasks, group));
      scheduled.sort((a, b) => a.startMinutes - b.startMinutes);
      return { scheduled, unscheduled };
    }

    function getEffortVariance(item) {
      const planned = Number(item?.plannedMinutes);
      if (!Number.isFinite(planned) || planned <= 0) return null;
      const focus = Math.max(0, Number(item?.focusSeconds) || 0);
      const seconds = focus - planned * 60;
      const minutes = Math.round(Math.abs(seconds) / 60);
      const label = seconds === 0 ? "0m" : `${seconds > 0 ? "+" : "-"}${minutes}m`;
      return { seconds, label };
    }

    function isReminderDue(placement, now = Date.now()) {
      const item = resolveTaskItem(placement);
      if (!item || item.done || !item.reminderAt) return false;
      const at = Date.parse(item.reminderAt);
      return Number.isFinite(at) && now >= at;
    }

    function getDueReminders(now = Date.now()) {
      if (!state.settings.reminders) return [];
      const due = [];
      function walk(tasks, group) {
        (tasks || []).forEach((placement) => {
          if (!placement.linkType && isReminderDue(placement, now) && !announcedReminders.has(placement.id)) {
            announcedReminders.add(placement.id);
            due.push({ item: placement, group });
          }
          walk(placement.children, group);
        });
      }
      state.groups.forEach((group) => walk(group.tasks, group));
      return due;
    }

