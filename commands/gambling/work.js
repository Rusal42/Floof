const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance } = require('./utils/balance-manager');

// Cooldown tracking
const workCooldowns = {};

module.exports = {
    name: 'work',
    description: 'Work to earn coins',
    usage: '%work',
    category: 'gambling',
    aliases: ['job'],
    cooldown: 12, // 12 seconds as per original

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining } = require('./beatup');
        if (isArrested(userId)) {
            const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`🚔 You are currently under arrest! You cannot work for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Check cooldown
        const now = Date.now();
        const cooldownAmount = 12 * 1000; // 12 seconds
        
        if (workCooldowns[userId] && now < workCooldowns[userId] + cooldownAmount) {
            const timeLeft = Math.round((workCooldowns[userId] + cooldownAmount - now) / 1000);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`⏰ You need to wait **${timeLeft}** more seconds before working again!`)
                        .setColor(0xffa500)
                ]
            });
        }

        // Set cooldown
        workCooldowns[userId] = now;

        // Work jobs and payouts
        const jobs = [
            { job: 'delivered packages', min: 50, max: 150 },
            { job: 'walked dogs', min: 40, max: 120 },
            { job: 'cleaned houses', min: 60, max: 180 },
            { job: 'worked at a café', min: 45, max: 135 },
            { job: 'tutored students', min: 70, max: 200 },
            { job: 'did freelance work', min: 80, max: 250 },
            { job: 'worked construction', min: 90, max: 300 },
            { job: 'programmed websites', min: 100, max: 350 },
            { job: 'performed street magic', min: 30, max: 100 },
            { job: 'sold lemonade', min: 20, max: 80 }
        ];

        const selectedJob = jobs[Math.floor(Math.random() * jobs.length)];
        const earnings = Math.floor(Math.random() * (selectedJob.max - selectedJob.min + 1)) + selectedJob.min;
        
        // Add earnings to balance
        const newBalance = addBalance(userId, earnings);
        
        const embed = new EmbedBuilder()
            .setTitle('💼 Work Complete!')
            .setDescription(`You ${selectedJob.job} and earned **${earnings.toLocaleString()}** coins!\n\n💰 New balance: **${newBalance.toLocaleString()}** coins`)
            .setColor(0x00ff00)
            .setTimestamp();

        await sendAsFloofWebhook(message, { embeds: [embed] });
    }
};

// Export cooldowns for external access if needed
module.exports.cooldowns = workCooldowns;
