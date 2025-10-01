# Claude AI Integration for Drive Troubleshooting

## Overview
Integrate Anthropic's Claude AI SDK to provide intelligent drive troubleshooting, diagnostics, and recommendations.

## Use Cases

### 1. **Intelligent Error Diagnosis**
```
User: "My drive is slow"
Claude analyzes:
- SMART data
- Filesystem type and fragmentation
- Mount options
- I/O statistics
- Recent dmesg errors

Claude suggests:
→ "Drive shows 2000+ reallocated sectors (SMART 5)
   Recommend immediate backup and replacement.
   Would you like me to start a backup now?"
```

### 2. **Boot Issues**
```
User: "System won't boot from this SD card"
Claude checks:
- Bootloader presence (boot flag, EFI partition)
- Filesystem integrity (fsck results)
- Partition table type (MBR vs GPT)
- Boot configuration files

Claude suggests:
→ "Missing boot flag on partition 1.
   Run: parted /dev/mmcblk0 set 1 boot on
   Should I fix this for you?"
```

### 3. **Performance Optimization**
```
User: "How can I speed up my backup drive?"
Claude analyzes:
- Current mount options
- Filesystem type vs use case
- I/O scheduler
- Hardware capabilities

Claude suggests:
→ "Your ext4 backup drive would benefit from:
   1. noatime mount option (-10% write overhead)
   2. Switch to btrfs for compression
   3. Adjust I/O scheduler to 'deadline'

   Would you like to apply these optimizations?"
```

### 4. **Capacity Planning**
```
User: "Will this drive fit my backup?"
Claude calculates:
- Source data size (excluding empty space)
- Compression ratio estimates
- Target filesystem overhead
- Safety margin

Claude suggests:
→ "Your 450GB of data will compress to ~320GB with tar.gz
   Target drive (500GB) has sufficient space.
   Recommend: Filesystem backup (tar method)"
```

### 5. **Recovery Assistance**
```
User: "This drive shows as 'not mounted' - is it dead?"
Claude investigates:
- Partition table readable?
- Filesystem superblock intact?
- SMART health indicators
- dmesg USB/connection errors

Claude suggests:
→ "Drive hardware is healthy but filesystem corrupted.
   Recovery options:
   1. fsck repair (may lose some data)
   2. Photorec data recovery (recover files)
   3. Professional recovery service

   Estimated recovery success: 85%
   Recommend: Try fsck -y first"
```

## Technical Implementation

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  diskmgt CLI                                            │
│  ├── Disk Maintenance Menu                             │
│  │   └── "🤖 Ask Claude for help"                      │
│  │                                                      │
│  └── Context Collection                                │
│      ├── Drive info (lsblk, smartctl)                  │
│      ├── Filesystem stats (df, du, tune2fs)            │
│      ├── Error logs (dmesg, journalctl)                │
│      ├── Mount options (/proc/mounts)                  │
│      └── I/O stats (/sys/block/*/stat)                 │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Claude SDK (@anthropic-ai/sdk)                         │
│  ├── Model: claude-3.5-sonnet (recommended)            │
│  ├── Context: System + user question + diagnostics     │
│  └── Response: Analysis + recommendations + actions    │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Action Executor (optional)                             │
│  ├── Confirm with user before execution                │
│  ├── Run suggested commands (mount, fsck, backup)      │
│  └── Show results and next steps                       │
└─────────────────────────────────────────────────────────┘
```

### Implementation Files

```javascript
// claude-troubleshooter.js
const Anthropic = require('@anthropic-ai/sdk');
const { execSync } = require('child_process');

class ClaudeTroubleshooter {
    constructor() {
        this.client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
    }

    // Collect comprehensive drive diagnostics
    async collectDriveContext(device) {
        const context = {
            drive_info: this.getDriveInfo(device),
            smart_data: this.getSmartData(device),
            filesystem: this.getFilesystemInfo(device),
            mount_options: this.getMountOptions(device),
            recent_errors: this.getRecentErrors(device),
            io_stats: this.getIOStats(device)
        };
        return context;
    }

    // Ask Claude for troubleshooting help
    async troubleshoot(device, userQuestion) {
        const context = await this.collectDriveContext(device);

        const message = await this.client.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2048,
            system: `You are an expert Linux system administrator specializing in
                     storage troubleshooting. Analyze drive diagnostics and provide
                     clear, actionable recommendations. Format responses as:

                     DIAGNOSIS:
                     [Brief explanation of the issue]

                     RECOMMENDATIONS:
                     1. [First action with command if applicable]
                     2. [Second action]

                     RISK LEVEL: [LOW/MEDIUM/HIGH]

                     Keep responses concise and terminal-friendly (max 60 chars wide).`,
            messages: [{
                role: 'user',
                content: `User question: ${userQuestion}

                Drive diagnostics:
                ${JSON.stringify(context, null, 2)}

                Provide troubleshooting advice.`
            }]
        });

        return message.content[0].text;
    }

    // Suggest and optionally execute fixes
    async executeSuggestion(command, device) {
        // Safety checks before execution
        const dangerous = ['dd', 'mkfs', 'parted', 'fdisk'];
        const isDangerous = dangerous.some(cmd => command.includes(cmd));

        console.log(chalk.yellow(`\nSuggested command: ${command}`));

        if (isDangerous) {
            console.log(chalk.red('⚠️  WARNING: This command can destroy data!'));
        }

        const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: 'Execute this command?',
            default: false
        }]);

        if (!confirm) return null;

        try {
            const output = execSync(command, { encoding: 'utf8' });
            return output;
        } catch (err) {
            return `Error: ${err.message}`;
        }
    }

    // Helper methods for context collection
    getDriveInfo(device) {
        try {
            return execSync(`lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,MODEL,SERIAL ${device} --json`, { encoding: 'utf8' });
        } catch { return null; }
    }

    getSmartData(device) {
        try {
            // Remove partition number for disk device
            const disk = device.replace(/p?\d+$/, '');
            return execSync(`smartctl -A ${disk} 2>/dev/null || echo "SMART unavailable"`, { encoding: 'utf8' });
        } catch { return null; }
    }

    getFilesystemInfo(device) {
        try {
            return {
                tune2fs: execSync(`tune2fs -l ${device} 2>/dev/null || echo "N/A"`, { encoding: 'utf8' }),
                df: execSync(`df -h ${device} 2>/dev/null || echo "Not mounted"`, { encoding: 'utf8' })
            };
        } catch { return null; }
    }

    getMountOptions(device) {
        try {
            return execSync(`grep ${device} /proc/mounts || echo "Not mounted"`, { encoding: 'utf8' });
        } catch { return null; }
    }

    getRecentErrors(device) {
        try {
            const shortDevice = device.replace('/dev/', '');
            return execSync(`dmesg | grep -i "${shortDevice}" | tail -20`, { encoding: 'utf8' });
        } catch { return null; }
    }

    getIOStats(device) {
        try {
            const shortDevice = device.replace('/dev/', '');
            return execSync(`cat /sys/block/${shortDevice}/stat 2>/dev/null || echo "N/A"`, { encoding: 'utf8' });
        } catch { return null; }
    }
}

module.exports = new ClaudeTroubleshooter();
```

### Menu Integration

Add to Disk Maintenance menu:

```javascript
// In maintenanceMenu() function
const choices = [
    { name: 'Find largest directories', value: 'largest_dirs' },
    { name: 'Interactive disk analyzer (ncdu)', value: 'interactive' },
    { name: 'Check filesystem for errors', value: 'fsck' },
    { name: 'Check SMART health status', value: 'smart' },
    { name: 'Check boot configuration', value: 'boot_config' },
    { name: 'Check system logs for disk errors', value: 'system_errors' },
    new inquirer.Separator(),
    { name: '🤖 Ask Claude for help', value: 'claude_help' },  // NEW
    new inquirer.Separator(),
    { name: 'Back to main menu', value: 'back' }
];

// Add handler
case 'claude_help':
    await askClaudeForHelp();
    break;
```

### Interactive Troubleshooting Flow

```javascript
async function askClaudeForHelp() {
    const chalk = require('chalk');
    const claudeTroubleshooter = require('./claude-troubleshooter');

    console.log(chalk.cyan('\n🤖 Claude AI Troubleshooting Assistant\n'));

    // Select drive
    const detected = detect.detectDrives();
    const choices = detected.map(d => ({
        name: `${d.name} (${d.size}) - ${d.mountpoint}`,
        value: d.device
    }));

    const { device } = await inquirer.prompt([{
        type: 'list',
        name: 'device',
        message: 'Select drive to troubleshoot:',
        choices
    }]);

    // Ask user's question
    const { question } = await inquirer.prompt([{
        type: 'input',
        name: 'question',
        message: 'What issue are you experiencing?',
        default: 'Check this drive for any issues'
    }]);

    // Show collecting diagnostic data
    console.log(chalk.dim('\nCollecting diagnostic data...'));

    // Get Claude's analysis
    try {
        const response = await claudeTroubleshooter.troubleshoot(device, question);

        console.log(chalk.cyan('\n' + '='.repeat(60)));
        console.log(response);
        console.log(chalk.cyan('='.repeat(60) + '\n'));

        // Offer to execute suggestions
        const { followUp } = await inquirer.prompt([{
            type: 'list',
            name: 'followUp',
            message: 'What would you like to do?',
            choices: [
                { name: 'Ask another question', value: 'ask_again' },
                { name: 'Execute suggested command', value: 'execute' },
                { name: 'Back to maintenance menu', value: 'back' }
            ]
        }]);

        if (followUp === 'ask_again') {
            await askClaudeForHelp();
        } else if (followUp === 'execute') {
            const { command } = await inquirer.prompt([{
                type: 'input',
                name: 'command',
                message: 'Enter command to execute:'
            }]);

            const result = await claudeTroubleshooter.executeSuggestion(command, device);
            console.log(result);
        }
    } catch (err) {
        console.error(chalk.red('Error communicating with Claude:'), err.message);
    }
}
```

## Setup Requirements

### 1. Install Claude SDK
```bash
npm install @anthropic-ai/sdk
```

### 2. API Key Configuration
```bash
# Add to ~/.bashrc or .env
export ANTHROPIC_API_KEY="sk-ant-..."

# Or interactive first-time setup
diskmgt config --setup-claude
```

### 3. Dependencies
- Already installed: `child_process`, `inquirer`, `chalk`
- New: `@anthropic-ai/sdk`
- Optional: `smartmontools` (for SMART data)

## Cost Considerations

**Claude 3.5 Sonnet Pricing:**
- Input: $3 per million tokens
- Output: $15 per million tokens

**Typical troubleshooting session:**
- Context: ~2000 tokens ($0.006)
- Response: ~500 tokens ($0.0075)
- **Total per query: ~$0.014** (1.4 cents)

**Budget-friendly approach:**
- Cache drive diagnostics (Prompt Caching: -90% cost)
- Use Claude 3 Haiku for simpler queries ($0.25/$1.25 per M tokens)
- Local context summarization before sending to API

## Privacy & Security

### Data Sent to Claude:
- ✅ Drive model, size, filesystem type
- ✅ SMART attributes (health indicators)
- ✅ Mount options, I/O statistics
- ✅ Generic error messages (dmesg)
- ❌ No file contents or names
- ❌ No personal data
- ❌ No encryption keys

### User Control:
- Explicit opt-in for API key setup
- Show full context before sending
- Allow review of all suggested commands
- Never auto-execute destructive operations

## Example Interactions

### Example 1: Slow Drive Performance
```
User: My USB drive is really slow
Claude:
DIAGNOSIS:
Your drive is using the 'cfq' I/O scheduler which is suboptimal
for USB drives. SMART data shows healthy drive with no errors.

RECOMMENDATIONS:
1. Switch to 'deadline' scheduler:
   echo deadline > /sys/block/sda/queue/scheduler
2. Add 'noatime' mount option to reduce writes
3. Consider USB 3.0 port if on USB 2.0 (current: 480Mbps)

RISK LEVEL: LOW (changes are temporary until reboot)
```

### Example 2: Won't Mount
```
User: This drive won't mount anymore
Claude:
DIAGNOSIS:
Filesystem superblock is corrupted (ext4 journal errors).
Hardware is healthy (SMART: 0 errors). Likely caused by
improper removal or power loss during write.

RECOMMENDATIONS:
1. Attempt automatic repair:
   fsck.ext4 -y /dev/sdb1
2. If step 1 fails, force alternate superblock:
   fsck.ext4 -b 32768 /dev/sdb1
3. If both fail, use photorec for data recovery

RISK LEVEL: MEDIUM (fsck may cause data loss, backup first if possible)
```

### Example 3: Backup Strategy
```
User: What's the best way to backup this 120GB drive?
Claude:
DIAGNOSIS:
Source: 120GB used, ext4 filesystem
Mostly documents and photos (compressible data)

RECOMMENDATIONS:
1. Use tar with compression (fastest, smallest):
   Estimated size: ~85GB, Time: ~15 min
   Command: tar czf backup.tar.gz /source

2. For bootable backup, use dd + resize:
   Target must be ≥120GB
   Time: ~45 min

3. For incremental backups, use rsync:
   First backup: ~15 min, subsequent: <5 min

RISK LEVEL: LOW (read-only operations)
```

## Implementation Phases

### Phase 1: Basic Integration (MVP)
- [x] Install Claude SDK
- [ ] Create claude-troubleshooter.js module
- [ ] Add "Ask Claude" to maintenance menu
- [ ] Implement basic question/answer flow
- [ ] Test with ANTHROPIC_API_KEY from env

### Phase 2: Enhanced Context
- [ ] Add SMART data collection
- [ ] Collect filesystem statistics
- [ ] Parse recent error logs
- [ ] Add I/O performance metrics

### Phase 3: Interactive Actions
- [ ] Parse suggested commands from response
- [ ] Offer to execute safe commands
- [ ] Confirmation prompts for dangerous operations
- [ ] Show command results and follow-up questions

### Phase 4: Advanced Features
- [ ] Prompt caching for cost reduction
- [ ] Save troubleshooting history
- [ ] Learn from user feedback (thumbs up/down)
- [ ] Generate maintenance reports

## Alternative: Local LLM Option

For users without API access:

### Ollama Integration
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull mistral

# Use local API (same interface as Claude)
```

**Benefits:**
- No API costs
- Complete privacy
- Works offline

**Drawbacks:**
- Requires ~8GB RAM
- Slower responses
- Less accurate than Claude

## Questions to Consider

1. **API Key Management**:
   - Store in ~/.config/diskmgt/config.json?
   - Prompt for key on first use?

2. **Safety Limits**:
   - Should we restrict certain commands?
   - Require double confirmation for destructive ops?

3. **Offline Fallback**:
   - Show basic help when no API key?
   - Offer Ollama setup instructions?

4. **Cost Control**:
   - Add usage tracking?
   - Warn when approaching spending limits?

## Recommendation

**Start with Phase 1 MVP:**
1. Simple Q&A integration in maintenance menu
2. Manual command execution (copy/paste)
3. Validate usefulness with real scenarios

**Then iterate based on user feedback:**
- If useful → Add Phases 2-3
- If too expensive → Add Ollama option
- If too complex → Simplify UX

Would you like me to implement Phase 1 MVP?
