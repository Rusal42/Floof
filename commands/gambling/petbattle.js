const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');
const { getActivePet, updatePetStatus, PET_TYPES } = require('./utils/pet-manager');

// Battle cooldowns
const battleCooldowns = {};

module.exports = {
    name: 'petbattle',
    description: 'Battle other users\' pets for coins and glory!',
    usage: '%petbattle <@user> [bet amount]',
    category: 'gambling',
    aliases: ['petfight', 'pb'],
    cooldown: 60,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining } = require('./beatup');
        if (isArrested(userId)) {
            const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`🚔 You are currently under arrest! You cannot battle pets for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Check cooldown
        const now = Date.now();
        const cooldownAmount = 60 * 1000; // 60 seconds
        
        if (battleCooldowns[userId] && now < battleCooldowns[userId] + cooldownAmount) {
            const timeLeft = Math.round((battleCooldowns[userId] + cooldownAmount - now) / 1000);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`⏰ Your pet needs to rest! Wait **${timeLeft}** more seconds before battling again.`)
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
                        .setDescription('❌ Please specify a user to battle!\nExample: `%petbattle @user 1000`')
                        .setColor(0xff0000)
                ]
            });
        }

        // Can't battle yourself
        if (targetUser.id === userId) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ You cannot battle your own pet!')
                        .setColor(0xff0000)
                ]
            });
        }

        // Can't battle bots
        if (targetUser.bot) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ You cannot battle bots!')
                        .setColor(0xff0000)
                ]
            });
        }

        // Get bet amount
        const betAmount = parseInt(args[1]) || 0;
        
        if (betAmount < 0) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ Bet amount must be positive!')
                        .setColor(0xff0000)
                ]
            });
        }

        // Check if both users have active pets
        const userPet = getActivePet(userId);
        const targetPet = getActivePet(targetUser.id);

        if (!userPet) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ You need an active pet to battle! Use `%pet buy <type> <name>` to get a pet.')
                        .setColor(0xff0000)
                ]
            });
        }

        if (!targetPet) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`❌ ${targetUser.username} doesn't have an active pet!`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Update pet status (hunger/happiness affect performance)
        updatePetStatus(userPet);
        updatePetStatus(targetPet);

        // Check if pets are in good condition to battle
        if (userPet.hunger < 20 || userPet.happiness < 20) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`❌ ${userPet.name} is not in good condition to battle!\n🍽️ Hunger: ${userPet.hunger}/100\n😊 Happiness: ${userPet.happiness}/100\n\nFeed and care for your pet before battling.`)
                        .setColor(0xff0000)
                ]
            });
        }

        if (targetPet.hunger < 20 || targetPet.happiness < 20) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`❌ ${targetPet.name} is not in good condition to battle! They need care first.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Check balances if there's a bet
        if (betAmount > 0) {
            const userBalance = getBalance(userId);
            const targetBalance = getBalance(targetUser.id);

            if (userBalance < betAmount) {
                return await sendAsFloofWebhook(message, {
                    embeds: [
                        new EmbedBuilder()
                            .setDescription(`❌ You don't have enough coins to bet ${betAmount.toLocaleString()}!\nYour balance: ${userBalance.toLocaleString()} coins`)
                            .setColor(0xff0000)
                    ]
                });
            }

            if (targetBalance < betAmount) {
                return await sendAsFloofWebhook(message, {
                    embeds: [
                        new EmbedBuilder()
                            .setDescription(`❌ ${targetUser.username} doesn't have enough coins to match the bet!`)
                            .setColor(0xff0000)
                    ]
                });
            }
        }

        // Set cooldown
        battleCooldowns[userId] = now;

        // Simulate battle
        const battleResult = simulateBattle(userPet, targetPet);
        
        // Apply results
        let winnings = 0;
        if (betAmount > 0) {
            if (battleResult.winner === 'user') {
                subtractBalance(targetUser.id, betAmount);
                addBalance(userId, betAmount);
                winnings = betAmount;
            } else {
                subtractBalance(userId, betAmount);
                addBalance(targetUser.id, betAmount);
                winnings = -betAmount;
            }
        }

        // Update pet stats
        if (battleResult.winner === 'user') {
            userPet.battles_won++;
            targetPet.battles_lost++;
        } else {
            userPet.battles_lost++;
            targetPet.battles_won++;
        }

        // Create battle result embed
        const userPetInfo = PET_TYPES[userPet.type];
        const targetPetInfo = PET_TYPES[targetPet.type];
        
        let battleDescription = `${userPetInfo.emoji} **${userPet.name}** (Lv.${userPet.level}) vs ${targetPetInfo.emoji} **${targetPet.name}** (Lv.${targetPet.level})\n\n`;
        
        // Add battle narrative
        battleDescription += battleResult.narrative + '\n\n';
        
        // Show final stats
        battleDescription += `**Final Health:**\n`;
        battleDescription += `${userPetInfo.emoji} ${userPet.name}: ${battleResult.userHealth}/${userPet.stats.health}\n`;
        battleDescription += `${targetPetInfo.emoji} ${targetPet.name}: ${battleResult.targetHealth}/${targetPet.stats.health}\n\n`;
        
        // Winner announcement
        if (battleResult.winner === 'user') {
            battleDescription += `🏆 **${userPet.name} WINS!**\n`;
        } else {
            battleDescription += `🏆 **${targetPet.name} WINS!**\n`;
        }
        
        // Bet results
        if (betAmount > 0) {
            if (winnings > 0) {
                battleDescription += `💰 You won **${winnings.toLocaleString()}** coins!\n`;
                battleDescription += `💳 New balance: ${getBalance(userId).toLocaleString()} coins`;
            } else {
                battleDescription += `💸 You lost **${Math.abs(winnings).toLocaleString()}** coins!\n`;
                battleDescription += `💳 New balance: ${getBalance(userId).toLocaleString()} coins`;
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('⚔️ Pet Battle Results')
            .setDescription(battleDescription)
            .setColor(battleResult.winner === 'user' ? 0x00ff00 : 0xff6b6b)
            .setTimestamp();

        await sendAsFloofWebhook(message, { embeds: [embed] });
    }
};

function simulateBattle(userPet, targetPet) {
    // Calculate effective stats (affected by condition)
    const userStats = calculateEffectiveStats(userPet);
    const targetStats = calculateEffectiveStats(targetPet);
    
    let userHealth = userStats.health;
    let targetHealth = targetStats.health;
    
    let narrative = '';
    let round = 1;
    
    while (userHealth > 0 && targetHealth > 0 && round <= 10) {
        // Determine who goes first based on speed
        const userSpeed = userStats.speed + Math.random() * 10;
        const targetSpeed = targetStats.speed + Math.random() * 10;
        
        if (userSpeed >= targetSpeed) {
            // User attacks first
            const damage = calculateDamage(userStats.attack, targetStats.defense);
            targetHealth = Math.max(0, targetHealth - damage);
            narrative += `🗡️ ${userPet.name} attacks for ${damage} damage!\n`;
            
            if (targetHealth > 0) {
                const counterDamage = calculateDamage(targetStats.attack, userStats.defense);
                userHealth = Math.max(0, userHealth - counterDamage);
                narrative += `⚔️ ${targetPet.name} counters for ${counterDamage} damage!\n`;
            }
        } else {
            // Target attacks first
            const damage = calculateDamage(targetStats.attack, userStats.defense);
            userHealth = Math.max(0, userHealth - damage);
            narrative += `⚔️ ${targetPet.name} attacks for ${damage} damage!\n`;
            
            if (userHealth > 0) {
                const counterDamage = calculateDamage(userStats.attack, targetStats.defense);
                targetHealth = Math.max(0, targetHealth - counterDamage);
                narrative += `🗡️ ${userPet.name} counters for ${counterDamage} damage!\n`;
            }
        }
        
        round++;
        if (round <= 10) narrative += '\n';
    }
    
    // Determine winner
    let winner;
    if (userHealth > targetHealth) {
        winner = 'user';
    } else if (targetHealth > userHealth) {
        winner = 'target';
    } else {
        // Tie - higher level wins, or random if same level
        if (userPet.level > targetPet.level) {
            winner = 'user';
        } else if (targetPet.level > userPet.level) {
            winner = 'target';
        } else {
            winner = Math.random() < 0.5 ? 'user' : 'target';
        }
    }
    
    return {
        winner,
        userHealth,
        targetHealth,
        narrative: narrative.trim()
    };
}

function calculateEffectiveStats(pet) {
    // Pet condition affects performance
    const conditionMultiplier = (pet.hunger + pet.happiness) / 200;
    
    return {
        attack: Math.floor(pet.stats.attack * conditionMultiplier),
        defense: Math.floor(pet.stats.defense * conditionMultiplier),
        speed: Math.floor(pet.stats.speed * conditionMultiplier),
        health: pet.stats.health // Health is not affected by condition
    };
}

function calculateDamage(attack, defense) {
    const baseDamage = Math.max(1, attack - defense);
    const variance = 0.8 + Math.random() * 0.4; // 80% to 120% damage
    return Math.floor(baseDamage * variance);
}

// Export cooldowns for external access if needed
module.exports.cooldowns = battleCooldowns;
