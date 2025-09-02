const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');
const { petAttackUser, updateUserActivity, PET_TYPES } = require('./utils/pet-manager');

// Pet attack cooldowns
const petAttackCooldowns = {};

module.exports = {
    name: 'petattack',
    description: 'Command your pet to attack another user',
    usage: '%petattack <@user>',
    category: 'gambling',
    aliases: ['petsend', 'petfight'],
    cooldown: 45,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Update user activity
        updateUserActivity(userId);
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining } = require('./beatup');
        if (isArrested(userId)) {
            const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`🚔 You are currently under arrest! You cannot command pet attacks for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Check cooldown
        const now = Date.now();
        const cooldownAmount = 45 * 1000; // 45 seconds
        
        if (petAttackCooldowns[userId] && now < petAttackCooldowns[userId] + cooldownAmount) {
            const timeLeft = Math.round((petAttackCooldowns[userId] + cooldownAmount - now) / 1000);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`⏰ Your pet is still recovering! Wait **${timeLeft}** more seconds before attacking again.`)
                        .setColor(0xffa500)
                ]
            });
        }

        // Get target user
        let targetUser;
        if (message.mentions.users.size > 0) {
            targetUser = message.mentions.users.first();
        } else if (args[0]) {
            try {
                targetUser = await message.client.users.fetch(args[0]);
            } catch (error) {
                return await sendAsFloofWebhook(message, {
                    embeds: [
                        new EmbedBuilder()
                            .setDescription('❌ User not found! Please mention a user or provide a valid user ID.')
                            .setColor(0xff0000)
                    ]
                });
            }
        } else {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Please specify a user to attack!\nExample: `%petattack @user`')
                        .setColor(0xff0000)
                ]
            });
        }

        // Can't attack yourself
        if (targetUser.id === userId) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Your pet refuses to attack you!')
                        .setColor(0xff0000)
                ]
            });
        }

        // Can't attack bots
        if (targetUser.bot) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Your pet is confused by bots and refuses to attack!')
                        .setColor(0xff0000)
                ]
            });
        }

        // Execute pet attack
        const attackResult = petAttackUser(userId, targetUser.id);

        if (!attackResult.success) {
            let errorMsg = '';
            switch (attackResult.reason) {
                case 'no_attacker_pet':
                    errorMsg = '❌ You need an active pet to attack! Use `%pet buy <type> <name>` to get a pet.';
                    break;
                case 'pet_unfit':
                    errorMsg = `❌ ${attackResult.pet.name} is not in good condition to attack!\n🍽️ Hunger: ${attackResult.pet.hunger}/100\n😊 Happiness: ${attackResult.pet.happiness}/100\n\nFeed and care for your pet first.`;
                    break;
                default:
                    errorMsg = '❌ Pet attack failed.';
            }
            
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(errorMsg)
                        .setColor(0xff0000)
                ]
            });
        }

        // Set cooldown
        petAttackCooldowns[userId] = now;

        const attackerPetInfo = PET_TYPES[attackResult.attacker_pet.type];
        let resultMsg = `${attackerPetInfo.emoji} **${attackResult.attacker_pet.name}** (Lv.${attackResult.attacker_pet.level}) attacks **${targetUser.username}**!\n\n`;

        // Check if target was defended by their pet
        if (attackResult.defense_result) {
            const defenderPetInfo = PET_TYPES[attackResult.target_pet.type];
            
            if (attackResult.defense_result.defended) {
                // Defense successful
                resultMsg += `🛡️ **${attackResult.target_pet.name}** (Lv.${attackResult.target_pet.level}) successfully defends their owner!\n\n`;
                resultMsg += `💥 **Damage Blocked:** ${attackResult.defense_result.damage_blocked}\n`;
                resultMsg += `🎯 **Defense Success:** ${attackResult.defense_result.defense_chance}%\n\n`;
                resultMsg += `${defenderPetInfo.emoji} **${attackResult.target_pet.name}** stands guard proudly while **${targetUser.username}** is AFK!`;
                
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ Pet Defense Successful!')
                    .setDescription(resultMsg)
                    .setColor(0x43b581)
                    .setTimestamp();

                return await sendAsFloofWebhook(message, { embeds: [embed] });
            } else {
                // Defense failed
                resultMsg += `💔 **${attackResult.target_pet.name}** (Lv.${attackResult.target_pet.level}) tried to defend but failed!\n\n`;
                resultMsg += `🎯 **Defense Attempt:** ${attackResult.defense_result.defense_chance}%\n`;
            }
        } else if (attackResult.target_afk) {
            resultMsg += `😴 **${targetUser.username}** is AFK and has no pet to defend them!\n\n`;
        }

        // Calculate coin steal (reduced if defended)
        let finalCoinSteal = attackResult.coin_steal;
        if (attackResult.defense_result && attackResult.defense_result.defended) {
            finalCoinSteal = 0; // No coins stolen if successfully defended
        } else if (attackResult.defense_result) {
            finalCoinSteal = Math.floor(finalCoinSteal * 0.5); // Reduced steal if defense attempted
        }

        const targetBalance = getBalance(targetUser.id);
        finalCoinSteal = Math.min(finalCoinSteal, targetBalance);

        if (finalCoinSteal > 0) {
            subtractBalance(targetUser.id, finalCoinSteal);
            addBalance(userId, finalCoinSteal);
            resultMsg += `💰 **${attackResult.attacker_pet.name}** stole **${finalCoinSteal.toLocaleString()}** coins!\n`;
        } else {
            resultMsg += `💸 No coins were stolen.\n`;
        }

        resultMsg += `\n💳 **Your new balance:** ${getBalance(userId).toLocaleString()} coins`;

        // Pet gets tired from attacking
        resultMsg += `\n\n😴 **${attackResult.attacker_pet.name}** is now tired from the attack.`;

        const embed = new EmbedBuilder()
            .setTitle('🐾 Pet Attack Results')
            .setDescription(resultMsg)
            .setColor(finalCoinSteal > 0 ? 0xffd700 : 0xff6b6b)
            .setTimestamp();

        await sendAsFloofWebhook(message, { embeds: [embed] });
    }
};

// Export cooldowns for external access if needed
module.exports.cooldowns = petAttackCooldowns;
