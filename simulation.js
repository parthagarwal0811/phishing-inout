import {
  loadUserProfile,
  saveUserProfile,
  clearUserProfile,
  computeAdaptation,
  getLevelLabel,
  getOverallStats
} from './adaptive.js';

const API_URL = '/simulate';

let emails = [];
let verdicts = {};
let activeId = null;
let userProfile = null;
let currentProfile = null;

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  userProfile = loadUserProfile();
  renderOnboardingStats();

  document.getElementById('btn-start').addEventListener('click', startSimulation);
  document.getElementById('btn-results').addEventListener('click', showResults);
  document.getElementById('btn-restart').addEventListener('click', restart);
  document.getElementById('btn-reset-progress').addEventListener('click', resetProgress);
});

// ── Onboarding ────────────────────────────────────────────────────────────────

function renderOnboardingStats() {
  const stats = getOverallStats(userProfile);
  const statsEl = document.getElementById('returning-stats');

  if (userProfile.sessionCount === 0) {
    statsEl.style.display = 'none';
    return;
  }

  statsEl.style.display = 'block';
  statsEl.innerHTML = `
    <div class="stat-row">
      <div class="stat-item">
        <span class="stat-value">${stats.sessions}</span>
        <span class="stat-label">Sessions</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${stats.accuracy}%</span>
        <span class="stat-label">Accuracy</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${stats.level}</span>
        <span class="stat-label">Current level</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${stats.streak}</span>
        <span class="stat-label">Win streak</span>
      </div>
    </div>
    ${userProfile.missedTypes.length > 0 ? `
      <p class="stat-focus">Focus area this session: <strong>${userProfile.missedTypes.join(', ')}</strong> emails</p>
    ` : ''}
  `;

  const levelBadge = document.getElementById('difficulty-badge');
  if (levelBadge) {
    levelBadge.textContent = `Level ${userProfile.difficultyLevel} — ${getLevelLabel(userProfile.difficultyLevel)}`;
    levelBadge.className = `difficulty-badge level-${userProfile.difficultyLevel}`;
  }
}

// ── Simulation start ──────────────────────────────────────────────────────────

async function startSimulation() {
  const role = document.getElementById('input-role').value.trim();
  const industry = document.getElementById('input-industry').value;
  const ageGroup = document.getElementById('input-age').value;
  const gender = document.getElementById('input-gender').value;

  if (!role || !industry || !ageGroup || !gender) {
    showFormError('Please fill in all fields to continue.');
    return;
  }

  currentProfile = { role, industry, ageGroup, gender };

  show('screen-loading');
  updateLoadingMessage(userProfile.difficultyLevel);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role,
        industry,
        ageGroup,
        gender,
        difficultyLevel: userProfile.difficultyLevel,
        missedTypes: userProfile.missedTypes,
        sessionCount: userProfile.sessionCount + 1
      })
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const data = await res.json();
    emails = data.emails;
    verdicts = {};
    activeId = null;

    renderInbox();
    updateSimHeader();
    show('screen-sim');
  } catch (err) {
    console.error(err);
    showError('Could not generate simulation. Make sure the server is running on port 3000.');
    show('screen-onboard');
  }
}

function updateLoadingMessage(level) {
  const msgs = {
    1: ['Building your inbox...', 'Generating beginner scenarios for your role'],
    2: ['Building your inbox...', 'Crafting medium-difficulty scenarios for your role'],
    3: ['Building your inbox...', 'Generating expert-level scenarios — these will be tough']
  };
  const [main, sub] = msgs[level] || msgs[1];
  document.getElementById('loading-main').textContent = main;
  document.getElementById('loading-sub').textContent = sub;
}

function updateSimHeader() {
  const levelEl = document.getElementById('sim-level-badge');
  if (levelEl) {
    levelEl.textContent = `Level ${userProfile.difficultyLevel} — ${getLevelLabel(userProfile.difficultyLevel)}`;
    levelEl.className = `sim-level-badge level-${userProfile.difficultyLevel}`;
  }
}

// ── Inbox rendering ───────────────────────────────────────────────────────────

function renderInbox() {
  const list = document.getElementById('email-list');
  list.innerHTML = '';

  emails.forEach(email => {
    const item = document.createElement('div');
    item.className = 'email-item';
    item.id = `item-${email.id}`;
    item.innerHTML = `
      <div class="email-sender">
        <span>${escapeHtml(email.sender_name)}</span>
        <span class="email-time">${escapeHtml(email.timestamp)}</span>
      </div>
      <div class="email-subject">${escapeHtml(email.subject)}</div>
      <div class="email-preview">${escapeHtml(email.body.slice(0, 90))}...</div>
    `;
    item.addEventListener('click', () => openEmail(email.id));
    list.appendChild(item);
  });

  updateProgress();
}

function openEmail(id) {
  activeId = id;
  const email = emails.find(e => e.id === id);
  if (!email) return;

  document.querySelectorAll('.email-item').forEach(el => el.classList.remove('active'));
  const itemEl = document.getElementById(`item-${id}`);
  if (itemEl) itemEl.classList.add('active');

  const panel = document.getElementById('email-panel');
  const initials = email.sender_name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const currentVerdict = verdicts[id];

  panel.innerHTML = `
    <div class="email-view">
      <div class="email-view-header">
        <div class="email-view-subject">${escapeHtml(email.subject)}</div>
        <div class="email-meta">
          <div class="email-avatar">${initials}</div>
          <div>
            <div class="email-from">${escapeHtml(email.sender_name)}</div>
            <div class="email-from-addr">${escapeHtml(email.sender_email)}</div>
          </div>
        </div>
      </div>
      <div class="email-body">${escapeHtml(email.body)}</div>
      <div class="verdict-bar">
        <p>How do you classify this email?</p>
        <div class="verdict-btns">
          <button class="verdict-btn v-safe ${currentVerdict === 'safe' ? 'selected' : ''}"
            onclick="window.setVerdict(${id}, 'safe')">
            Safe
          </button>
          <button class="verdict-btn v-suspicious ${currentVerdict === 'suspicious' ? 'selected' : ''}"
            onclick="window.setVerdict(${id}, 'suspicious')">
            Suspicious
          </button>
          <button class="verdict-btn v-phishing ${currentVerdict === 'phishing' ? 'selected' : ''}"
            onclick="window.setVerdict(${id}, 'phishing')">
            Phishing
          </button>
        </div>
      </div>
    </div>
  `;
}

window.setVerdict = function(id, verdict) {
  verdicts[id] = verdict;

  const item = document.getElementById(`item-${id}`);
  if (!item) return;
  item.classList.add('reviewed');

  const existing = item.querySelector('.verdict-badge');
  if (existing) existing.remove();

  const badge = document.createElement('span');
  badge.className = `verdict-badge badge-${verdict}`;
  badge.textContent = verdict.charAt(0).toUpperCase() + verdict.slice(1);
  item.appendChild(badge);

  document.querySelectorAll('#email-panel .verdict-btn').forEach(b => b.classList.remove('selected'));
  const selectedBtn = document.querySelector(`#email-panel .v-${verdict}`);
  if (selectedBtn) selectedBtn.classList.add('selected');

  updateProgress();
};

function updateProgress() {
  const reviewed = Object.keys(verdicts).length;
  const total = emails.length;
  document.getElementById('progress-text').textContent = `${reviewed} of ${total} reviewed`;
  document.getElementById('inbox-count').textContent = `${total} messages`;
  document.getElementById('btn-results').disabled = reviewed < total;

  const bar = document.getElementById('progress-bar-fill');
  if (bar) bar.style.width = `${(reviewed / total) * 100}%`;
}

// ── Results ───────────────────────────────────────────────────────────────────

function showResults() {
  const batchResults = emails.map(email => ({
    id: email.id,
    subject: email.subject,
    sender: email.sender_name,
    type: email.type,
    userVerdict: verdicts[email.id],
    correct: isCorrect(email.type, verdicts[email.id]),
    explanation: email.explanation,
    red_flags: email.red_flags || []
  }));

  const { updatedProfile, adaptationMessage, score, pct } = computeAdaptation(userProfile, batchResults);
  userProfile = updatedProfile;
  saveUserProfile(userProfile);

  document.getElementById('score-number').textContent = score;
  document.getElementById('score-title').textContent = getScoreTitle(score);
  document.getElementById('score-subtitle').textContent = getScoreSubtitle(score);

  const pctRounded = Math.round(pct * 100);
  const ring = document.getElementById('score-ring');
  if (ring) {
    const color = pct >= 0.8 ? '#639922' : pct >= 0.5 ? '#BA7517' : '#A32D2D';
    ring.style.borderColor = color;
  }

  const adaptEl = document.getElementById('adaptation-message');
  if (adaptEl) {
    adaptEl.textContent = adaptationMessage;
    adaptEl.className = `adaptation-message ${pct >= 0.8 ? 'adapt-up' : pct <= 0.4 ? 'adapt-down' : 'adapt-same'}`;
  }

  const stats = getOverallStats(userProfile);
  const overallEl = document.getElementById('overall-stats');
  if (overallEl) {
    overallEl.innerHTML = `
      <div class="stat-row">
        <div class="stat-item">
          <span class="stat-value">${stats.sessions}</span>
          <span class="stat-label">Total sessions</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${stats.accuracy}%</span>
          <span class="stat-label">Overall accuracy</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${stats.level}</span>
          <span class="stat-label">Next level</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${stats.streak}</span>
          <span class="stat-label">Win streak</span>
        </div>
      </div>
    `;
  }

  const breakdownEl = document.getElementById('breakdown');
  breakdownEl.innerHTML = batchResults.map(item => `
    <div class="breakdown-item ${item.correct ? 'correct' : 'wrong'}">
      <div class="breakdown-top">
        <div class="breakdown-subject">${escapeHtml(item.subject)}</div>
        <span class="breakdown-result ${item.correct ? 'result-correct' : 'result-wrong'}">
          ${item.correct ? 'Correct' : `Missed — was ${item.type}`}
        </span>
      </div>
      <div class="breakdown-meta">
        <span class="breakdown-your-answer">You said: ${item.userVerdict}</span>
      </div>
      <div class="breakdown-explanation">${escapeHtml(item.explanation)}</div>
      ${item.red_flags.length > 0 ? `
        <div class="breakdown-flags">
          ${item.red_flags.map(f => `<span class="flag-pill">${escapeHtml(f)}</span>`).join('')}
        </div>` : ''}
    </div>
  `).join('');

  show('screen-results');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isCorrect(type, verdict) {
  if (type === 'legitimate') return verdict === 'safe';
  if (type === 'phishing') return verdict === 'phishing';
  if (type === 'ambiguous') return verdict === 'suspicious' || verdict === 'phishing';
  return false;
}

function getScoreTitle(score) {
  if (score >= 9) return 'Excellent awareness';
  if (score >= 7) return 'Good instincts';
  if (score >= 5) return 'Room to improve';
  return 'High risk profile';
}

function getScoreSubtitle(score) {
  if (score >= 9) return "You caught nearly everything. You're a hard target.";
  if (score >= 7) return 'Solid performance, but a few attacks slipped through.';
  if (score >= 5) return "You're vulnerable to several common attack types.";
  return 'Attackers would likely succeed against your current awareness level.';
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function show(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(screenId);
  if (target) target.classList.remove('hidden');
  window.scrollTo(0, 0);
}

function showFormError(msg) {
  const el = document.getElementById('form-error');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  }
}

function showError(msg) {
  alert(msg);
}

function restart() {
  emails = [];
  verdicts = {};
  activeId = null;
  renderOnboardingStats();
  show('screen-onboard');
}

function resetProgress() {
  if (confirm('Reset all your progress? This cannot be undone.')) {
    clearUserProfile();
    userProfile = loadUserProfile();
    renderOnboardingStats();
  }
}

window.restart = restart;
window.resetProgress = resetProgress;
