const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance } = require('./utils/balance-manager');

// Cooldown tracking
const begCooldowns = {};

module.exports = {
    name: 'beg',
    description: 'Beg for coins when you\'re broke',
    usage: '%beg',
    category: 'gambling',
    aliases: ['plead', 'ask'],
    cooldown: 60, // 1 minute cooldown

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining } = require('./beatup');
        if (isArrested(userId)) {
            const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`🚔 You are currently under arrest! You cannot beg for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Check cooldown
        const now = Date.now();
        const cooldownAmount = 60 * 1000; // 1 minute
        
        if (begCooldowns[userId] && now < begCooldowns[userId] + cooldownAmount) {
            const timeLeft = Math.round((begCooldowns[userId] + cooldownAmount - now) / 1000);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`⏰ You need to wait **${timeLeft}** more seconds before begging again!`)
                        .setColor(0xffa500)
                ]
            });
        }

        // Set cooldown
        begCooldowns[userId] = now;

        // Beg responses and amounts
        const begResponses = [
            { text: 'A kind stranger gives you some coins!', min: 10, max: 50 },
            { text: 'You found some coins on the ground!', min: 5, max: 30 },
            { text: 'Someone felt sorry for you and donated!', min: 15, max: 75 },
            { text: 'A generous person helped you out!', min: 20, max: 100 },
            { text: 'You performed a sad song and got tips!', min: 25, max: 80 },
            { text: 'A wealthy merchant took pity on you!', min: 50, max: 150 },
            { text: 'You helped someone and they rewarded you!', min: 30, max: 120 },
            { text: 'You found a lucky penny... and more!', min: 1, max: 25 }
        ];

        const selectedResponse = begResponses[Math.floor(Math.random() * begResponses.length)];
        const earnings = Math.floor(Math.random() * (selectedResponse.max - selectedResponse.min + 1)) + selectedResponse.min;
        
        // Add earnings to balance
        const newBalance = addBalance(userId, earnings);
        
        const embed = new EmbedBuilder()
            .setTitle('🥺 Begging Results')
            .setDescription(`${selectedResponse.text}\n\nYou received **${earnings.toLocaleString()}** coins!\n\n💰 New balance: **${newBalance.toLocaleString()}** coins`)
            .setColor(0x00ff00)
            .setTimestamp();

        await sendAsFloofWebhook(message, { embeds: [embed] });
    }
};

// Export cooldowns for external access if needed
module.exports.cooldowns = begCooldowns;
