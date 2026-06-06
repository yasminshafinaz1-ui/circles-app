// ============================================================
// Circles — App Utilities
// ============================================================

// ── Toast Notifications ─────────────────────────────────────
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3100);
}

// ── Modal ───────────────────────────────────────────────────
function showModal(content, title) {
  let overlay = document.getElementById('modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="position:relative">
        <button class="modal-close" onclick="hideModal()" title="Close">✕</button>
        <div id="modal-content"></div>
      </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) hideModal(); });
    document.body.appendChild(overlay);
  }
  if (title) {
    document.getElementById('modal-content').innerHTML = `<h3 style="margin-bottom:16px;font-size:1.3rem">${title}</h3>${content}`;
  } else {
    document.getElementById('modal-content').innerHTML = content;
  }
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function hideModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 250);
  }
}

// ── Date Formatting ─────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return { day: '--', mon: '---' };
  const d = new Date(dateStr + 'T00:00:00');
  return {
    day: d.getDate(),
    mon: d.toLocaleDateString('en-MY', { month: 'short' }).toUpperCase()
  };
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

// ── Price Formatting ─────────────────────────────────────────
function formatPrice(priceRm) {
  if (!priceRm || priceRm === 0) return 'FREE';
  return `RM ${priceRm}`;
}

// ── Category helpers ─────────────────────────────────────────
const CAT_COLORS = {
  active: 'var(--active)',
  creative: 'var(--creative)',
  career: 'var(--career)',
  wellness: 'var(--wellness)',
  social: 'var(--social)'
};
const CAT_EMOJIS = {
  active: '🏃',
  creative: '🎨',
  career: '🚀',
  wellness: '🌸',
  social: '💛'
};
const CAT_LABELS = {
  active: 'Active & Outdoors',
  creative: 'Creative',
  career: 'Career & Hustle',
  wellness: 'Wellness',
  social: 'Social & Friendship'
};

function getCategoryColor(category) { return CAT_COLORS[category] || 'var(--ink)'; }
function getCategoryEmoji(category)  { return CAT_EMOJIS[category]  || '🌟'; }
function getCategoryLabel(category)  { return CAT_LABELS[category]  || category; }

// ── Community Card Renderer ──────────────────────────────────
function renderCommunityCard(community, userJoinedIds = []) {
  const { day: _, mon: __ } = formatDateShort(community.created_at?.split('T')[0]);
  const joined = userJoinedIds.includes(community.id);
  return `
    <div class="card community-card" data-id="${community.id}" data-category="${community.category}">
      <div class="c-card-top">
        <span class="c-card-emoji">${community.cover_emoji || '🌟'}</span>
        <span class="c-card-cat ${community.category}">${getCategoryLabel(community.category)}</span>
      </div>
      <div class="c-card-body">
        <h3>${community.name}</h3>
        <p>${community.description || ''}</p>
      </div>
      <div class="c-card-meta">
        <span class="c-card-who">${community.who_gender || 'All genders'} · ${community.who_age_min || 18}–${community.who_age_max || 45}</span>
        <span class="c-card-members">👥 ${community.member_count || 0}</span>
      </div>
      <div class="c-card-footer">
        <button class="btn btn-primary ${joined ? 'btn-joined' : ''}"
          onclick="handleJoinCommunity('${community.id}', '${(community.whatsapp_link || '').replace(/'/g, '')}', this)"
          ${joined ? 'disabled' : ''}>
          ${joined ? 'Joined ✓' : 'Join →'}
        </button>
      </div>
    </div>`;
}

// ── Event Row Renderer ───────────────────────────────────────
function renderEventRow(event, userRsvpMap = {}) {
  const { day, mon } = formatDateShort(event.date);
  const price = formatPrice(event.price_rm);
  const rsvpStatus = userRsvpMap[event.id];
  const atCapacity = event.capacity && event.rsvp_count >= event.capacity;

  let btnHtml = '';
  if (rsvpStatus === 'attending') {
    btnHtml = `<button class="btn btn-sm" style="background:var(--mint);color:var(--ink)"
      onclick="handleCancelRsvp('${event.id}', this)">Going ✓ · Cancel</button>`;
  } else if (rsvpStatus === 'waitlist') {
    btnHtml = `<button class="btn btn-sm btn-secondary" disabled>Waitlisted</button>`;
  } else if (atCapacity) {
    btnHtml = `<button class="btn btn-sm btn-secondary"
      onclick="handleRsvp('${event.id}', this)">Join Waitlist</button>`;
  } else {
    btnHtml = `<button class="btn btn-sm btn-primary"
      onclick="handleRsvp('${event.id}', this)">RSVP</button>`;
  }

  return `
    <div class="e-row" data-id="${event.id}" data-category="${event.communities?.category || ''}">
      <div class="e-date-box">
        <div class="e-date-day">${day}</div>
        <div class="e-date-mon">${mon}</div>
      </div>
      <div class="e-info">
        <h4>${event.title}</h4>
        <div class="e-meta">
          ${event.communities?.cover_emoji || getCategoryEmoji(event.communities?.category)} ${event.communities?.name || ''} &nbsp;·&nbsp;
          ${formatTime(event.time_start)} &nbsp;·&nbsp; ${event.location || ''}
          ${event.capacity ? `&nbsp;·&nbsp; ${event.rsvp_count || 0}/${event.capacity} going` : ''}
        </div>
      </div>
      <span class="e-price ${price === 'FREE' ? 'free' : ''}">${price}</span>
      <div class="e-rsvp-btn">${btnHtml}</div>
    </div>`;
}

// ── API Helper ───────────────────────────────────────────────
async function api(path, options = {}) {
  const session = await getSession();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  const res = await fetch(path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Join Community Handler ───────────────────────────────────
async function handleJoinCommunity(communityId, whatsappLink, btn) {
  const session = await getSession();
  if (!session) {
    window.location.href = '/signup.html';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Joining…';
  try {
    await api(`/api/communities/${communityId}/join`, { method: 'POST' });
    btn.textContent = 'Joined ✓';
    btn.classList.add('btn-joined');
    showToast('You joined the community! 🎉', 'success');
    if (whatsappLink) {
      showModal(`
        <p style="margin-bottom:20px;font-size:0.95rem">Welcome! Join the WhatsApp group to connect with your new circle.</p>
        <a href="${whatsappLink}" target="_blank" rel="noopener" class="btn btn-accent" style="width:100%;justify-content:center">
          Join WhatsApp Group 💬
        </a>`, 'You\'re in! 🎉');
    }
  } catch (e) {
    showToast(e.message || 'Could not join. Try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'Join →';
  }
}

// ── RSVP Handlers ───────────────────────────────────────────
async function handleRsvp(eventId, btn) {
  const session = await getSession();
  if (!session) { window.location.href = '/signup.html'; return; }
  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = '…';
  try {
    const data = await api(`/api/events/${eventId}/rsvp`, { method: 'POST' });
    const status = data.rsvp?.status;
    if (status === 'waitlist') {
      btn.textContent = 'Waitlisted';
      btn.classList.add('btn-secondary');
      showToast('Added to waitlist!', 'info');
    } else {
      btn.style.background = 'var(--mint)';
      btn.style.color = 'var(--ink)';
      btn.textContent = 'Going ✓ · Cancel';
      btn.onclick = function() { handleCancelRsvp(eventId, this); };
      showToast('RSVP confirmed! See you there 🙌', 'success');
    }
  } catch (e) {
    showToast(e.message || 'Could not RSVP.', 'error');
    btn.disabled = false;
    btn.textContent = prev;
  }
}

async function handleCancelRsvp(eventId, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  try {
    await api(`/api/events/${eventId}/rsvp`, { method: 'DELETE' });
    btn.textContent = 'RSVP';
    btn.style.background = '';
    btn.style.color = '';
    btn.onclick = function() { handleRsvp(eventId, this); };
    showToast('RSVP cancelled.', 'info');
  } catch (e) {
    showToast(e.message || 'Could not cancel.', 'error');
    btn.disabled = false;
    btn.textContent = 'Going ✓ · Cancel';
  }
}

// ── Scroll Reveal Animation ──────────────────────────────────
function initScrollReveal() {
  const els = document.querySelectorAll('[data-reveal]');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => io.observe(el));
}

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initScrollReveal();
});
