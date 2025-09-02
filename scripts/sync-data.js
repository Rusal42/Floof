const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function syncData() {
    try {
        console.log('🔄 Syncing bot data...');
        
        // Check if there are changes in data directory
        const status = execSync('git status --porcelain data/', { encoding: 'utf8' });
        
        if (status.trim()) {
            console.log('📝 Data changes detected, committing...');
            execSync('git add data/');
            execSync(`git commit -m "Auto-sync bot data - ${new Date().toISOString()}"`);
            execSync('git push');
            console.log('✅ Data synced successfully!');
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
