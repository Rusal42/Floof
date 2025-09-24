const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function syncData() {
    try {
        console.log('🔄 Syncing bot data...');

        // Ensure we are inside a git repository; if not, skip silently
        const execOpts = {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } // never prompt for credentials
        };

        try {
            const inRepo = execSync('git rev-parse --is-inside-work-tree', execOpts).toString().trim();
            if (inRepo !== 'true') {
                console.log('ℹ️ Not a git repository; skipping sync');
                return;
            }
        } catch {
            console.log('ℹ️ No git repository detected; skipping sync');
            return;
        }

        // Check if there are changes in data directory
        const status = execSync('git status --porcelain data/', execOpts);

        if (status.trim()) {
            console.log('📝 Data changes detected, committing...');
            execSync('git add data/', execOpts);
            execSync(`git commit -m "Auto-sync bot data - ${new Date().toISOString()}"`, execOpts);

            // Determine if we should push. Default: push only on Windows unless explicitly enabled elsewhere.
            const pushEnabled = (process.platform === 'win32')
                ? (process.env.AUTO_SYNC_PUSH !== 'false') // Windows default: true
                : (process.env.AUTO_SYNC_PUSH === 'true'); // Non-Windows default: false

            if (pushEnabled) {
                // Ensure an origin remote exists before attempting push
                try {
                    const remote = execSync('git remote get-url origin', execOpts).toString().trim();
                    if (remote) {
                        try {
                            execSync('git push', execOpts);
                            console.log('✅ Data synced and pushed successfully!');
                        } catch (pushErr) {
                            console.warn('⚠️ Commit saved locally, but push failed (no credentials or network).');
                        }
                    } else {
                        console.log('ℹ️ No origin remote configured; commit saved locally.');
                    }
                } catch {
                    console.log('ℹ️ No origin remote configured; commit saved locally.');
                }
            } else {
                console.log('ℹ️ Auto-push disabled on this OS; commit saved locally. Set AUTO_SYNC_PUSH=true to enable.');
            }
        } else {
            console.log('ℹ️ No data changes to sync');
        }
    } catch (error) {
        console.error('❌ Failed to sync data:', error.message);
    }
}

// Auto-sync on process exit
process.on('SIGINT', () => {
    console.log('\n🛑 Bot shutting down...');
    syncData();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Bot shutting down...');
    syncData();
    process.exit(0);
});

// Auto-sync every hour
setInterval(() => {
    syncData();
}, 60 * 60 * 1000); // 1 hour

module.exports = { syncData };
