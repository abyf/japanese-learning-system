/**
 * Japanese Learning System - Curriculum Module
 * Manages guided curriculum progression through a structured 52-week program.
 * Provides functions for reading curriculum data, tracking progress, and 
 * determining which activities are unlocked for a user.
 */
const path = require('path');
const fs = require('fs');
const { getVocabularyExercise, getPassage, getListeningExercise, getDictationExercise } = require('./content');

// Cache curriculum data in memory after first load
let curriculumCache = {};

/**
 * Reads and returns the curriculum JSON for a given level.
 * Caches the result in memory after first load.
 * 
 * @param {string} level - The curriculum level (e.g., 'beginner')
 * @returns {object} The parsed curriculum data
 */
function getCurriculum(level) {
  if (curriculumCache[level]) {
    return curriculumCache[level];
  }

  const filePath = path.join(__dirname, '..', 'content', 'curriculum', `${level}-curriculum.json`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Curriculum not found for level: ${level}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  curriculumCache[level] = data;
  return data;
}

/**
 * Returns the user's curriculum progress.
 * New users start at Week 1, Day 1.
 * 
 * @param {object} db - Database wrapper instance
 * @param {number} userId - The user's ID
 * @returns {object} { currentWeek, currentDay, completedDays, totalDays, percentComplete }
 */
function getUserProgress(db, userId) {
  // Get all completed days for this user
  const completedRows = db.prepare(
    'SELECT week, day FROM curriculum_progress WHERE user_id = ? AND completed = 1 ORDER BY week ASC, day ASC'
  ).all(userId);

  const completedDays = completedRows.length;

  // Get the curriculum to know total days
  const curriculum = getCurriculum('beginner');
  const totalDays = curriculum.weeks.reduce((sum, w) => sum + w.days.length, 0);

  // Determine current position: the first uncompleted day
  let currentWeek = 1;
  let currentDay = 1;

  if (completedDays > 0) {
    // Find the first day that is NOT completed
    let found = false;
    for (const week of curriculum.weeks) {
      for (const day of week.days) {
        const isCompleted = completedRows.some(
          r => r.week === week.week && r.day === day.day
        );
        if (!isCompleted) {
          currentWeek = week.week;
          currentDay = day.day;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    // If all days are completed, stay on last day
    if (!found) {
      const lastWeek = curriculum.weeks[curriculum.weeks.length - 1];
      currentWeek = lastWeek.week;
      currentDay = lastWeek.days[lastWeek.days.length - 1].day;
    }
  }

  const percentComplete = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

  return {
    currentWeek,
    currentDay,
    completedDays,
    totalDays,
    percentComplete
  };
}

/**
 * Returns the activities for a specific day in the curriculum.
 * 
 * @param {string} level - The curriculum level
 * @param {number} week - Week number (1-based)
 * @param {number} day - Day number (1-7)
 * @returns {object|null} The day data with activities, or null if not found
 */
function getDayActivities(level, week, day) {
  const curriculum = getCurriculum(level);
  
  const weekData = curriculum.weeks.find(w => w.week === week);
  if (!weekData) return null;

  const dayData = weekData.days.find(d => d.day === day);
  if (!dayData) return null;

  // Resolve titles for internal exercises so every activity has a display title.
  const activities = (dayData.activities || []).map(a => {
    const isInternal = (a.source === 'internal' || a.type === 'internal') && a.exerciseId;
    if (isInternal && !a.title) {
      const info = resolveExerciseTitle(a.exerciseId);
      return Object.assign({}, a, { title: info.en, titleFr: info.fr, titlePt: info.pt });
    }
    return a;
  });

  return {
    week: weekData.week,
    theme: weekData.theme,
    themeFr: weekData.themeFr,
    themePt: weekData.themePt,
    day: dayData.day,
    title: dayData.title,
    titleFr: dayData.titleFr,
    titlePt: dayData.titlePt,
    review: dayData.review || false,
    activities: activities,
    resources: weekData.resources || []
  };
}

/**
 * Marks a curriculum day as complete for a user.
 * Uses INSERT OR REPLACE to handle both new and re-completed days.
 * 
 * @param {object} db - Database wrapper instance
 * @param {number} userId - The user's ID
 * @param {number} week - Week number
 * @param {number} day - Day number
 * @returns {object} { success: true, week, day, completedAt }
 */
function markDayComplete(db, userId, week, day) {
  const now = new Date().toISOString();
  
  db.prepare(
    `INSERT OR REPLACE INTO curriculum_progress (user_id, week, day, completed, completed_at)
     VALUES (?, ?, ?, 1, ?)`
  ).run(userId, week, day, now);

  return {
    success: true,
    week,
    day,
    completedAt: now
  };
}

/**
 * Returns the list of exercise IDs that are unlocked for this user.
 * An exercise is unlocked if it appears in any day that is:
 * - Already completed, OR
 * - The current day (next uncompleted day)
 * 
 * Since the system provides GUIDANCE not hard locks, all exercises
 * are technically accessible, but this tells the UI which are "in curriculum".
 * 
 * @param {object} db - Database wrapper instance
 * @param {number} userId - The user's ID
 * @returns {string[]} Array of exercise IDs that are unlocked
 */
function getUnlockedActivities(db, userId) {
  const progress = getUserProgress(db, userId);
  const curriculum = getCurriculum('beginner');
  const unlockedIds = new Set();

  for (const week of curriculum.weeks) {
    for (const day of week.days) {
      // Include exercises from completed days and the current day
      const isCurrent = (week.week === progress.currentWeek && day.day === progress.currentDay);
      const isPast = (week.week < progress.currentWeek) ||
        (week.week === progress.currentWeek && day.day < progress.currentDay);

      // Check if this specific day is completed
      const isCompleted = db.prepare(
        'SELECT 1 FROM curriculum_progress WHERE user_id = ? AND week = ? AND day = ? AND completed = 1'
      ).get(userId, week.week, day.day);

      if (isCompleted || isCurrent || isPast) {
        for (const activity of day.activities) {
          if (activity.exerciseId) {
            unlockedIds.add(activity.exerciseId);
          }
        }
      }
    }
  }

  return Array.from(unlockedIds);
}

/**
 * Check if a specific exercise is unlocked (available in curriculum) for a user.
 * 
 * @param {object} db - Database wrapper instance
 * @param {number} userId - The user's ID
 * @param {string} exerciseId - The exercise ID to check
 * @returns {boolean} True if the exercise is unlocked
 */
function isExerciseUnlocked(db, userId, exerciseId) {
  const unlocked = getUnlockedActivities(db, userId);
  return unlocked.includes(exerciseId);
}

/**
 * Get the week data for display (all days with their completion status).
 * 
 * @param {object} db - Database wrapper instance
 * @param {number} userId - The user's ID
 * @param {string} level - The curriculum level
 * @param {number} weekNum - The week number
 * @returns {object|null} Week data with day completion status
 */
/**
 * Resolves the title for an internal exercise by reading its content file.
 * Caches results to avoid repeated file reads.
 */
const titleCache = {};
function resolveExerciseTitle(exerciseId) {
  if (titleCache[exerciseId]) return titleCache[exerciseId];

  let result = { en: exerciseId, fr: exerciseId, pt: exerciseId };
  try {
    const prefix = exerciseId.charAt(0);
    let data = null;
    if (prefix === 'v') {
      data = getVocabularyExercise('beginner', exerciseId);
    } else if (prefix === 'r') {
      data = getPassage('beginner', exerciseId);
    } else if (prefix === 'l') {
      data = getListeningExercise('beginner', exerciseId);
    } else if (prefix === 'd') {
      data = getDictationExercise('beginner', exerciseId);
    }
    if (data && !data.error) {
      const en = data.titleEn || data.title || exerciseId;
      const fr = data.titleFr || data.title || exerciseId;
      let pt = en;
      // Portuguese titles live in the centralized translation file
      try {
        const { loadTranslationFile } = require('./translations');
        const ptT = loadTranslationFile('pt');
        if (ptT && ptT.titles) {
          if (prefix === 'v' && ptT.titles.vocabulary && ptT.titles.vocabulary[exerciseId]) {
            pt = ptT.titles.vocabulary[exerciseId];
          }
        }
      } catch (e) { /* ignore */ }
      result = { en, fr, pt };
    }
  } catch (e) {
    // Fallback to ID
  }
  titleCache[exerciseId] = result;
  return result;
}

/**
 * Get the week data for display (all days with their completion status).
 */
function getWeekData(db, userId, level, weekNum) {
  const curriculum = getCurriculum(level);
  const weekData = curriculum.weeks.find(w => w.week === weekNum);
  if (!weekData) return null;

  const progress = getUserProgress(db, userId);

  const days = weekData.days.map(day => {
    const completionRow = db.prepare(
      'SELECT completed, completed_at FROM curriculum_progress WHERE user_id = ? AND week = ? AND day = ?'
    ).get(userId, weekNum, day.day);

    const isCompleted = completionRow && completionRow.completed === 1;
    const isCurrent = (weekNum === progress.currentWeek && day.day === progress.currentDay);
    const isLocked = !isCompleted && !isCurrent && 
      (weekNum > progress.currentWeek || 
       (weekNum === progress.currentWeek && day.day > progress.currentDay));

    return {
      day: day.day,
      title: day.title,
      titleFr: day.titleFr,
      titlePt: day.titlePt,
      review: day.review || false,
      completed: isCompleted,
      current: isCurrent,
      locked: isLocked,
      completedAt: completionRow ? completionRow.completed_at : null,
      activities: day.activities.map((a, actIdx) => {
        let activityCompleted = false;
        const isInternalActivity = (a.source === 'internal' || a.type === 'internal') && a.exerciseId;
        // Lesson/deepdive activities link to in-app pages (kana, kanji, deep dive) via a route
        const isLessonActivity = (a.type === 'lesson' || a.type === 'deepdive') && a.route;
        const isExternalActivity = !isInternalActivity && !isLessonActivity &&
          (a.source === 'external' || a.type === 'external');

        if (isInternalActivity) {
          // Check if this exercise has been completed (score = 1.0)
          const result = db.prepare(
            'SELECT 1 FROM progress WHERE user_id = ? AND exercise_id = ? AND score = 1.0'
          ).get(userId, a.exerciseId);
          activityCompleted = !!result;
        } else {
          // Lesson & external activities are marked done via external_activity_done
          const result = db.prepare(
            'SELECT 1 FROM external_activity_done WHERE user_id = ? AND week = ? AND day = ? AND activity_index = ?'
          ).get(userId, weekNum, day.day, actIdx);
          activityCompleted = !!result;
        }

        // Resolve title for internal exercises if not already set
        let title = a.title || '';
        let titleFr = a.titleFr || '';
        let titlePt = a.titlePt || '';
        if (isInternalActivity && !title) {
          const exerciseData = resolveExerciseTitle(a.exerciseId);
          title = exerciseData.en || a.exerciseId;
          titleFr = exerciseData.fr || a.exerciseId;
          titlePt = exerciseData.pt || exerciseData.en || a.exerciseId;
        }

        const source = isInternalActivity ? 'internal' : (isLessonActivity ? 'lesson' : 'external');
        return { ...a, title, titleFr, titlePt, completed: activityCompleted, source, activityIndex: actIdx };
      })
    };
  });

  return {
    week: weekData.week,
    theme: weekData.theme,
    themeFr: weekData.themeFr,
    themePt: weekData.themePt,
    resources: weekData.resources || [],
    days
  };
}

module.exports = {
  getCurriculum,
  getUserProgress,
  getDayActivities,
  markDayComplete,
  getUnlockedActivities,
  isExerciseUnlocked,
  getWeekData
};
