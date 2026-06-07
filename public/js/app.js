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
  document.getElementById('modal-content').innerHTML = title
    ? `<h3 style="margin-bottom:16px;font-size:1.3rem">${title}</h3>${content}`
    : content;
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
const CAT_BG = {
  active: '#FFE5E5',
  creative: '#E8D5F5',
  career: '#D6EEFF',
  wellness: '#C8F7C5',
  social: '#FFE5D9'
};

function getCategoryColor(category) { return CAT_COLORS[category] || 'var(--ink)'; }
function getCategoryEmoji(category)  { return CAT_EMOJIS[category]  || '🌟'; }
function getCategoryLabel(category)  { return CAT_LABELS[category]  || category; }
function getCategoryBg(category)     { return CAT_BG[category]      || '#FAFAF8'; }

// ── Community Card Renderer ──────────────────────────────────
function renderCommunityCard(community, userMembership = null) {
  const isFollower = userMembership === 'follower';
  const isMember = userMembership === 'member';
  const memberCount = community.member_count || 0;
  const followerCount = community.follower_count || 0;
  const countLabel = memberCount > 0
    ? `👥 ${memberCount} member${memberCount !== 1 ? 's' : ''}`
    : followerCount > 0
      ? `${followerCount} follower${followerCount !== 1 ? 's' : ''}`
      : '';

  return `
    <div class="card community-card" data-id="${community.id}" data-category="${community.category}">
      <a href="/community.html?id=${community.id}" class="c-card-link">
        <div class="c-card-top ${community.category}-bg">
          <span class="c-card-emoji">${community.cover_emoji || '🌟'}</span>
          <span class="c-card-cat badge-${community.category}">${getCategoryEmoji(community.category)} ${getCategoryLabel(community.category)}</span>
        </div>
        <div class="c-card-body">
          <h3>${community.name}</h3>
          <p>${community.description || ''}</p>
        </div>
        <div class="c-card-meta">
          <span class="c-card-who">${community.who_its_for || 'All welcome'}</span>
          <span class="c-card-members">${countLabel}</span>
        </div>
      </a>
      <div class="c-card-footer">
        ${!isMember ? `
        <div class="tooltip-wrap">
          <button class="btn btn-primary ${isFollower ? 'btn-following' : ''}"
            onclick="handleFollowCommunity('${community.id}', this)">
            ${isFollower ? 'Following ✓' : 'Follow →'}
          </button>
          <span class="tooltip-text">Follow to see their events.<br>Show up to join the gang. 🤝</span>
        </div>` : `
        <button class="btn btn-primary btn-joined" disabled>✓ Member</button>`}
        <a href="/community.html?id=${community.id}" class="btn btn-secondary btn-sm">View →</a>
      </div>
    </div>`;
}

// ── Event Row Renderer ───────────────────────────────────────
function renderEventRow(event, userRsvpMap = {}) {
  const { day, mon } = formatDateShort(event.date);
  const price = formatPrice(event.price_rm);
  const rsvpStatus = userRsvpMap[event.id];
  const atCapacity = event.capacity && event.rsvp_count >= event.capacity;
  const cat = event.communities?.category || event.category || '';

  let btnHtml = '';
  if (rsvpStatus === 'attending') {
    btnHtml = `<button class="btn btn-sm btn-going"
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
    <div class="e-row" data-id="${event.id}" data-category="${cat}">
      <div class="e-card-top">
        <a href="/event.html?id=${event.id}" class="e-date-box" style="text-decoration:none">
          <div class="e-date-day" style="color:${getCategoryColor(cat)}">${day}</div>
          <div class="e-date-mon">${mon}</div>
        </a>
        <span class="c-card-cat badge-${cat}">${getCategoryEmoji(cat)} ${getCategoryLabel(cat)}</span>
      </div>
      <div class="e-card-body">
        <a href="/event.html?id=${event.id}" style="text-decoration:none;color:inherit">
          <h4>${event.title}</h4>
        </a>
        ${event.communities?.name ? `<div class="e-card-community">${event.communities.name}</div>` : ''}
      </div>
      <div class="e-card-details">
        ${event.time ? `<span>🕐 ${event.time}</span>` : ''}
        ${event.location ? `<span>📍 ${event.location}</span>` : ''}
        ${event.capacity ? `<span>👥 ${event.rsvp_count || 0}/${event.capacity} spots</span>` : ''}
      </div>
      <div class="e-card-footer">
        <span class="e-price ${price === 'FREE' ? 'free' : ''}">${price}</span>
        ${btnHtml}
      </div>
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

// ── Follow Community Handler ─────────────────────────────────
async function handleFollowCommunity(communityId, btn) {
  const session = await getSession();
  if (!session) {
    window.location.href = '/signup.html';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Following…';
  try {
    await api(`/api/communities/${communityId}/follow`, { method: 'POST' });
    btn.textContent = 'Following ✓';
    btn.classList.add('btn-following');
    btn.disabled = false;
    showToast('You\'re following this community! RSVP to events to earn membership. 🎉', 'success');
  } catch (e) {
    showToast(e.message || 'Could not follow. Try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'Follow →';
  }
}

// Keep for backwards compat — some pages may call this
async function handleJoinCommunity(communityId, _unused, btn) {
  return handleFollowCommunity(communityId, btn);
}

// ── RSVP Confirmation Modal ──────────────────────────────────
function makeGCalLink(event) {
  const d = event.date.replace(/-/g, '');
  const title = encodeURIComponent(event.title);
  const loc = encodeURIComponent(event.location || '');
  const details = encodeURIComponent(`Organised by ${event.communities?.name || 'Circles'}`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${d}/${d}&location=${loc}&details=${details}`;
}

function showRsvpConfirmModal(event) {
  const communityName = event.communities?.name || 'this community';
  const dateStr = [formatDate(event.date), event.time, event.location].filter(Boolean).join(' · ');
  const calLink = makeGCalLink(event);
  const mapsLink = event.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`
    : null;

  showModal(`
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:2.8rem;margin-bottom:10px">🙌</div>
      <h3 style="font-size:1.35rem;margin-bottom:6px">You're going! See you there.</h3>
    </div>
    <div style="background:var(--offwhite);border:2px solid var(--border);border-radius:16px;padding:16px;margin-bottom:18px">
      <div style="font-weight:800;margin-bottom:6px">${event.title}</div>
      <div style="font-size:0.85rem;color:var(--ink-light);font-weight:600">${dateStr}</div>
    </div>
    <div style="background:#FFF8E7;border:2px solid #F5C842;border-radius:16px;padding:16px;margin-bottom:20px;font-size:0.88rem;line-height:1.65;color:var(--ink)">
      Heads up — attending this event is your ticket into <strong>${communityName}</strong>'s inner circle.
      Show up, have fun, and your group access unlocks automatically. Just like that.
    </div>
    <div style="display:flex;gap:10px">
      <a href="${calLink}" target="_blank" rel="noopener"
         class="btn btn-secondary btn-sm" style="flex:1;justify-content:center">
        📅 Add to Calendar
      </a>
      ${mapsLink ? `
      <a href="${mapsLink}" target="_blank" rel="noopener"
         class="btn btn-secondary btn-sm" style="flex:1;justify-content:center">
        📍 Get Directions
      </a>` : ''}
    </div>
    <button onclick="hideModal()" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:10px">Done!</button>
  `);
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
      btn.className = 'btn btn-sm btn-secondary';
      btn.disabled = true;
      showToast('Added to waitlist!', 'info');
    } else {
      btn.className = 'btn btn-sm btn-going';
      btn.textContent = 'Going ✓ · Cancel';
      btn.disabled = false;
      btn.onclick = function() { handleCancelRsvp(eventId, this); };
      showToast('RSVP confirmed! See you there 🙌', 'success');
      try {
        const { event } = await api(`/api/events/${eventId}`);
        showRsvpConfirmModal(event);
      } catch {}
    }
  } catch (e) {
    showToast(e.message || 'Could not RSVP.', 'error');
    btn.disabled = false;
    btn.textContent = prev;
  }
}

async function handleCancelRsvp(eventId, btn) {
  if (!confirm('Cancel your RSVP?')) return;
  btn.disabled = true;
  btn.textContent = '…';
  try {
    await api(`/api/events/${eventId}/rsvp`, { method: 'DELETE' });
    btn.className = 'btn btn-sm btn-primary';
    btn.textContent = 'RSVP';
    btn.disabled = false;
    btn.onclick = function() { handleRsvp(eventId, this); };
    showToast('RSVP cancelled.', 'info');
  } catch (e) {
    showToast(e.message || 'Could not cancel.', 'error');
    btn.disabled = false;
    btn.textContent = 'Going ✓ · Cancel';
  }
}

// ── Scroll Reveal ────────────────────────────────────────────
function initScrollReveal() {
  const els = document.querySelectorAll('[data-reveal]');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target); }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => io.observe(el));
}

// ── Tooltip positioning (JS-based to escape overflow:hidden cards) ──
document.addEventListener('mouseover', e => {
  const wrap = e.target.closest('.tooltip-wrap');
  if (!wrap) return;
  const tip = wrap.querySelector('.tooltip-text');
  if (!tip) return;
  // Temporarily make visible to measure height
  tip.style.visibility = 'hidden';
  tip.style.opacity = '0';
  tip.style.display = 'block';
  const rect = wrap.getBoundingClientRect();
  const tipH = tip.offsetHeight;
  const left = Math.min(rect.left, window.innerWidth - 196);
  tip.style.top = (rect.top + window.scrollY - tipH - 10) + 'px';
  tip.style.left = left + 'px';
  tip.style.display = '';
  tip.classList.add('visible');
});
document.addEventListener('mouseout', e => {
  const wrap = e.target.closest('.tooltip-wrap');
  if (!wrap) return;
  const tip = wrap.querySelector('.tooltip-text');
  if (tip) tip.classList.remove('visible');
});

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initScrollReveal();
});
