const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration file path
const CONFIG_DIR = path.join(os.homedir(), '.config/diskmgt');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Get API key from config or environment
function getApiKey() {
    // Try environment variable first
    if (process.env.ANTHROPIC_API_KEY) {
        return process.env.ANTHROPIC_API_KEY;
    }

    // Try config file
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            return config.anthropicApiKey || null;
        } catch (err) {
            return null;
        }
    }

    return null;
}

// Save API key to config
function saveApiKey(apiKey) {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    let config = {};
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        } catch (err) {
            // Start fresh if corrupted
        }
    }

    config.anthropicApiKey = apiKey;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Check if AI features are available
function isAIAvailable() {
    return getApiKey() !== null;
}

// AI-powered semantic search
async function semanticSearch(query, drives) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('No API key configured');
    }

    const client = new Anthropic({ apiKey });

    const prompt = `Given this search query: "${query}"

And these drives:
${JSON.stringify(drives, null, 2)}

Analyze which drives match the search query based on semantic meaning.
Consider:
- Synonyms and related terms (lxc=lxd, backup=timeshift, container=lxd, etc.)
- Purpose and context
- Common terminology variations
- Technical specifications
- Natural language understanding

Return ONLY a valid JSON array of matching UUIDs.
If no matches, return an empty array: []

Examples:
- "lxc" matches drives with "LXD" in label/purpose
- "backup" matches drives with backup-related purposes
- "big" matches drives with large capacity
- "mounted" matches drives that are currently mounted
- "slow" matches drives with performance issues in purpose

Response format (JSON only, no markdown):
["uuid1", "uuid2", "uuid3"]`;

    try {
        const message = await client.messages.create({
            model: 'claude-3-haiku-20240307', // Cheapest model for search
            max_tokens: 300,
            messages: [{
                role: 'user',
                content: prompt
            }]
        });

        const responseText = message.content[0].text.trim();

        // Extract JSON from response (handle markdown code blocks)
        let jsonText = responseText;
        if (responseText.includes('```')) {
            // Extract from markdown code block
            const match = responseText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
            if (match) {
                jsonText = match[1];
            }
        }

        const matchingUUIDs = JSON.parse(jsonText);

        // Validate response
        if (!Array.isArray(matchingUUIDs)) {
            throw new Error('Invalid response format');
        }

        return matchingUUIDs;
    } catch (err) {
        if (err.message.includes('401') || err.message.includes('authentication')) {
            throw new Error('Invalid API key');
        }
        throw err;
    }
}

// AI-powered drive troubleshooting (future feature)
async function troubleshoot(device, question, context) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('No API key configured');
    }

    const client = new Anthropic({ apiKey });

    const prompt = `You are an expert Linux system administrator specializing in
storage troubleshooting. Analyze drive diagnostics and provide
clear, actionable recommendations.

User question: ${question}

Drive: ${device}

Diagnostics:
${JSON.stringify(context, null, 2)}

Provide troubleshooting advice in this format:

DIAGNOSIS:
[Brief explanation of the issue]

RECOMMENDATIONS:
1. [First action with command if applicable]
2. [Second action]

RISK LEVEL: [LOW/MEDIUM/HIGH]

Keep responses concise and terminal-friendly (max 60 chars per line).`;

    try {
        const message = await client.messages.create({
            model: 'claude-3-5-sonnet-20241022', // Better model for troubleshooting
            max_tokens: 2048,
            messages: [{
                role: 'user',
                content: prompt
            }]
        });

        return message.content[0].text;
    } catch (err) {
        if (err.message.includes('401') || err.message.includes('authentication')) {
            throw new Error('Invalid API key');
        }
        throw err;
    }
}

module.exports = {
    getApiKey,
    saveApiKey,
    isAIAvailable,
    semanticSearch,
    troubleshoot
};
