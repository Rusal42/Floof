const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance } = require('./utils/balance-manager');
const { getUserJob, addTotalEarned, JOB_TYPES } = require('./jobs');

// Work cooldowns
const workCooldowns = {};

module.exports = {
    name: 'work',
    description: 'Work at your job to earn coins',
    usage: '%work',
    category: 'gambling',
    aliases: ['job'],
    cooldown: 30, // 30 seconds

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
        const cooldownAmount = 30 * 1000; // 30 seconds
        
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

        // Check if user has a job
        const currentJob = getUserJob(userId);
        const jobInfo = JOB_TYPES[currentJob];
        
        if (currentJob === 'unemployed') {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`❌ You are unemployed! You cannot work without a job.\n\n💼 **Get a job first:**\n• Use \`%jobs\` to browse available positions\n• Use \`%jobs apply <job>\` to apply\n\n💡 **Until then, you can:**\n• \`%beg\` for spare change\n• Gamble with \`%slots\`, \`%blackjack\`, etc.\n• Do crimes like \`%rob\` or \`%attack\``)
                        .setColor(0xff0000)
                ]
            });
        }

        // Set cooldown
        workCooldowns[userId] = now;

        // Check for special work events (20% chance)
        let specialEvent = null;
        let bonusEarnings = 0;
        
        if (Math.random() < 0.2) {
            const specialEvents = {
                cashier: [
                    { event: 'A customer left a generous tip!', bonus: 20, emoji: '💵' },
                    { event: 'You found money someone dropped!', bonus: 15, emoji: '🪙' },
                    { event: 'A celebrity shopped and tipped you!', bonus: 50, emoji: '⭐' },
                    { event: 'You helped an elderly customer and they gave you extra!', bonus: 25, emoji: '👵' },
                    { event: 'A customer paid with exact change and said "keep it"!', bonus: 10, emoji: '🎯' }
                ],
                delivery: [
                    { event: 'Customer tipped for fast delivery!', bonus: 30, emoji: '🏃' },
                    { event: 'You delivered to a mansion and got a big tip!', bonus: 75, emoji: '🏰' },
                    { event: 'Found a lucky coin on your route!', bonus: 20, emoji: '🍀' },
                    { event: 'Customer was so happy they doubled your pay!', bonus: 40, emoji: '😊' },
                    { event: 'You helped carry groceries and got extra!', bonus: 25, emoji: '🛍️' }
                ],
                waiter: [
                    { event: 'A table left an amazing tip!', bonus: 60, emoji: '🍽️' },
                    { event: 'You spilled soup but customer laughed and tipped anyway!', bonus: 35, emoji: '🍲' },
                    { event: 'A food critic was impressed with your service!', bonus: 80, emoji: '📝' },
                    { event: 'You recommended the perfect wine and got tipped!', bonus: 45, emoji: '🍷' },
                    { event: 'A customer proposed at your table and tipped big!', bonus: 100, emoji: '💍' }
                ],
                security: [
                    { event: 'Caught a shoplifter and got a bonus!', bonus: 50, emoji: '🚨' },
                    { event: 'Helped find a lost child and got rewarded!', bonus: 40, emoji: '👶' },
                    { event: 'Prevented a fight and management was grateful!', bonus: 60, emoji: '✋' },
                    { event: 'Found someone\'s lost wallet and got a reward!', bonus: 35, emoji: '👛' },
                    { event: 'Your vigilance impressed the boss!', bonus: 45, emoji: '👁️' }
                ],
                programmer: [
                    { event: 'Fixed a critical bug and got a bonus!', bonus: 100, emoji: '🐛' },
                    { event: 'Your code was so clean you got recognition!', bonus: 80, emoji: '✨' },
                    { event: 'Helped a coworker and they bought you coffee money!', bonus: 25, emoji: '☕' },
                    { event: 'Client loved your work and paid extra!', bonus: 120, emoji: '💻' },
                    { event: 'You optimized the server and saved the company money!', bonus: 90, emoji: '⚡' }
                ],
                manager: [
                    { event: 'Your team exceeded targets and you got a bonus!', bonus: 150, emoji: '📈' },
                    { event: 'Solved a major crisis and got recognition!', bonus: 200, emoji: '🔥' },
                    { event: 'Your leadership impressed the executives!', bonus: 120, emoji: '👑' },
                    { event: 'Negotiated a great deal and got commission!', bonus: 180, emoji: '🤝' },
                    { event: 'Your department won "Team of the Month"!', bonus: 160, emoji: '🏆' }
                ],
                executive: [
                    { event: 'Closed a million-dollar deal!', bonus: 300, emoji: '💎' },
                    { event: 'Your strategy saved the company millions!', bonus: 400, emoji: '🧠' },
                    { event: 'Board of directors gave you a performance bonus!', bonus: 250, emoji: '💼' },
                    { event: 'You were featured in a business magazine!', bonus: 200, emoji: '📰' },
                    { event: 'Your leadership turned around a failing project!', bonus: 350, emoji: '🚀' }
                ]
            };
            
            const jobEvents = specialEvents[currentJob];
            if (jobEvents) {
                specialEvent = jobEvents[Math.floor(Math.random() * jobEvents.length)];
                bonusEarnings = specialEvent.bonus;
            }
        }

        // Calculate earnings based on job
        let earnings = Math.floor(Math.random() * (jobInfo.pay_max - jobInfo.pay_min + 1)) + jobInfo.pay_min;
        earnings += bonusEarnings;
        
        // Add earnings to balance and track total earned
        const newBalance = addBalance(userId, earnings);
        addTotalEarned(userId, earnings);
        
        // Work completion messages based on job type
        const workMessages = {
            cashier: ['scanned items and helped customers', 'worked the register during rush hour', 'restocked shelves and assisted shoppers'],
            delivery: ['delivered packages across town', 'completed your delivery route', 'transported goods safely to customers'],
            waiter: ['served tables and took orders', 'provided excellent customer service', 'worked a busy dinner shift'],
            security: ['patrolled the premises', 'monitored security cameras', 'ensured safety and order'],
            programmer: ['debugged code and fixed issues', 'developed new features', 'optimized system performance'],
            manager: ['led team meetings and projects', 'managed daily operations', 'coordinated with departments'],
            executive: ['made strategic business decisions', 'attended board meetings', 'oversaw company operations']
        };
        
        const jobMessages = workMessages[currentJob] || ['completed your work tasks'];
        const selectedMessage = jobMessages[Math.floor(Math.random() * jobMessages.length)];
        
        let description = `${jobInfo.emoji} You ${selectedMessage} as a **${jobInfo.name}**`;
        
        if (specialEvent) {
            description += `\n\n${specialEvent.emoji} **Special Event:** ${specialEvent.event}`;
            description += `\n💰 **Base Pay:** ${(earnings - bonusEarnings).toLocaleString()} coins`;
            description += `\n🎁 **Bonus:** +${bonusEarnings.toLocaleString()} coins`;
            description += `\n💵 **Total Earned:** ${earnings.toLocaleString()} coins`;
        } else {
            description += ` and earned **${earnings.toLocaleString()}** coins!`;
        }
        
        description += `\n\n💰 **New Balance:** ${newBalance.toLocaleString()} coins\n⏰ **Next Shift:** Available in 30 seconds`;

        const embed = new EmbedBuilder()
            .setTitle('💼 Work Shift Complete!')
            .setDescription(description)
            .setColor(specialEvent ? 0xffd700 : 0x00ff00)
            .setTimestamp();

        await sendAsFloofWebhook(message, { embeds: [embed] });
    }
};
