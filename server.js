import 'dotenv/config';
import express from 'express';
import Groq from 'groq-sdk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { buildSystemPrompt, buildUserPrompt } from './prompt.js';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const cache = new Map();

app.post('/simulate', async (req, res) => {
  const {
    role,
    industry,
    ageGroup,
    gender,
    companySize,
    difficultyLevel = 1,
    missedTypes = [],
    sessionCount = 1
  } = req.body;

  if (!role || !industry || !ageGroup || !gender) {
    return res.status(400).json({ error: 'Missing required profile fields' });
  }

  const level = Math.min(Math.max(parseInt(difficultyLevel), 1), 3);

  try {
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4000,
      temperature: 0.7,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        {
          role: 'user',
          content: buildUserPrompt(
            { role, industry, ageGroup, gender, companySize },
            level,
            missedTypes,
            sessionCount
          )
        }
      ]
    });

    const raw = completion.choices[0].message.content.trim();

    let emails;
    try {
      emails = JSON.parse(raw);
    } catch {
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('Could not parse email JSON from response');
      emails = JSON.parse(match[0]);
    }

    if (!Array.isArray(emails) || emails.length === 0) {
      throw new Error('Invalid email array returned');
    }

    const shuffled = emails.sort(() => Math.random() - 0.5);

    const cacheKey = `${industry}-${role}-${level}`;
    cache.set(cacheKey, shuffled);

    res.json({
      emails: shuffled,
      meta: { difficultyLevel: level, sessionCount, missedTypes }
    });

  } catch (err) {
    console.error('Simulation error:', err.message);

    const cacheKey = `${industry}-${role}-${level}`;
    if (cache.has(cacheKey)) {
      console.log('Serving from cache as fallback');
      return res.json({
        emails: cache.get(cacheKey),
        meta: { difficultyLevel: level, fromCache: true }
      });
    }

    res.status(500).json({ error: 'Failed to generate simulation. Please try again.' });
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));