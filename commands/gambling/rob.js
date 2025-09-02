const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');
const { 
    BANKS,
    BUSINESSES,
    getUserCrimeData,
    attemptCrime,
    formatCrimeStats
} = require('./utils/crime-manager');

// Robbery cooldowns
const robberyCooldowns = {};

module.exports = {
    name: 'rob',
    description: 'Rob banks or businesses for big payouts - but beware of arrest!',
    usage: '%rob [bank/business] [target] | %rob stats',
    category: 'gambling',
    aliases: ['robbery', 'heist', 'steal', 'r', 'bank'],
    cooldown: 15,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining } = require('./beatup');
        if (isArrested(userId)) {
            const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`🚔 You are currently under arrest! You cannot commit crimes for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Check cooldown
        const now = Date.now();
        const cooldownAmount = 15 * 1000; // 15 seconds
        
        if (robberyCooldowns[userId] && now < robberyCooldowns[userId] + cooldownAmount) {
            const timeLeft = Math.round((robberyCooldowns[userId] + cooldownAmount - now) / 1000);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`⏰ You need to lay low! Wait **${timeLeft}** more seconds before your next crime.`)
                        .setColor(0xffa500)
                ]
            });
        }

        if (args.length === 0) {
            return await displayRobberyMenu(message, userId);
        }

        const targetType = args[0].toLowerCase();
        
        // Handle numbered selection: %r 1, %r 5
        if (!isNaN(parseInt(targetType))) {
            const targetNumber = parseInt(targetType);
            return await handleNumberedRobbery(message, userId, targetNumber);
        }
        
        if (targetType === 'bank') {
            return await handleBankRobbery(message, userId, args.slice(1));
        } else if (targetType === 'business') {
            return await handleBusinessRobbery(message, userId, args.slice(1));
        } else if (targetType === 'stats') {
            return await displayCrimeStats(message, userId);
        } else {
            // Try direct bank/business name
            return await handleDirectRobbery(message, userId, targetType);
        }
    }
};

async function displayRobberyMenu(message, userId) {
    const crimeData = getUserCrimeData(userId);
    
    let description = '**🔫 Criminal Underground**\n\n';
    description += '*Choose your target wisely... high risk, high reward.*\n\n';
    description += `🎯 **Your Crime Level:** ${crimeData.crime_level}\n`;
    description += `📊 **Success Rate:** ${crimeData.total_crimes > 0 ? Math.floor((crimeData.successful_crimes / crimeData.total_crimes) * 100) : 0}%\n\n`;
    
    description += '**🏦 Banks Available:**\n';
    Object.entries(BANKS).forEach(([bankId, bank]) => {
        const riskLevel = '⚠️'.repeat(bank.security_level);
        description += `${bank.emoji} **${bank.name}** ${riskLevel}\n`;
        description += `└ 💰 ${bank.payout.min.toLocaleString()} - ${bank.payout.max.toLocaleString()} coins\n`;
        description += `└ 🚔 ${Math.floor(bank.arrest_chance * 100)}% arrest chance\n`;
        description += `└ \`%rob bank ${bankId}\`\n\n`;
    });
    
    description += '**🏪 Businesses Available:**\n';
    let bankIndex = 1;
    Object.entries(BANKS).forEach(([bankId, bank]) => {
        description += `**${bankIndex}.** ${bank.emoji} **${bank.name}**\n`;
        description += `└ 💰 Payout: ${bank.min_payout.toLocaleString()}-${bank.max_payout.toLocaleString()} coins\n`;
        description += `└ 🚔 Risk: ${Math.floor((1 - bank.success_chance) * 100)}%\n`;
        description += `└ ${bank.description}\n`;
        description += `└ \`%r ${bankIndex}\` or \`%r ${bankId}\`\n\n`;
        bankIndex++;
    });
    
    description += '⚠️ **Warning:** All robberies carry risk of arrest!\n';
    description += '💡 **Quick Rob:** `%r <number>` or `%r <name>`\n';
    description += '📈 Use `%rob stats` to view your criminal record.';

    const embed = new EmbedBuilder()
        .setTitle('🔫 Criminal Underground')
        .setDescription(description)
        .setColor(0x8b0000)
        .setFooter({ text: 'Crime doesn\'t pay... or does it? 💰' })
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleBankRobbery(message, userId, args) {
    if (args.length < 1) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify which bank to rob!\nExample: `%rob bank local_credit_union`')
                    .setColor(0xff0000)
            ]
        });
    }

    const bankId = args[0].toLowerCase();
    const bank = BANKS[bankId];
    
    if (!bank) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Unknown bank! Use `%rob` to see available targets.')
                    .setColor(0xff0000)
            ]
        });
    }

    // Set cooldown
    robberyCooldowns[userId] = Date.now();

    // Check if user has crime risk warnings enabled
    const { userAllows } = require('./utils/user-preferences');
    if (userAllows(userId, 'crime_risk_warnings')) {
        const bank = BANKS[bankId];
        const riskLevel = Math.floor((1 - bank.success_chance) * 100);
        
        if (riskLevel > 50) {
            // High risk warning
            const warningEmbed = new EmbedBuilder()
                .setTitle('⚠️ High Risk Crime Warning')
                .setDescription(`**${bank.emoji} ${bank.name}** has a **${riskLevel}% arrest chance**!\n\n🚔 **Jail Time:** ${bank.min_jail_time}-${bank.max_jail_time} minutes\n💸 **Potential Bail:** ${Math.floor(bank.min_jail_time * 500)}-${Math.floor(bank.max_jail_time * 1000)} coins\n\n*Are you sure you want to proceed?*\n\nDisable warnings: \`%preferences disable crime_risk_warnings\``)
                .setColor(0xff6b35)
                .setTimestamp();
                
            await sendAsFloofWebhook(message, { embeds: [warningEmbed] });
        }
    }

    const result = attemptCrime(userId, 'bank', bankId);

    if (!result.success) {
        if (result.reason === 'owner_disabled_robberies') {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🚫 Robbery Blocked')
                        .setDescription(`The business owner has disabled robberies in their privacy settings.\n\n*Respect other users' preferences!*\n\nThey can enable robberies with \`%preferences enable allow_robberies\``)
                        .setColor(0xe74c3c)
                        .setTimestamp()
                ]
            });
        }
        
        if (result.reason === 'arrested') {
            // Use crime manager arrest function
            const { arrestUser } = require('./utils/crime-manager');
            const arrestDuration = result.arrest_time * 60 * 1000; // Convert to milliseconds
            arrestUser(userId, arrestDuration, 'Bank Robbery', result.bail_amount);
            
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🚨 BUSTED!')
                        .setDescription(`**POLICE RAID!** You were caught robbing ${result.target.emoji} **${result.target.name}**!\n\n🚔 **ARRESTED** for ${result.arrest_time} minutes!\n💸 **Bail Amount:** ${result.bail_amount.toLocaleString()} coins\n\n*The security cameras got everything...*\n\nUse \`%bail\` to pay bail or wait for a friend to help!`)
                        .setColor(0xff0000)
                        .setTimestamp()
                ]
            });
        }
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Robbery failed!')
                    .setColor(0xff0000)
            ]
        });
    }

    // Successful robbery
    addBalance(userId, result.payout);
    
    const embed = new EmbedBuilder()
        .setTitle('💰 Bank Heist Successful!')
        .setDescription(`${result.target.emoji} You successfully robbed **${result.target.name}**!\n\n💰 **Stolen:** ${result.payout.toLocaleString()} coins\n⭐ **Crime XP:** +${result.xp_gained}\n🎯 **Crime Level:** ${result.new_level}\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins\n\n*You slip away into the shadows...*`)
        .setColor(0x00ff00)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleBusinessRobbery(message, userId, args) {
    if (args.length < 1) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify which business to rob!\nExample: `%rob business convenience_store`')
                    .setColor(0xff0000)
            ]
        });
    }

    const businessId = args[0].toLowerCase();
    const business = BUSINESSES[businessId];
    
    if (!business) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Unknown business! Use `%rob` to see available targets.')
                    .setColor(0xff0000)
            ]
        });
    }

    // Set cooldown
    robberyCooldowns[userId] = Date.now();

    const result = attemptCrime(userId, 'business', businessId);

    if (!result.success) {
        if (result.reason === 'arrested') {
            // Use crime manager arrest function
            const { arrestUser } = require('./utils/crime-manager');
            const arrestDuration = result.arrest_time * 60 * 1000; // Convert to milliseconds
            arrestUser(userId, arrestDuration, 'Business Robbery', result.bail_amount);
            
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🚨 CAUGHT!')
                        .setDescription(`**POLICE RESPONSE!** You were caught robbing ${result.target.emoji} **${result.target.name}**!\n\n🚔 **ARRESTED** for ${result.arrest_time} minutes!\n💸 **Bail Amount:** ${result.bail_amount.toLocaleString()} coins\n\n*A silent alarm was triggered...*\n\nUse \`%bail\` to pay bail or wait for help!`)
                        .setColor(0xff0000)
                        .setTimestamp()
                ]
            });
        }
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Robbery failed!')
                    .setColor(0xff0000)
            ]
        });
    }

    // Successful robbery
    addBalance(userId, result.payout);
    
    const embed = new EmbedBuilder()
        .setTitle('💰 Robbery Successful!')
        .setDescription(`${result.target.emoji} You successfully robbed **${result.target.name}**!\n\n💰 **Stolen:** ${result.payout.toLocaleString()} coins\n⭐ **Crime XP:** +${result.xp_gained}\n🎯 **Crime Level:** ${result.new_level}\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins\n\n*You make a clean getaway...*`)
        .setColor(0x00ff00)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleCrimeStats(message, userId) {
    const statsDisplay = formatCrimeStats(userId);
    
    const embed = new EmbedBuilder()
        .setTitle(`🔫 ${message.author.username}'s Criminal Record`)
        .setDescription(statsDisplay)
        .setColor(0x8b0000)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

// Handle numbered robbery selection
async function handleNumberedRobbery(message, userId, targetNumber) {
    const allTargets = [];
    
    // Add all banks first
    Object.entries(BANKS).forEach(([bankId, bank]) => {
        allTargets.push({ id: bankId, type: 'bank', data: bank });
    });
    
    // Add all businesses
    Object.entries(BUSINESSES).forEach(([businessId, business]) => {
        allTargets.push({ id: businessId, type: 'business', data: business });
    });
    
    if (targetNumber < 1 || targetNumber > allTargets.length) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Invalid target number! Choose 1-${allTargets.length}.\nUse \`%r\` to see all targets.`)
                    .setColor(0xff0000)
            ]
        });
    }
    
    const selectedTarget = allTargets[targetNumber - 1];
    
    if (selectedTarget.type === 'bank') {
        return await handleBankRobbery(message, userId, [selectedTarget.id]);
    } else {
        return await handleBusinessRobbery(message, userId, [selectedTarget.id]);
    }
}
