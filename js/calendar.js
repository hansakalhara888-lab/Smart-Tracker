onAppReady(() => {
  const grid = document.getElementById('cal-grid');
  const monthTitle = document.getElementById('cal-month-title');
  const todayLabel = document.getElementById('cal-today-label');
  const eventList = document.getElementById('event-list');
  const form = document.getElementById('event-form');
  const enableNotifBtn = document.getElementById('enable-notifications');

  let viewYear, viewMonth; // 0-based month

  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();

  todayLabel.textContent =
    'Today: ' +
    now.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

  // Default event date = today
  document.getElementById('ev-date').value = now.toISOString().slice(0, 10);

  function ymd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function renderCalendar() {
    const first = new Date(viewYear, viewMonth, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const todayStr = ymd(new Date());

    monthTitle.textContent = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const events = getCalendarEvents();
    const byDate = {};
    events.forEach((ev) => {
      if (!ev.date) return;
      if (!byDate[ev.date]) byDate[ev.date] = [];
      byDate[ev.date].push(ev);
    });

    grid.innerHTML = '';

    for (let i = 0; i < startPad; i++) {
      const cell = document.createElement('div');
      cell.className = 'cal-cell empty';
      grid.appendChild(cell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('div');
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cell.className = 'cal-cell';
      if (dateStr === todayStr) cell.classList.add('today');
      if (byDate[dateStr]) cell.classList.add('has-event');

      const num = document.createElement('div');
      num.className = 'cal-day-num';
      num.textContent = day;
      cell.appendChild(num);

      if (byDate[dateStr]) {
        byDate[dateStr].slice(0, 2).forEach((ev) => {
          const dot = document.createElement('div');
          dot.className = 'cal-event-chip' + (ev.type === 'bill' ? ' bill' : '');
          dot.textContent = ev.title;
          dot.title = `${ev.title} @ ${ev.time || ''}`;
          cell.appendChild(dot);
        });
        if (byDate[dateStr].length > 2) {
          const more = document.createElement('div');
          more.className = 'cal-event-more';
          more.textContent = `+${byDate[dateStr].length - 2} more`;
          cell.appendChild(more);
        }
      }

      cell.addEventListener('click', () => {
        document.getElementById('ev-date').value = dateStr;
      });

      grid.appendChild(cell);
    }

    renderEventList();
  }

  function renderEventList() {
    const events = getCalendarEvents()
      .slice()
      .sort((a, b) => {
        const da = `${a.date}T${a.time || '00:00'}`;
        const db = `${b.date}T${b.time || '00:00'}`;
        return da.localeCompare(db);
      });

    eventList.innerHTML = '';
    if (!events.length) {
      eventList.innerHTML = '<li style="color:var(--text-muted);">No events yet. Add one above or pay a monthly bill from the Dashboard.</li>';
      return;
    }

    const todayStr = ymd(new Date());

    events.forEach((ev) => {
      const li = document.createElement('li');
      li.className = 'event-item' + (ev.type === 'bill' ? ' is-bill' : '');
      const past = ev.date < todayStr;
      li.innerHTML = `
        <div class="event-item-main">
          <strong>${ev.title}</strong>
          ${ev.type === 'bill' ? '<span class="badge-bill">Bill</span>' : ''}
          ${ev.recurring ? '<span class="badge-recur">Monthly</span>' : ''}
          <div class="event-meta">
            📅 ${ev.date} · ⏰ ${ev.time || '—'}
            · Remind ${ev.remindMinutes == 0 ? 'at time' : ev.remindMinutes + ' min before'}
            ${past ? ' · <em>past</em>' : ''}
          </div>
          ${ev.description ? `<div class="event-desc">${ev.description}</div>` : ''}
          ${ev.amount != null ? `<div class="event-desc">Amount: ${formatMoney(ev.amount)}</div>` : ''}
        </div>
        <div class="event-actions">
          <button type="button" class="btn-edit-ev" data-id="${ev.id}">Edit</button>
          <button type="button" class="btn-del-ev" data-id="${ev.id}">Delete</button>
        </div>
      `;
      eventList.appendChild(li);
    });

    eventList.querySelectorAll('.btn-del-ev').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        if (!confirm('Delete this event?')) return;
        setCalendarEvents(getCalendarEvents().filter((e) => e.id !== id));
        renderCalendar();
      });
    });

    eventList.querySelectorAll('.btn-edit-ev').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const ev = getCalendarEvents().find((e) => e.id === id);
        if (!ev) return;
        const newTime = prompt('Reminder time (HH:MM, 24h):', ev.time || '09:00');
        if (newTime === null) return;
        if (!/^\d{2}:\d{2}$/.test(newTime)) {
          alert('Use format HH:MM, e.g. 09:30');
          return;
        }
        const remind = prompt('Remind how many minutes before? (0, 15, 30, 60, 1440)', String(ev.remindMinutes ?? 30));
        if (remind === null) return;
        const events = getCalendarEvents();
        const idx = events.findIndex((e) => e.id === id);
        if (idx >= 0) {
          events[idx].time = newTime;
          events[idx].remindMinutes = Number(remind) || 0;
          setCalendarEvents(events);
          // Allow re-notify
          const notified = JSON.parse(sessionStorage.getItem('notified_events') || '[]').filter((x) => x !== String(id));
          sessionStorage.setItem('notified_events', JSON.stringify(notified));
          renderCalendar();
        }
      });
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('ev-title').value.trim();
    const date = document.getElementById('ev-date').value;
    const time = document.getElementById('ev-time').value;
    const remindMinutes = Number(document.getElementById('ev-remind').value) || 0;
    const description = document.getElementById('ev-desc').value.trim();
    if (!title || !date) return;

    addCalendarEvent({
      id: Date.now(),
      title,
      date,
      time,
      remindMinutes,
      description,
      type: 'event',
      recurring: false
    });

    form.reset();
    document.getElementById('ev-date').value = date;
    document.getElementById('ev-time').value = '09:00';
    document.getElementById('ev-remind').value = '30';
    renderCalendar();
    showInAppToast('Event added: ' + title);
  });

  document.getElementById('cal-prev').addEventListener('click', () => {
    viewMonth -= 1;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear -= 1;
    }
    renderCalendar();
  });

  document.getElementById('cal-next').addEventListener('click', () => {
    viewMonth += 1;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear += 1;
    }
    renderCalendar();
  });

  if (enableNotifBtn) {
    enableNotifBtn.addEventListener('click', async () => {
      if (!('Notification' in window)) {
        alert('Notifications are not supported in this browser.');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        showInAppToast('Notifications enabled. You will get reminders for calendar events.');
        enableNotifBtn.textContent = 'Notifications enabled ✓';
      } else {
        alert('Permission denied. You will still see in-app toasts while the site is open.');
      }
    });
  }

  renderCalendar();
});
