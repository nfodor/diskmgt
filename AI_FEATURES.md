# AI Features in diskmgt

## Overview
Drive Manager now includes optional AI-powered features using Claude AI for intelligent semantic search.

## Features

### 1. AI-Powered Semantic Search

**What it does:**
- Understands natural language queries
- No hardcoded aliases needed
- Interprets context and relationships automatically

**Example queries:**
```
"lxc" or "lxd"        → finds LXD container storage
"container"           → finds container-related drives
"backup" or "backup stuff" → finds backup drives
"big drives"          → finds largest capacity drives
"mounted"             → finds currently mounted drives
"removable"           → finds USB/SD cards
"system" or "os"      → finds OS/root drives
"slow"                → finds drives with performance issues
```

**Cost:** ~$0.0001 per search (essentially free)

### 2. AI-Powered Error Analysis

**What it does:**
- Analyzes disk errors and suggests solutions
- Interprets SMART health data with risk assessment
- Diagnoses filesystem issues with repair strategies
- Provides actionable recommendations

**Available in:**
- **System error logs** - Analyzes journalctl disk errors
- **SMART health checks** - Interprets SMART attributes and predicts failures
- **Filesystem checks** - Explains fsck errors and suggests repair steps

**Example analysis:**
```
DIAGNOSIS:
Drive shows 200+ reallocated sectors (SMART attribute 5).
This indicates physical bad blocks being remapped.

RECOMMENDATIONS:
1. Immediate backup of all data (HIGH PRIORITY)
2. Run extended SMART test: smartctl -t long /dev/sda
3. Replace drive - current condition indicates imminent failure

RISK LEVEL: HIGH
```

**Cost:** ~$0.014 per analysis (1.4 cents)

### 3. Fallback to Basic Search

**Always works without AI:**
- If no API key configured
- If user chooses basic search
- If AI search fails

**Basic search includes hardcoded aliases:**
- lxc → lxd
- container → lxd
- os → operating system
- root → root-system

## Setup

### Option 1: Environment Variable (Recommended)

```bash
# Add to ~/.bashrc or ~/.zshrc
export ANTHROPIC_API_KEY="sk-ant-..."

# Reload shell
source ~/.bashrc
```

### Option 2: Configuration Menu

1. Run `diskmgt`
2. Select "⚙️ Configure AI features"
3. Select "Set API key"
4. Enter your API key (masked input)
5. Key is saved to `~/.config/diskmgt/config.json`

### Getting an API Key

1. Visit https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new key
5. Copy the key (starts with `sk-ant-`)

## Usage

### Using AI Search

1. Select "Search drives" from main menu
2. Enter search term
3. If API key configured:
   - Choose "🤖 AI-powered semantic search" (recommended)
   - Or "🔍 Basic text search"
4. View results

### Testing AI Features

1. Select "⚙️ Configure AI features"
2. Select "Test AI search"
3. Tests with query "lxc"
4. Shows results if LXD drives found

## Configuration File

**Location:** `~/.config/diskmgt/config.json`

**Format:**
```json
{
  "anthropicApiKey": "sk-ant-..."
}
```

**Security:**
- File permissions: 600 (user read/write only)
- API key stored in plaintext (secure your config directory)
- Alternative: Use environment variable for better security

## Cost Analysis

### Per Search Query

**AI-powered search:**
- Model: Claude 3 Haiku (cheapest)
- Average tokens: ~100 tokens
- Cost: ~$0.0001 (0.01 cent)

**Monthly usage estimates:**
- 100 searches/month: $0.01
- 1000 searches/month: $0.10
- 10000 searches/month: $1.00

**Essentially free for normal use.**

## Privacy

**What is sent to Claude:**
- Your search query
- Drive metadata (labels, types, purposes, devices, sizes)

**What is NOT sent:**
- File contents
- Directory listings
- Personal data
- Sensitive information

**Data retention:**
- Anthropic does not train on API data
- Requests are not stored long-term
- See: https://www.anthropic.com/legal/privacy

## Troubleshooting

### "No API key configured"
- Set API key via environment variable or config menu

### "Invalid API key"
- Check key format (should start with `sk-ant-`)
- Verify key is active at https://console.anthropic.com/

### "AI search failed"
- Check internet connection
- Verify API key is valid
- Try basic search as fallback
- Check Anthropic service status

### "Test failed"
- Ensure registered drives exist
- Check drive labels contain searchable terms
- Verify API key has sufficient credits

## Future Features

**Planned enhancements:**

1. **AI Troubleshooting Assistant**
   - Diagnose drive issues
   - Suggest solutions with risk levels
   - Actionable command recommendations

2. **Smart Recommendations**
   - Capacity planning
   - Performance optimization
   - Backup strategy suggestions

3. **Natural Language Commands**
   - "backup my LXD drive"
   - "show me slow drives"
   - "which drive has the most space?"

## Disabling AI Features

### Temporary (one session):
- Choose "🔍 Basic text search" when searching

### Permanent:
1. Select "⚙️ Configure AI features"
2. Select "Remove API key"
3. Confirm removal

OR

```bash
# Remove from environment
unset ANTHROPIC_API_KEY

# Remove from config
rm ~/.config/diskmgt/config.json
```

## Support

**Issues or questions:**
- Open issue: https://github.com/[your-repo]/diskmgt/issues
- Claude API docs: https://docs.anthropic.com/
- Anthropic support: https://support.anthropic.com/

## Benefits

✅ **Natural language understanding** - Search how you think
✅ **No maintenance** - AI learns relationships automatically
✅ **Always has fallback** - Works without AI
✅ **Extremely affordable** - Essentially free
✅ **Privacy-conscious** - Only metadata sent
✅ **Optional** - Not required to use diskmgt
