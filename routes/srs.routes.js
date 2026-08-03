const express = require('express');
const { getDueCards, getNewCards, recordReview, getCardStats } = require('../modules/srs-engine');
const { getVocabulary } = require('../modules/content');

const router = express.Router();

/**
 * GET /api/srs/due
 * Returns flashcards that are due for review.
 * Query params:
 *   - limit (optional): max number of cards to return (default 50)
 */
router.get('/due', (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit, 10) || 50;

    // Get user's level
    const user = db.prepare('SELECT current_level FROM users WHERE id = ?').get(userId);
    const level = user ? user.current_level : 'beginner';

    // Check if user has any cards seeded — if not, seed from content
    const cardCount = db.prepare('SELECT COUNT(*) as count FROM srs_state WHERE user_id = ?').get(userId);
    if (!cardCount || cardCount.count === 0) {
      seedVocabulary(db, userId, level);
    }

    // Get due cards (reviews)
    let cards = getDueCards(db, userId, limit);
    
    // If no due cards, get new cards instead
    if (cards.length === 0) {
      cards = getNewCards(db, userId, level, 10);
    }

    // Enrich cards with vocabulary data from content bundle
    const vocab = getVocabulary(level);
    const enrichedCards = cards.map(card => {
      const vocabItem = vocab.find(v => v.id === card.cardId);
      return {
        ...card,
        word: vocabItem ? vocabItem.word : card.cardId,
        reading: vocabItem ? vocabItem.reading : '',
        meaning: vocabItem ? vocabItem.meaning : '',
        exampleSentence: vocabItem ? vocabItem.exampleSentence : '',
        mnemonic: vocabItem ? vocabItem.mnemonic : ''
      };
    });

    res.json({ cards: enrichedCards, count: enrichedCards.length });
  } catch (err) {
    console.error('SRS due error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve due cards' });
  }
});

/**
 * Seeds vocabulary cards from the content bundle into the user's srs_state.
 */
function seedVocabulary(db, userId, level) {
  const vocab = getVocabulary(level);
  if (!vocab || vocab.length === 0) return;

  const today = new Date().toISOString().split('T')[0];
  const insert = db.prepare(`
    INSERT OR IGNORE INTO srs_state (user_id, card_id, level, interval, ease_factor, repetition_count, next_review_date)
    VALUES (?, ?, ?, 0, 2.5, 0, ?)
  `);

  for (const card of vocab) {
    insert.run(userId, card.id, level, today);
  }
  
  db.save();
}

/**
 * GET /api/srs/new
 * Returns new cards (never reviewed) for a given level.
 * Query params:
 *   - level (required): beginner, intermediate, or advanced
 *   - limit (optional): max number of cards to return (default 10)
 */
router.get('/new', (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.userId;
    const { level } = req.query;
    const limit = parseInt(req.query.limit, 10) || 10;

    if (!level) {
      return res.status(400).json({ error: 'Level query parameter is required' });
    }

    const validLevels = ['beginner', 'intermediate', 'advanced'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({ error: 'Level must be one of: beginner, intermediate, advanced' });
    }

    const cards = getNewCards(db, userId, level, limit);
    res.json({ cards, count: cards.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve new cards' });
  }
});

/**
 * POST /api/srs/review
 * Records a review for a flashcard.
 * Body:
 *   - cardId (required): the card identifier
 *   - quality (required): rating 0-5
 */
router.post('/review', (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.userId;
    const { cardId, quality } = req.body;

    if (!cardId) {
      return res.status(400).json({ error: 'cardId is required' });
    }

    if (quality === undefined || quality === null) {
      return res.status(400).json({ error: 'quality is required' });
    }

    const qualityInt = parseInt(quality, 10);
    if (isNaN(qualityInt) || qualityInt < 0 || qualityInt > 5) {
      return res.status(400).json({ error: 'quality must be an integer between 0 and 5' });
    }

    const result = recordReview(db, userId, cardId, qualityInt);
    res.json(result);
  } catch (err) {
    if (err.message === 'Card not found') {
      return res.status(404).json({ error: 'Card not found' });
    }
    res.status(500).json({ error: 'Failed to record review' });
  }
});

/**
 * GET /api/srs/stats
 * Returns SRS statistics for a specific card or overall stats.
 * Query params:
 *   - cardId (optional): specific card to get stats for
 *     If not provided, returns summary statistics.
 */
router.get('/stats', (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.userId;
    const { cardId } = req.query;

    if (cardId) {
      const stats = getCardStats(db, userId, cardId);
      if (!stats) {
        return res.status(404).json({ error: 'Card not found' });
      }
      return res.json(stats);
    }

    // Return summary stats if no specific card requested
    const today = new Date().toISOString().split('T')[0];

    const totalCards = db.prepare(
      'SELECT COUNT(*) as count FROM srs_state WHERE user_id = ?'
    ).get(userId).count;

    const dueCards = db.prepare(
      'SELECT COUNT(*) as count FROM srs_state WHERE user_id = ? AND next_review_date <= ?'
    ).get(userId, today).count;

    const masteredCards = db.prepare(
      'SELECT COUNT(*) as count FROM srs_state WHERE user_id = ? AND repetition_count >= 5'
    ).get(userId).count;

    const totalReviews = db.prepare(
      'SELECT COALESCE(SUM(times_reviewed), 0) as total FROM srs_state WHERE user_id = ?'
    ).get(userId).total;

    const totalCorrect = db.prepare(
      'SELECT COALESCE(SUM(times_correct), 0) as total FROM srs_state WHERE user_id = ?'
    ).get(userId).total;

    res.json({
      totalCards,
      dueCards,
      masteredCards,
      totalReviews,
      totalCorrect,
      accuracy: totalReviews > 0 ? totalCorrect / totalReviews : 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

module.exports = router;
