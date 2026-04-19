// adaptive.js — manages user progress and adaptive difficulty via localStorage

const STORAGE_KEY = 'phishing_user_profile';

export function loadUserProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createFreshProfile();
    return JSON.parse(raw);
  } catch {
    return createFreshProfile();
  }
}

export function saveUserProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn('Could not save profile to localStorage', e);
  }
}

export function clearUserProfile() {
  localStorage.removeItem(STORAGE_KEY);
}

function createFreshProfile() {
  return {
    difficultyLevel: 1,
    sessionCount: 0,
    totalCorrect: 0,
    totalAnswered: 0,
    missedTypes: [],
    history: []
  };
}

export function computeAdaptation(profile, batchResults) {
  const total = batchResults.length;
  const correct = batchResults.filter(r => r.correct).length;
  const pct = correct / total;

  const missed = batchResults
    .filter(r => !r.correct)
    .map(r => r.type);

  const missedCounts = missed.reduce((acc, t) => {
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  const persistentlyMissed = Object.entries(missedCounts)
    .filter(([, count]) => count >= 2)
    .map(([type]) => type);

  let newLevel = profile.difficultyLevel;
  let message = '';

  if (pct >= 0.8 && profile.difficultyLevel < 3) {
    newLevel = profile.difficultyLevel + 1;
    message = `Great work! Difficulty increased to ${getLevelLabel(newLevel)}.`;
  } else if (pct <= 0.4 && profile.difficultyLevel > 1) {
    newLevel = profile.difficultyLevel - 1;
    message = `Dropping to ${getLevelLabel(newLevel)} to build your foundation.`;
  } else if (pct >= 0.8 && profile.difficultyLevel === 3) {
    message = 'Outstanding — you\'re at expert level. Keep it up.';
  } else {
    message = `Staying at ${getLevelLabel(profile.difficultyLevel)}. Focus on the areas you missed.`;
  }

  const updatedProfile = {
    ...profile,
    difficultyLevel: newLevel,
    sessionCount: profile.sessionCount + 1,
    totalCorrect: profile.totalCorrect + correct,
    totalAnswered: profile.totalAnswered + total,
    missedTypes: persistentlyMissed,
    history: [
      ...profile.history,
      {
        session: profile.sessionCount + 1,
        score: correct,
        total,
        level: profile.difficultyLevel,
        date: new Date().toLocaleDateString()
      }
    ].slice(-10)
  };

  return { updatedProfile, adaptationMessage: message, score: correct, pct };
}

export function getLevelLabel(level) {
  return { 1: 'Easy', 2: 'Medium', 3: 'Hard' }[level] || 'Easy';
}

export function getOverallStats(profile) {
  const accuracy = profile.totalAnswered > 0
    ? Math.round((profile.totalCorrect / profile.totalAnswered) * 100)
    : 0;

  return {
    sessions: profile.sessionCount,
    accuracy,
    level: getLevelLabel(profile.difficultyLevel),
    streak: getStreak(profile.history)
  };
}

function getStreak(history) {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].score / history[i].total >= 0.7) streak++;
    else break;
  }
  return streak;
}
