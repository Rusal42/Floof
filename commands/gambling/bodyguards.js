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
    const { getUserBusinessData, BODYGUARD_TYPES } = require('./utils/business-manager');
    const userData = getUserBusinessData(userId);
    const bodyguards = userData.bodyguards || {};
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
            const info = BODYGUARD_TYPES[type];
            if (info) {
                totalProtection += info.attack_reduction;
                dailyCost += info.daily_wage;
                
                description += `${info.emoji} **${info.name}**\n`;
                description += `└ 🛡️ Protection: ${(info.attack_reduction * 100).toFixed(0)}% damage reduction\n`;
                description += `└ 💰 Daily Cost: ${info.daily_wage.toLocaleString()} coins\n`;
                description += `└ 📍 Assignment: Personal Protection\n\n`;
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
    const { hireBodyguard: businessHireBodyguard, BODYGUARD_TYPES } = require('./utils/business-manager');
    const { deductBalance } = require('./utils/balance-manager');
    
    const userBalance = getBalance(userId);
    const info = BODYGUARD_TYPES[type];
    
    if (!info) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid bodyguard type! Available: `basic`, `professional`, `elite`')
                    .setColor(0xff0000)
            ]
        });
    }

    if (userBalance < info.hire_cost) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Insufficient funds! You need ${info.hire_cost.toLocaleString()} coins to hire a ${info.name}.`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Use business manager's hire function
    const result = businessHireBodyguard(userId, type);
    
    if (!result.success) {
        let errorMsg = '❌ ';
        switch (result.reason) {
            case 'already_hired':
                errorMsg += 'You already have that type of bodyguard!';
                break;
            default:
                errorMsg += 'Failed to hire bodyguard!';
        }
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(errorMsg)
                    .setColor(0xff0000)
            ]
        });
    }

    // Deduct cost after successful hire
    deductBalance(userId, info.hire_cost);

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

    const { getUserBusinessData, saveUserBusinessData, BODYGUARD_TYPES } = require('./utils/business-manager');
    const userData = getUserBusinessData(userId);
    
    if (!userData.bodyguards?.[type]) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You don't have any ${bodyguardType} bodyguards to assign!`)
                    .setColor(0xff0000)
            ]
        });
    }

    userData.bodyguards[type].assignment = assignmentType;
    saveUserBusinessData(userId, userData);

    const info = BODYGUARD_TYPES[type];
    const embed = new EmbedBuilder()
        .setTitle('📍 Bodyguard Assignment Updated')
        .setDescription(`${info.emoji} Your **${info.name}** has been assigned to **${assignmentType.charAt(0).toUpperCase() + assignmentType.slice(1)} Protection**!`)
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
    const { getUserBusinessData, saveUserBusinessData, BODYGUARD_TYPES } = require('./utils/business-manager');
    const userData = getUserBusinessData(userId);

    if (!userData.bodyguards?.[type]) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You don't have any ${bodyguardType} bodyguards to fire!`)
                    .setColor(0xff0000)
            ]
        });
    }

    delete userData.bodyguards[type];
    saveUserBusinessData(userId, userData);

    const info = BODYGUARD_TYPES[type];
    const embed = new EmbedBuilder()
        .setTitle('🚪 Bodyguard Dismissed')
        .setDescription(`${info.emoji} You have dismissed your **${info.name}**.\n\n💸 You will save ${info.daily_wage.toLocaleString()} coins per day in wages.`)
        .setColor(0xffa500)
        .setTimestamp();

    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

function getBodyguardInfo(type) {
    const { BODYGUARD_TYPES } = require('./utils/business-manager');
    return BODYGUARD_TYPES[type];
}

// Export display function for interaction handler
module.exports.displayBodyguards = displayBodyguards;
