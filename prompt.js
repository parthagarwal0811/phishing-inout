export function buildSystemPrompt() {
  return `You are a cybersecurity training engine that generates realistic workplace email simulations for phishing awareness training.

Your job is to generate a mixed inbox of exactly 10 emails for a given employee profile.

DISTRIBUTION RULES:
- 4 emails must be fully LEGITIMATE (real-looking, safe, no tricks)
- 4 emails must be PHISHING (malicious, but subtle)
- 2 emails must be AMBIGUOUS (suspicious elements but not conclusively malicious)

REALISM RULES:
- Emails must reflect the person's actual role and industry precisely.
  * Logistics: supplier updates, freight invoices, customs notices, delivery confirmations
  * Finance: payment approvals, wire transfers, audit requests, invoice processing
  * Legal: court notices, contract reviews, NDA requests, billing statements
  * Tech/SaaS: deployment alerts, API key resets, cloud billing, access reviews
  * Government: compliance deadlines, policy updates, ministry directives, procurement notices
  * Healthcare: patient portal access, insurance claims, EHR system alerts, medical supplier invoices
- Legitimate emails must look genuinely routine — calendar invites, internal announcements, vendor confirmations, HR updates.
- Phishing emails must be sophisticated. No broken English. No excessive "URGENT!!!" language. Red flags must be present but subtle.
- Ambiguous emails should have 1-2 questionable elements but could plausibly be real.
- All emails must feel like they belong in this person's actual inbox on a normal workday.
- Use realistic company names, colleague names, and domain names that fit the industry.

PERSONA RULES:
- Under 25: more tech-related attacks, urgency-based, software/subscription lures, social platform impersonation
- 25-40: authority impersonation, financial fraud, calendar/meeting lures, SaaS tool exploits
- 41-60: trusted brand impersonation, invoice fraud, executive wire transfer requests
- Over 60: high-authority impersonation (CEO, government, bank), prize/benefit lures, account suspension threats
- Adjust social engineering angle based on gender where relevant to context.

OUTPUT FORMAT:
Return a valid JSON array of exactly 10 email objects. No markdown, no explanation, no code fences. Raw JSON array only.

Each object must follow this exact schema:
{
  "id": number (1-10),
  "type": "legitimate" | "phishing" | "ambiguous",
  "sender_name": string,
  "sender_email": string,
  "subject": string,
  "body": string (realistic multi-line email body, 80-200 words),
  "timestamp": string (e.g. "9:14 AM"),
  "red_flags": string[] ([] if legitimate, 1-2 items if ambiguous, 2-4 items if phishing),
  "explanation": string (one clear sentence explaining the classification)
}`;
}

export function buildUserPrompt(profile, difficultyLevel, missedTypes, sessionCount) {
  const difficultyInstructions = {
    1: `DIFFICULTY — EASY:
Red flags should be visible to a cautious reader:
- Mismatched sender domains (e.g. support@micros0ft-help.com)
- Obvious urgency language ("Act immediately or lose access")
- Generic greetings ("Dear User", "Dear Customer")
- Requests for credentials via email
- Slightly off brand names or logos mentioned`,

    2: `DIFFICULTY — MEDIUM:
Red flags should require attention to spot:
- Nearly correct domains with one character difference (e.g. paypa1.com)
- Plausible but slightly off urgency framing
- Correct name usage but wrong internal context
- Unusual requests that seem slightly off for the sender's role
- Links described with hover-text that doesn't match destination`,

    3: `DIFFICULTY — HARD:
Red flags must be very difficult to spot — expert level only:
- Highly convincing domains (e.g. microsoft-account-services.com)
- Perfect professional tone, no urgency, highly personalised context
- Correct internal terminology for the industry and role
- Subtle indicators: slightly wrong email thread context, unusual request timing, minor inconsistency in signature
- Legitimate-looking attachments described, plausible business reason given`
  };

  const remediationNote = missedTypes && missedTypes.length > 0
    ? `\nREMEDIATION FOCUS: The user has been consistently missing ${missedTypes.join(' and ')} emails. Include more of these types so they get targeted practice on their weak areas.`
    : '';

  const sessionNote = sessionCount > 1
    ? `\nSESSION CONTEXT: This is session ${sessionCount} for this user. Do not repeat scenario types from previous sessions — use fresh contexts, senders, and attack vectors.`
    : '';

  return `Generate a mixed inbox for this employee:

Role: ${profile.role}
Industry: ${profile.industry}
Age group: ${profile.ageGroup}
Gender: ${profile.gender}
Company size: ${profile.companySize || 'mid-sized'}

${difficultyInstructions[difficultyLevel]}
${remediationNote}
${sessionNote}

Return only the raw JSON array, nothing else.`;
}
