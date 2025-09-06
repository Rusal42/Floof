const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');

async function robPlayerBusiness(message, targetUserId) {
    const userId = message.author.id;
    const guildId = message.guild.id;

    if (targetUserId === userId) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ You cannot rob your own business!')
                    .setColor(0xff0000)
            ]
        });
    }

    try {
        const { getUserBusinessData, updateUserBusinessData } = require('./utils/business-manager');
        const targetBusinessData = getUserBusinessData(targetUserId);
        
        if (!targetBusinessData || !targetBusinessData.businesses || targetBusinessData.businesses.length === 0) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ This player has no businesses to rob!')
                        .setColor(0xff0000)
                ]
            });
        }

        const activeBusiness = targetBusinessData.businesses.find(b => b.status === 'active');
        if (!activeBusiness) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ This player has no active businesses to rob!')
                        .setColor(0xff0000)
                ]
            });
        }

        // Get target member info
        const targetMember = await message.guild.members.fetch(targetUserId).catch(() => null);
        const targetName = targetMember ? targetMember.displayName : 'Unknown User';

        // Calculate robbery success
        const baseSuccessChance = 0.75; // 75% base success for player businesses
        const randomFactor = Math.random();
        const success = randomFactor < baseSuccessChance;

        if (success) {
            // Calculate payout based on business daily income
            const basePayout = activeBusiness.daily_income || 1000;
            const payout = Math.floor(basePayout * (0.5 + Math.random() * 0.5)); // 50-100% of daily income
            
            // Transfer money
            const currentBalance = getBalance(userId);
            addBalance(userId, payout);
            
            // Reduce business income temporarily
            activeBusiness.daily_income = Math.max(100, activeBusiness.daily_income * 0.95); // 5% permanent damage
            updateUserBusinessData(targetUserId, targetBusinessData);

            const embed = new EmbedBuilder()
                .setTitle('💰 Robbery Successful!')
                .setDescription(`**Target:** ${activeBusiness.emoji} ${targetName}'s ${activeBusiness.name}\n\n**💰 You stole:** ${payout.toLocaleString()} coins\n**💼 Business damaged:** -5% daily income\n\n*You got away clean!*`)
                .setColor(0x00ff00)
                .setTimestamp();

            // Notify target (if they're online)
            if (targetMember) {
                try {
                    await targetMember.send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('🚨 Your Business Was Robbed!')
                                .setDescription(`**${activeBusiness.emoji} ${activeBusiness.name}** was robbed by **${message.author.displayName}**\n\n**💸 Stolen:** ${payout.toLocaleString()} coins\n**📉 Damage:** -5% daily income`)
                                .setColor(0xff0000)
                                .setTimestamp()
                        ]
                    });
                } catch (error) {
                    // User has DMs disabled, skip notification
                }
            }

            return await sendAsFloofWebhook(message, { embeds: [embed] });

        } else {
            // Robbery failed - get arrested
            const { arrestUser } = require('./utils/crime-manager');
            const arrestTime = 300; // 5 minutes
            arrestUser(userId, arrestTime * 1000, 'Business Robbery', 0);

            const embed = new EmbedBuilder()
                .setTitle('🚔 Robbery Failed!')
                .setDescription(`**Target:** ${activeBusiness.emoji} ${targetName}'s ${activeBusiness.name}\n\n**🚨 You were caught!**\n**⏰ Arrested for:** ${Math.floor(arrestTime / 60)} minutes\n\n*Security was tighter than expected...*`)
                .setColor(0xff0000)
                .setTimestamp();

            return await sendAsFloofWebhook(message, { embeds: [embed] });
        }

    } catch (error) {
        console.error('Error robbing player business:', error);
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Business system unavailable. Try robbing banks or businesses instead!')
                    .setColor(0xff0000)
            ]
        });
    }
}

module.exports = { robPlayerBusiness };
