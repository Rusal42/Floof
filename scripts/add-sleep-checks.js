// Script to add sleep protection checks to all gambling commands
const fs = require('fs');
const path = require('path');

const gamblingDir = path.join(__dirname, '../commands/gambling');
const gamblingCommands = [
    'slots.js', 'blackjack.js', 'coinflip.js', 'roulette.js', 'gambling.js'
];

const sleepCheckCode = `        // Check if user is sleeping
        const { isUserSleeping } = require('./utils/blackmarket-manager');
        if (isUserSleeping(userId)) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(\`😴 You are fast asleep! You cannot gamble while under the effects of sleeping pills.\\n\\n💊 Wait for the effects to wear off before gambling again.\`)
                        .setColor(0x9b59b6)
                ]
            });
        }
        
`;

console.log('Adding sleep protection checks to gambling commands...');

gamblingCommands.forEach(filename => {
    const filePath = path.join(gamblingDir, filename);
    
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Find the arrest check pattern and add sleep check before it
        const arrestPattern = /(\s+)\/\/ Check if user is arrested/;
        const match = content.match(arrestPattern);
        
        if (match && !content.includes('Check if user is sleeping')) {
            const indentation = match[1];
            const sleepCheckWithIndent = sleepCheckCode.replace(/^        /gm, indentation);
            content = content.replace(arrestPattern, sleepCheckWithIndent + match[0]);
            
            fs.writeFileSync(filePath, content);
            console.log(`✅ Added sleep check to ${filename}`);
        } else if (content.includes('Check if user is sleeping')) {
            console.log(`⏭️ Sleep check already exists in ${filename}`);
        } else {
            console.log(`❌ Could not find arrest check pattern in ${filename}`);
        }
    } else {
        console.log(`❌ File not found: ${filename}`);
    }
});

console.log('Sleep protection checks added successfully!');
