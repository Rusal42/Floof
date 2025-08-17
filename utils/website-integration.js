const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Website API configuration
// Use env var if provided; default to local dev API on port 3001
const WEBSITE_API_URL = process.env.WEBSITE_API_URL || 'https://floofwebsite.netlify.app/api/update-stats';
// Optional explicit rules sync endpoint. If not provided, we will derive from WEBSITE_API_URL's origin.
const WEBSITE_RULES_URL = process.env.WEBSITE_RULES_URL || '';
const BOT_API_TOKEN = process.env.BOT_API_TOKEN;
const WEBSITE_STATS_LOG = (process.env.WEBSITE_STATS_LOG || 'info').toLowerCase(); // info | warn | error | silent

// Logging helpers controlled by WEBSITE_STATS_LOG
function shouldLog(level) {
    const order = { info: 3, warn: 2, error: 1, silent: 0 };
    return order[WEBSITE_STATS_LOG] >= order[level];
}

// Lightweight health ping (no user/server payload)
async function pingWebsiteHealth() {
    try {
        if (!WEBSITE_API_URL) return;

        // Derive a safe health URL that won't 405 (avoid POST-only endpoints)
        const healthUrl = (() => {
            if (process.env.WEBSITE_HEALTH_URL) return process.env.WEBSITE_HEALTH_URL;
            try {
                const u = new URL(WEBSITE_API_URL);
                // Prefer explicit health endpoint on the same origin
                return `${u.origin}/api/health`;
            } catch (_) {
                // Fallbacks for non-URL strings
                const base = WEBSITE_API_URL.split('/api/')[0];
                // If we had an /api/ segment, append /api/health to the base; else return as-is
                return base ? `${base}/api/health` : WEBSITE_API_URL;
            }
        })();

        const headers = { 
            'Accept': 'text/html,application/json;q=0.9,*/*;q=0.8'
        };
        if (BOT_API_TOKEN) headers['x-bot-token'] = BOT_API_TOKEN; // optional

        const response = await fetch(healthUrl, {
            method: 'GET',
            headers
        });

        const ok = response.ok;
        const statusInfo = `${response.status} ${response.statusText || ''}`.trim();
        if (ok) {
            logInfo(`✅ Website health OK (${statusInfo}) @ ${healthUrl}`);
        } else {
            const rawText = await response.text().catch(() => '');
            logWarn('⚠️ Website health check not OK', { url: healthUrl, status: response.status, statusText: response.statusText, raw: rawText?.slice(0, 200) });
        }
    } catch (error) {
        logError('❌ Website health ping error:', error.message);
    }
}
function logInfo(...args) { if (shouldLog('info')) console.log(...args); }
function logWarn(...args) { if (shouldLog('warn')) console.warn(...args); }
function logError(...args) { if (shouldLog('error')) console.error(...args); }

// Resolve a base origin from WEBSITE_API_URL (e.g., https://site.com)
function resolveWebsiteBase() {
    try {
        const u = new URL(WEBSITE_API_URL);
        return u.origin;
    } catch (_) {
        // Fallback: try to split by /api/
        const base = WEBSITE_API_URL.split('/api/')[0];
        return base || WEBSITE_API_URL;
    }
}

// Derive rules sync URL
function getRulesSyncUrl() {
    if (WEBSITE_RULES_URL) return WEBSITE_RULES_URL;
    const base = resolveWebsiteBase();
    return `${base}/api/rules-sync`;
}

// Resolve bot version from package.json (read once and cache)
let BOT_VERSION = '0.0.0';
try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg && typeof pkg.version === 'string') BOT_VERSION = pkg.version;
    }
} catch (e) {
    logWarn('Unable to read bot version from package.json, defaulting to 0.0.0');
}

// Stats tracking storage
const statsPath = path.join(__dirname, '..', 'data', 'bot-stats.json');

// Initialize stats file if it doesn't exist
function initializeStats() {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(statsPath)) {
        const initialStats = {
            commandsUsed: 0,
            startTime: Date.now(),
            totalUptime: 0,
            disconnections: 0,
            lastUpdate: Date.now()
        };
        fs.writeFileSync(statsPath, JSON.stringify(initialStats, null, 2));
    }
}

// Load stats from file
function loadStats() {
    try {
        if (fs.existsSync(statsPath)) {
            return JSON.parse(fs.readFileSync(statsPath, 'utf8'));
        }
    } catch (error) {
        logError('Error loading stats:', error);
    }
    return {
        commandsUsed: 0,
        startTime: Date.now(),
        totalUptime: 0,
        disconnections: 0,
        lastUpdate: Date.now()
    };
}

// Save stats to file
function saveStats(stats) {
    try {
        fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    } catch (error) {
        logError('Error saving stats:', error);
    }
}

// Increment command usage counter
function incrementCommandUsage() {
    const stats = loadStats();
    stats.commandsUsed++;
    stats.lastUpdate = Date.now();
    saveStats(stats);
}

// Calculate uptime percentage
function calculateUptimePercentage() {
    const stats = loadStats();
    const currentTime = Date.now();
    const totalTimeRunning = currentTime - stats.startTime;
    const actualUptime = totalTimeRunning - (stats.disconnections * 60000); // Assume 1 min per disconnection
    return Math.max(0, Math.min(100, (actualUptime / totalTimeRunning) * 100));
}

// Record a disconnection
function recordDisconnection() {
    const stats = loadStats();
    stats.disconnections++;
    saveStats(stats);
}

// Get command usage count
function getCommandUsageCount() {
    const stats = loadStats();
    return stats.commandsUsed;
}

// Main function to update website stats
async function updateWebsiteStats(client) {
    try {
        // Calculate real bot statistics
        const serverCount = client.guilds.cache.size;
        const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        const commandsUsed = getCommandUsageCount();
        // Real uptime in seconds: prefer Discord client's uptime (ms), fallback to process uptime
        const uptime = Math.floor(((client?.uptime ?? (process.uptime() * 1000)) || 0) / 1000);
        const ping = client.ws.ping;

        logInfo(`📊 Updating website stats: ${serverCount} servers, ${userCount} users, ${commandsUsed} commands used, uptime ${uptime}s`);

        // Send stats to website (auth optional)
        const headers = { 'Content-Type': 'application/json' };
        if (BOT_API_TOKEN) headers['x-bot-token'] = BOT_API_TOKEN;
        const response = await fetch(WEBSITE_API_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                serverCount,
                userCount,
                commandsUsed,
                uptime,
                ping,
                version: BOT_VERSION,
                timestamp: Date.now()
            })
        });

        // Read raw response text to ensure we can log non-JSON bodies
        const rawText = await response.text();
        let result;
        try {
            result = rawText ? JSON.parse(rawText) : {};
        } catch (_) {
            result = { error: 'Non-JSON response', raw: rawText };
        }

        if (response.ok && result.success) {
            logInfo('✅ Website stats updated successfully');
        } else if (response.ok) {
            // OK response but no success flag — treat as informational to avoid noisy errors
            logWarn('ℹ️ Website responded 200 OK without success flag (suppressed error).', {
                result: typeof result === 'object' ? result : String(result)
            });
        } else {
            logError('❌ Failed to update website stats:', {
                status: response.status,
                statusText: response.statusText,
                result
            });
        }
    } catch (error) {
        logError('❌ Error updating website stats:', error.message);
    }
}

// Start the stats updater with configurable interval
function startStatsUpdater(client, intervalMinutes = 5) {
    logInfo(`🌐 Starting website stats updater (every ${intervalMinutes} minutes)`);
    logInfo(`➡️ Using WEBSITE_API_URL: ${WEBSITE_API_URL}`);

    // Initialize stats tracking (kept for backward compatibility, though not used in health pings)
    initializeStats();

    // Health ping shortly after startup
    setTimeout(() => {
        pingWebsiteHealth();
    }, 5000);

    // Immediately send a stats update on startup so uptime reflects current session
    setTimeout(() => {
        updateWebsiteStats(client).catch(err => logError('Immediate stats update failed:', err?.message || err));
    }, 7000);

    // Periodic health pings
    const interval = setInterval(() => {
        pingWebsiteHealth();
    }, intervalMinutes * 60 * 1000);

    // Periodic stats updates (every 60 seconds) to keep uptime fresh on the website
    const statsInterval = setInterval(() => {
        updateWebsiteStats(client).catch(err => logError('Periodic stats update failed:', err?.message || err));
    }, 60 * 1000);

    // Return both intervals so caller could clear if needed
    return { healthInterval: interval, statsInterval };
}

// Changelog hook: only update website version (no full changelog payload)
async function sendChangelogUpdate(client, changelogData) {
    try {
        if (!BOT_API_TOKEN) {
            logWarn('⚠️ BOT_API_TOKEN not configured, skipping changelog update');
            return;
        }

        // Only update version on the website using the stats endpoint
        const minimalPayload = {
            version: BOT_VERSION,
            timestamp: Date.now()
        };

        logInfo('🔖 Updating website version only via /update-stats', minimalPayload);

        const response = await fetch(WEBSITE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-bot-token': BOT_API_TOKEN
            },
            body: JSON.stringify(minimalPayload)
        });

        const rawText = await response.text();
        let result;
        try {
            result = rawText ? JSON.parse(rawText) : {};
        } catch (_) {
            result = { error: 'Non-JSON response', raw: rawText };
        }

        if (response.ok && result.success) {
            logInfo('✅ Website version updated successfully');
        } else if (response.ok) {
            logWarn('ℹ️ Version update responded 200 OK without success flag (suppressed error).', {
                result: typeof result === 'object' ? result : String(result)
            });
        } else {
            logError('❌ Failed to update website version:', {
                status: response.status,
                statusText: response.statusText,
                result
            });
        }
    } catch (error) {
        logError('❌ Error updating website version:', error.message);
    }
}

module.exports = {
    updateWebsiteStats,
    startStatsUpdater,
    pingWebsiteHealth,
    incrementCommandUsage,
    calculateUptimePercentage,
    recordDisconnection,
    getCommandUsageCount,
    sendChangelogUpdate,
    initializeStats,
    // Exported for rules syncing
    sendRulesConfigUpdate
};

// Send rules configuration to website for display in the Rules area
// cfg is expected to include keys like rulesChannel, rulesTitle, rulesDescription, rulesFooter, rulesButton, rulesAssignRole
async function sendRulesConfigUpdate(guild, cfg = {}) {
    try {
        const url = getRulesSyncUrl();
        if (!url) return;

        const payload = {
            guildId: guild?.id,
            guildName: guild?.name,
            rulesChannel: cfg.rulesChannel || null,
            rulesTitle: cfg.rulesTitle || null,
            rulesDescription: cfg.rulesDescription || null,
            rulesFooter: cfg.rulesFooter || null,
            rulesButton: cfg.rulesButton || null,
            rulesAssignRole: cfg.rulesAssignRole || null,
            version: BOT_VERSION,
            timestamp: Date.now()
        };

        const headers = { 'Content-Type': 'application/json' };
        if (BOT_API_TOKEN) headers['x-bot-token'] = BOT_API_TOKEN;

        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
        const raw = await res.text().catch(() => '');
        let parsed;
        try { parsed = raw ? JSON.parse(raw) : {}; } catch (_) { parsed = { raw }; }

        if (res.ok) {
            logInfo('✅ Synced rules config to website.', { url, status: res.status });
        } else {
            logWarn('⚠️ Rules sync did not succeed', { status: res.status, parsed });
        }
    } catch (err) {
        logError('❌ Error syncing rules config to website:', err?.message || err);
    }
}
