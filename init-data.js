const fs = require('fs').promises;
const path = require('path');

async function initializeDataDirectory() {
    const dataDir = path.join(__dirname, 'data');
    const configFiles = [
        'server-configs.json',
        'infractions.json',
        'ticket-config.json',
        'voice-config.json',
        'prefix-config.json'
    ];

    try {
        // Create data directory if it doesn't exist
        await fs.mkdir(dataDir, { recursive: true });
        console.log(`✅ Created/Verified data directory: ${dataDir}`);

        // Initialize empty config files if they don't exist
        for (const file of configFiles) {
            const filePath = path.join(dataDir, file);
            try {
                await fs.access(filePath);
                console.log(`✅ Config file exists: ${file}`);
            } catch {
                await fs.writeFile(filePath, '{}', 'utf8');
                console.log(`✅ Created empty config: ${file}`);
            }
        }

        // Set proper permissions (Linux/Mac)
        if (process.platform !== 'win32') {
            await fs.chmod(dataDir, 0o755);
            for (const file of configFiles) {
                const filePath = path.join(dataDir, file);
                await fs.chmod(filePath, 0o644);
            }
        }

        console.log('✅ Data directory initialization complete!');
    } catch (error) {
        console.error('❌ Error initializing data directory:', error);
        process.exit(1);
    }
}

// Run the initialization
initializeDataDirectory();
