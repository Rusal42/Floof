const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');
const { getActiveEffects, hasActiveEffect, getEffectMultiplier } = require('./utils/blackmarket-manager');
const { getEquippedWeapon, getEquippedProtection, getItemInfo, hasItem, removeItem, getStats, updateStats, getInventory } = require('./utils/inventory-manager');
const { getActivePet, isUserAFK, updateUserActivity, simulatePetDefense, PET_TYPES } = require('./utils/pet-manager');

// Attack cooldowns
const attackCooldowns = {};

module.exports = {
    name: 'attack',
    description: 'Attack another user with your equipped weapon',
    usage: '%attack <user> | %a <user> (use %select weapon first)',
    category: 'gambling',
    aliases: ['fight', 'hit', 'punch', 'a', 'atk'],
    cooldown: 30,

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
                        .setDescription(`🚔 You are currently under arrest! You cannot attack for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }


        // Check cooldown
        const now = Date.now();
        const cooldownAmount = 30 * 1000; // 30 seconds
        
        if (attackCooldowns[userId] && now < attackCooldowns[userId] + cooldownAmount) {
            const timeLeft = Math.round((attackCooldowns[userId] + cooldownAmount - now) / 1000);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`⏰ You need to wait **${timeLeft}** more seconds before attacking again!`)
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
                        .setDescription('❌ Please mention a user to attack!\n\n💡 **Usage:**\n• `%select weapon` - Choose your weapon first\n• `%attack @user` - Attack the user\n• `%a @user` - Short alias')
                        .setColor(0xff0000)
                ]
            });
        }

        // Check if target is sleeping (protected)
        const { isUserSleeping } = require('./utils/blackmarket-manager');
        if (isUserSleeping(targetUser.id)) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`😴 **${targetUser.username}** is fast asleep and cannot be attacked!\n\n💊 They're under the protection of sleeping pills.\n\n💡 Wait for them to wake up or find another target!`)
                        .setColor(0x9b59b6)
                ]
            });
        }

        // Can't attack yourself
        if (targetUser.id === userId) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ You cannot attack yourself!')
                        .setColor(0xff0000)
                ]
            });
        }

        // Can't attack bots (except Floof)
        if (targetUser.bot && !targetUser.username.toLowerCase().includes('floof')) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ You cannot attack bots!')
                        .setColor(0xff0000)
                ]
            });
        }

        // Get selected weapon or equipped weapon
        const { getSelectedWeapon } = require('./select');
        let weaponInfo;
        let weaponId;
        
        const selectedWeapon = getSelectedWeapon(userId);
        if (selectedWeapon) {
            weaponId = selectedWeapon;
            weaponInfo = getItemInfo(selectedWeapon);
        } else {
            // Fallback to equipped weapon
            const equippedWeapon = getEquippedWeapon(userId);
            if (!equippedWeapon) {
                return await sendAsFloofWebhook(message, {
                    embeds: [
                        new EmbedBuilder()
                            .setDescription('❌ You have no weapon selected or equipped!\n\nUse `%select weapon` to choose a weapon for attacks.')
                            .setColor(0xff0000)
                    ]
                });
            }
            
            weaponId = equippedWeapon;
            weaponInfo = getItemInfo(equippedWeapon);
        }
        
        // Get ammo type for weapon
        const ammoTypeMap = {
            pistol: 'bullets',
            rifle: 'bullets',
            crossbow: 'arrows', 
            flamethrower: 'fuel',
            laser: 'energy',
            speaker: 'sound'
        };
        const ammoType = ammoTypeMap[weaponId] || 'bullets';

        // Check if attacker has ammo
        if (!hasItem(userId, ammoType, 1)) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`❌ You're out of ammo! You need **${getItemInfo(ammoType).name}** for your ${weaponInfo.name}.\nBuy ammo from the shop: \`%shop ammo\``)
                        .setColor(0xff0000)
                ]
            });
        }

        // Set cooldown
        attackCooldowns[userId] = now;

        // Consume ammo
        removeItem(userId, ammoType, 1);

        // Special handling for attacking Floof
        if (targetUser.bot && targetUser.username.toLowerCase().includes('floof')) {
            return await handleFloofAttack(message, userId, targetUser, weaponInfo);
        }

        // Check user preferences first
        const { canTargetUser, userAllows } = require('./utils/user-preferences');
        
        if (!canTargetUser(targetUser.id, 'attack')) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🚫 Attack Blocked')
                        .setDescription(`<@${targetUser.id}> has disabled attacks in their privacy settings.\n\n*Respect other users' preferences!*\n\nThey can enable attacks with \`%preferences enable allow_attacks\``)
                        .setColor(0xe74c3c)
                        .setTimestamp()
                ]
            });
        }

        // Check for bodyguard protection
        const { getBodyguardProtection } = require('./utils/business-manager');
        const bodyguardProtection = getBodyguardProtection(targetUser.id);
        
        if (bodyguardProtection.protected && userAllows(targetUser.id, 'bodyguard_protection') && Math.random() < bodyguardProtection.protection_level) {
            updateUserActivity(userId); // Update attacker activity
            
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🛡️ Bodyguard Protection!')
                        .setDescription(`🕴️ <@${targetUser.id}>'s bodyguards stepped in!\n\n🛡️ **Protection Level:** ${Math.floor(bodyguardProtection.protection_level * 100)}%\n👥 **Bodyguards:** ${bodyguardProtection.bodyguard_count}\n\n⚔️ Your attack was intercepted!\n\n*Professional security doesn't mess around...*`)
                        .setColor(0x95a5a6)
                        .setTimestamp()
                ]
            });
        }

        // Check if target is AFK and has a defending pet
        const targetIsAFK = isUserAFK(targetUser.id);
        const targetPet = getActivePet(targetUser.id);
        let petDefenseResult = null;
        
        if (isUserAFK(targetUser.id) && targetPet && userAllows(targetUser.id, 'pet_defense')) {
            petDefenseResult = simulatePetDefense(targetPet, weaponInfo, targetUser.id);
            
            if (petDefenseResult.defended) {
                updateUserActivity(userId); // Update attacker activity
                
                const targetPetInfo = PET_TYPES[targetPet.type];
                return await sendAsFloofWebhook(message, {
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('🛡️ Pet Defense!')
                            .setDescription(`🐾 **${targetPet.name}** (Lv.${targetPet.level}) successfully defended <@${targetUser.id}>!\n\n${targetPetInfo.emoji} *"${targetPetInfo.defense_message}"*\n\n⚔️ Your attack was completely blocked!\n🛡️ **Defense Success:** ${petDefenseResult.defense_chance}% chance\n\n*The loyal pet stands guard over their sleeping owner...*`)
                            .setColor(0x3498db)
                            .setTimestamp()
                    ]
                });
            }
        }

        // Get target's protection
        const targetProtection = getEquippedProtection(targetUser.id) || [];
        
        // Calculate damage and defense
        const baseDamage = weaponInfo.damage;
        let totalDefense = 0;

        for (const protectionId of targetProtection) {
            const protectionInfo = getItemInfo(protectionId);
            if (protectionInfo && protectionInfo.defense) {
                totalDefense += protectionInfo.defense;
            }
        }

        // Calculate final damage with all modifiers
        let finalDamage = weaponInfo.damage;
        
        // Apply blackmarket drug effects
        let damageMultiplier = 1.0;
        let painImmunity = false;
        let drugEffectsUsed = [];
        
        // Check for combat drugs
        if (hasActiveEffect(userId, 'whiskey')) {
            damageMultiplier += 0.2; // 20% boost from whiskey
            drugEffectsUsed.push('🥃 Whiskey (+20% damage)');
        }
        if (hasActiveEffect(userId, 'opioids')) {
            damageMultiplier += 0.3; // 30% boost from opioids
            painImmunity = true; // Immune to pain/damage reduction
            drugEffectsUsed.push('💊 Opioids (+30% damage, pain immunity)');
        }
        if (hasActiveEffect(userId, 'steroids')) {
            damageMultiplier += 0.5; // 50% boost from steroids
            drugEffectsUsed.push('💪 Steroids (+50% damage)');
        }
        if (hasActiveEffect(userId, 'adrenaline')) {
            damageMultiplier += 0.25; // 25% boost from adrenaline
            drugEffectsUsed.push('⚡ Adrenaline (+25% damage)');
        }
        
        finalDamage = Math.floor(finalDamage * damageMultiplier);
        
        // Apply defense reduction (armor, etc.) - unless pain immunity from opioids
        if (!painImmunity) {
            finalDamage = Math.max(1, finalDamage - totalDefense);
        }
        
        // Check target's defensive drug effects
        let targetDefenseMultiplier = 1.0;
        let targetDrugEffects = [];
        
        if (hasActiveEffect(targetUser.id, 'heroin')) {
            targetDefenseMultiplier -= 0.5; // 50% damage reduction
            targetDrugEffects.push('💉 Heroin (-50% damage taken)');
        }
        if (hasActiveEffect(targetUser.id, 'steroids')) {
            targetDefenseMultiplier -= 0.25; // 25% damage reduction
            targetDrugEffects.push('💪 Steroids (-25% damage taken)');
        }
        if (hasActiveEffect(targetUser.id, 'vodka')) {
            targetDefenseMultiplier -= 0.25; // 25% damage reduction
            targetDrugEffects.push('🍸 Vodka (-25% damage taken)');
        }
        
        finalDamage = Math.max(1, Math.floor(finalDamage * targetDefenseMultiplier));
        
        const targetStats = getStats(targetUser.id);
        const newHealth = Math.max(0, targetStats.health - finalDamage);

        // Update target health
        updateStats(targetUser.id, newHealth);

        // Calculate coin steal based on damage dealt
        const actualDamage = targetStats.health - newHealth;
        const targetBalance = getBalance(targetUser.id);
        let maxSteal = Math.min(targetBalance, Math.floor(actualDamage * 10)); // 10 coins per damage
        
        // Reduce coin steal if pet attempted defense but failed
        if (petDefenseResult && !petDefenseResult.defended) {
            maxSteal = Math.floor(maxSteal * 0.7); // 30% reduction for failed pet defense
        }
        
        // Reduce coin steal if bodyguards provided partial protection
        if (bodyguardProtection.protected) {
            maxSteal = Math.floor(maxSteal * (1 - bodyguardProtection.protection_level * 0.3)); // Up to 30% reduction
        }
        
        const stolenCoins = Math.floor(Math.random() * maxSteal) + Math.floor(maxSteal * 0.3);

        if (stolenCoins > 0) {
            subtractBalance(targetUser.id, stolenCoins);
            addBalance(userId, stolenCoins);
        }

        // Create attack result embed
        let resultMsg = `${weaponInfo.emoji} **${message.author.username}** attacked **${targetUser.username}** with a ${weaponInfo.name}!\n\n`;
        
        // Add bodyguard information if applicable
        if (bodyguardProtection.protected) {
            resultMsg += `🕴️ **Bodyguard Protection:** ${Math.floor(bodyguardProtection.protection_level * 100)}% (${bodyguardProtection.bodyguard_count} guards)\n`;
        }
        
        // Add pet defense information if applicable
        if (petDefenseResult && !petDefenseResult.defended) {
            const targetPetInfo = PET_TYPES[targetPet.type];
            resultMsg += `🛡️ **${targetPet.name}** (Lv.${targetPet.level}) tried to defend but failed! (${petDefenseResult.defense_chance}% chance)\n`;
        }
        
        // Add drug effects to result message
        if (drugEffectsUsed.length > 0) {
            resultMsg += `💊 **Your Drug Effects:** ${drugEffectsUsed.join(', ')}\n`;
        }
        if (targetDrugEffects.length > 0) {
            resultMsg += `🛡️ **Target's Drug Effects:** ${targetDrugEffects.join(', ')}\n`;
        }
        
        resultMsg += `\n💥 **Damage Dealt:** ${actualDamage} (${weaponInfo.damage} base`;
        if (damageMultiplier > 1.0) resultMsg += ` × ${damageMultiplier.toFixed(1)} drugs`;
        if (totalDefense > 0 && !painImmunity) resultMsg += ` - ${totalDefense} armor`;
        if (targetDefenseMultiplier < 1.0) resultMsg += ` × ${targetDefenseMultiplier.toFixed(1)} target drugs`;
        if (bodyguardProtection.protected) resultMsg += ` - bodyguard reduction`;
        resultMsg += `)\n`;
        resultMsg += `❤️ **${targetUser.username}'s Health:** ${newHealth}/${targetStats.max_health}\n`;
        
        if (stolenCoins > 0) {
            resultMsg += `💰 **Coins Stolen:** ${stolenCoins.toLocaleString()}\n`;
            if (petDefenseResult && !petDefenseResult.defended) {
                resultMsg += `🐾 **Pet Defense Penalty:** -30% coins stolen\n`;
            }
            if (bodyguardProtection.protected) {
                resultMsg += `🕴️ **Bodyguard Penalty:** -${Math.floor(bodyguardProtection.protection_level * 30)}% coins stolen\n`;
            }
        }

        if (newHealth === 0) {
            resultMsg += `\n💀 **${targetUser.username} has been defeated!**`;
            // Reset target health to 50% when defeated
            updateStats(targetUser.id, Math.floor(targetStats.max_health * 0.5));
        }

        const embed = new EmbedBuilder()
            .setTitle('⚔️ Attack Result')
            .setDescription(resultMsg)
            .setColor(newHealth === 0 ? 0xff0000 : 0xffa500)
            .setTimestamp();

        await sendAsFloofWebhook(message, { embeds: [embed] });
    }
};

async function handleFloofAttack(message, userId, targetUser, weaponInfo) {
    // 90% chance Floof dodges/wins
    const floofWins = Math.random() < 0.9;
    
    if (floofWins) {
        const floofResponses = [
            `😾 **Floof**: *dodges gracefully* Nice try, but I'm too fast for you!`,
            `🐱 **Floof**: *matrix dodge* You'll have to do better than that!`,
            `😼 **Floof**: *teleports behind you* Nothing personnel, kid.`,
            `🙀 **Floof**: *cat reflexes activate* Too slow, human!`,
            `😿 **Floof**: *sad meow* Why would you try to hurt me? *counter-attack*`,
            `🐾 **Floof**: *uses nine lives* That's only one life down, eight to go!`
        ];

        const randomResponse = floofResponses[Math.floor(Math.random() * floofResponses.length)];
        
        // Floof steals some coins as punishment
        const userBalance = getBalance(userId);
        const punishment = Math.min(userBalance, Math.floor(Math.random() * 500) + 100);
        
        if (punishment > 0) {
            subtractBalance(userId, punishment);
        }

        const embed = new EmbedBuilder()
            .setTitle('⚔️ Attack on Floof - FLOOF WINS!')
            .setDescription(`${randomResponse}\n\n💥 **Floof** easily dodges your ${weaponInfo.name} and steals **${punishment.toLocaleString()}** coins as punishment!\n\n**Your new balance:** ${getBalance(userId).toLocaleString()} coins`)
            .setColor(0x43b581)
            .setTimestamp();

        await sendAsFloofWebhook(message, { embeds: [embed] });
    } else {
        // 10% chance user actually hits Floof
        const damage = weaponInfo.damage;
        const coinsWon = Math.floor(Math.random() * 1000) + 500;
        addBalance(userId, coinsWon);

        const embed = new EmbedBuilder()
            .setTitle('⚔️ Attack on Floof - CRITICAL HIT!')
            .setDescription(`🤯 **INCREDIBLE!** You actually managed to hit Floof with your ${weaponInfo.name}!\n\n😵 **Floof**: *SYSTEM ERROR* How did you... *sparks fly*\n💰 You won **${coinsWon.toLocaleString()}** coins from Floof's infinite stash!\n\n**Your new balance:** ${getBalance(userId).toLocaleString()} coins`)
            .setColor(0xffd700)
            .setTimestamp();

        await sendAsFloofWebhook(message, { embeds: [embed] });
    }
}


// Export cooldowns for external access if needed
module.exports.cooldowns = attackCooldowns;
