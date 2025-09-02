const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance } = require('./utils/balance-manager');
const { getCrimeData, saveCrimeData } = require('./utils/crime-manager');

module.exports = {
    name: 'bodyguards',
    description: 'Manage your personal bodyguards - hire, assign, and view protection',
    usage: '%bodyguards [view|hire|assign|fire] [bodyguard_type] [assignment]',
    category: 'gambling',
    aliases: ['bg', 'guards', 'protection'],
    cooldown: 5,

    async execute(message, args) {
        const userId = message.author.id;
        const action = args[0]?.toLowerCase() || 'view';

        switch (action) {
            case 'view':
            case 'list':
                return await displayBodyguards(message, userId);
            case 'hire':
                return await hireBodyguard(message, userId, args[1]);
            case 'assign':
                return await assignBodyguard(message, userId, args[1], args[2]);
            case 'fire':
            case 'dismiss':
                return await fireBodyguard(message, userId, args[1]);
            default:
                return await displayBodyguards(message, userId);
        }
    }
};

async function displayBodyguards(message, userId) {
    const crimeData = getCrimeData(userId);
    const bodyguards = crimeData.bodyguards || {};
    const userBalance = getBalance(userId);

    let description = '**🛡️ Your Personal Protection Force**\n\n';

    if (Object.keys(bodyguards).length === 0) {
        description += '❌ **No bodyguards hired**\n\n';
        description += '💡 Use `%blackmarket` to hire bodyguards for protection!\n';
        description += '💡 Or use `%bodyguards hire [type]` to hire directly\n\n';
    } else {
        let totalProtection = 0;
        let dailyCost = 0;

        Object.entries(bodyguards).forEach(([type, data]) => {
            const info = getBodyguardInfo(type);
            if (info) {
                totalProtection += info.attack_reduction * data.count;
                dailyCost += info.daily_wage * data.count;
                
                description += `${info.emoji} **${info.name}** x${data.count}\n`;
                description += `└ 🛡️ Protection: ${(info.attack_reduction * 100).toFixed(0)}% each\n`;
                description += `└ 💰 Daily Cost: ${info.daily_wage.toLocaleString()} coins each\n`;
                description += `└ 📍 Assignment: ${data.assignment || 'Personal Protection'}\n\n`;
            }
        });

        description += `**📊 Total Protection:** ${(Math.min(totalProtection * 100, 80)).toFixed(0)}% damage reduction\n`;
        description += `**💸 Daily Wages:** ${dailyCost.toLocaleString()} coins\n\n`;
    }

    description += '**Available Commands:**\n';
    description += '• `%bodyguards hire [type]` - Hire from blackmarket\n';
    description += '• `%bodyguards assign [type] [personal|business]` - Assign protection\n';
    description += '• `%bodyguards fire [type]` - Dismiss a bodyguard\n';
    description += '• `%blackmarket` - Browse available bodyguards\n\n';

    description += '**💡 Protection Types:**\n';
    description += '• **Personal:** Protects you from attacks and robberies\n';
    description += '• **Business:** Protects your businesses from raids\n';

    const embed = new EmbedBuilder()
        .setTitle('🛡️ Bodyguard Management')
        .setDescription(description)
        .setColor(0x2c2c2c)
        .setFooter({ text: `Balance: ${userBalance.toLocaleString()} coins` })
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('bodyguards_refresh')
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('bodyguards_blackmarket')
                .setLabel('🛒 Hire More')
                .setStyle(ButtonStyle.Primary)
        );

    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row]
    });
}

async function hireBodyguard(message, userId, bodyguardType) {
    if (!bodyguardType) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify bodyguard type: `basic`, `professional`, or `elite`')
                    .setColor(0xff0000)
            ]
        });
    }

    const type = bodyguardType.toLowerCase().replace('_bodyguard', '') + '_bodyguard';
    const info = getBodyguardInfo(type);
    
    if (!info) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid bodyguard type! Available: `basic`, `professional`, `elite`')
                    .setColor(0xff0000)
            ]
        });
    }

    const userBalance = getBalance(userId);
    if (userBalance < info.hire_cost) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Insufficient funds! You need ${info.hire_cost.toLocaleString()} coins to hire a ${info.name}.`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Deduct cost and add bodyguard
    const { deductBalance } = require('./utils/balance-manager');
    deductBalance(userId, info.hire_cost);

    const crimeData = getCrimeData(userId);
    if (!crimeData.bodyguards) crimeData.bodyguards = {};
    if (!crimeData.bodyguards[type]) {
        crimeData.bodyguards[type] = { count: 0, assignment: 'personal' };
    }
    crimeData.bodyguards[type].count += 1;
    saveCrimeData(userId, crimeData);

    const embed = new EmbedBuilder()
        .setTitle('🛡️ Bodyguard Hired!')
        .setDescription(`${info.emoji} Successfully hired a **${info.name}**!\n\n💰 **Cost:** ${info.hire_cost.toLocaleString()} coins\n🛡️ **Protection:** ${(info.attack_reduction * 100).toFixed(0)}% damage reduction\n💸 **Daily Wage:** ${info.daily_wage.toLocaleString()} coins\n📍 **Assignment:** Personal Protection\n\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins`)
        .setColor(0x00ff00)
        .setTimestamp();

    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function assignBodyguard(message, userId, bodyguardType, assignment) {
    if (!bodyguardType || !assignment) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Usage: `%bodyguards assign [type] [personal|business]`')
                    .setColor(0xff0000)
            ]
        });
    }

    const type = bodyguardType.toLowerCase().replace('_bodyguard', '') + '_bodyguard';
    const assignmentType = assignment.toLowerCase();

    if (!['personal', 'business'].includes(assignmentType)) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Assignment must be `personal` or `business`')
                    .setColor(0xff0000)
            ]
        });
    }

    const crimeData = getCrimeData(userId);
    if (!crimeData.bodyguards?.[type]?.count) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You don't have any ${bodyguardType} bodyguards to assign!`)
                    .setColor(0xff0000)
            ]
        });
    }

    crimeData.bodyguards[type].assignment = assignmentType;
    saveCrimeData(userId, crimeData);

    const info = getBodyguardInfo(type);
    const embed = new EmbedBuilder()
        .setTitle('📍 Bodyguard Assignment Updated')
        .setDescription(`${info.emoji} Your **${info.name}** (x${crimeData.bodyguards[type].count}) has been assigned to **${assignmentType.charAt(0).toUpperCase() + assignmentType.slice(1)} Protection**!`)
        .setColor(0x00ff00)
        .setTimestamp();

    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function fireBodyguard(message, userId, bodyguardType) {
    if (!bodyguardType) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify which bodyguard type to fire: `basic`, `professional`, or `elite`')
                    .setColor(0xff0000)
            ]
        });
    }

    const type = bodyguardType.toLowerCase().replace('_bodyguard', '') + '_bodyguard';
    const crimeData = getCrimeData(userId);

    if (!crimeData.bodyguards?.[type]?.count) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You don't have any ${bodyguardType} bodyguards to fire!`)
                    .setColor(0xff0000)
            ]
        });
    }

    crimeData.bodyguards[type].count -= 1;
    if (crimeData.bodyguards[type].count <= 0) {
        delete crimeData.bodyguards[type];
    }
    saveCrimeData(userId, crimeData);

    const info = getBodyguardInfo(type);
    const embed = new EmbedBuilder()
        .setTitle('🚪 Bodyguard Dismissed')
        .setDescription(`${info.emoji} You have dismissed a **${info.name}**.\n\n💸 You will save ${info.daily_wage.toLocaleString()} coins per day in wages.`)
        .setColor(0xffa500)
        .setTimestamp();

    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

function getBodyguardInfo(type) {
    const bodyguardTypes = {
        basic_bodyguard: {
            name: 'Basic Bodyguard',
            emoji: '👨‍💼',
            hire_cost: 5000,
            daily_wage: 500,
            protection_level: 1,
            attack_reduction: 0.20
        },
        professional_bodyguard: {
            name: 'Professional Bodyguard',
            emoji: '🕴️',
            hire_cost: 15000,
            daily_wage: 1000,
            protection_level: 2,
            attack_reduction: 0.40
        },
        elite_bodyguard: {
            name: 'Elite Bodyguard',
            emoji: '🥷',
            hire_cost: 50000,
            daily_wage: 2000,
            protection_level: 3,
            attack_reduction: 0.60
        }
    };
    
    return bodyguardTypes[type];
}

// Export display function for interaction handler
module.exports.displayBodyguards = displayBodyguards;
