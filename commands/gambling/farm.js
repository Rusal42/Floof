const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');
const { 
    CROP_TYPES,
    FARM_EQUIPMENT,
    getUserFarmData,
    plantCrop,
    waterCrops,
    updateCropStatus,
    harvestCrop,
    getFarmingLevel,
    buyFarmEquipment,
    formatFarmDisplay,
    checkPoliceRaid,
    clearPlot,
    getMarketPrices
} = require('./utils/farming-manager');

// Farm cooldowns
const farmCooldowns = {};

module.exports = {
    name: 'farm',
    description: 'Manage your farming operation - plant, water, and harvest crops',
    usage: '%farm [plant/water/harvest/upgrade/market/clear] [crop/plot]',
    category: 'gambling',
    aliases: ['farming', 'crops', 'agriculture'],
    cooldown: 5,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check cooldown
        const now = Date.now();
        const cooldownAmount = 5 * 1000; // 5 seconds
        
        if (farmCooldowns[userId] && now < farmCooldowns[userId] + cooldownAmount) {
            const timeLeft = Math.round((farmCooldowns[userId] + cooldownAmount - now) / 1000);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`⏰ You're working too fast! Wait **${timeLeft}** more seconds.`)
                        .setColor(0xffa500)
                ]
            });
        }

        // Update crop status and check for raids
        updateCropStatus(userId);
        const raidResult = checkPoliceRaid(userId);
        
        if (raidResult.raided) {
            // Use crime manager arrest function
            const { arrestUser } = require('./utils/crime-manager');
            const arrestDuration = raidResult.arrest_time * 60 * 1000; // Convert to milliseconds
            arrestUser(userId, arrestDuration, 'Illegal Farming', raidResult.bail_amount);
            
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🚨 POLICE RAID!')
                        .setDescription(`**DEA RAID ON YOUR FARM!**\n\n🚔 Police destroyed **${raidResult.crops_destroyed}** illegal crops!\n💸 All illegal plants have been confiscated!\n\n🚔 **ARRESTED** for ${raidResult.arrest_time} minutes!\n💸 **Bail Amount:** ${raidResult.bail_amount.toLocaleString()} coins\n\n*You should be more careful with what you grow...*\n\nUse \`%bail\` to pay bail or wait for help!`)
                        .setColor(0xff0000)
                        .setTimestamp()
                ]
            });
        }

        if (args.length === 0) {
            return await displayFarm(message, userId);
        }

        const action = args[0].toLowerCase();
        
        switch (action) {
            case 'plant':
            case 'seed':
                return await handlePlantCrop(message, userId, args.slice(1));
            case 'water':
            case 'irrigate':
                return await handleWaterCrops(message, userId);
            case 'harvest':
            case 'collect':
                return await handleHarvestCrop(message, userId, args.slice(1));
            case 'upgrade':
            case 'buy':
                return await handleUpgradeFarm(message, userId, args.slice(1));
            case 'market':
            case 'prices':
                return await handleMarketPrices(message, userId);
            case 'clear':
            case 'remove':
                return await handleClearPlot(message, userId, args.slice(1));
            case 'seeds':
            case 'shop':
                return await handleSeedShop(message, userId);
            default:
                return await displayFarm(message, userId);
        }
    }
};

async function displayFarm(message, userId) {
    const farmDisplay = formatFarmDisplay(userId);
    const level = getFarmingLevel(userId);
    
    const embed = new EmbedBuilder()
        .setTitle(`🚜 ${message.author.username}'s Farm`)
        .setDescription(farmDisplay)
        .setColor(0x228b22)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: '🌱 Commands', value: '`plant` • `water` • `harvest` • `upgrade` • `market` • `seeds`', inline: false }
        )
        .setFooter({ text: 'Farming Level ' + level.level + ' • ' + level.name })
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handlePlantCrop(message, userId, args) {
    if (args.length < 1) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify crop to plant!\nExample: `%farm plant cannabis`\n\nUse `%farm seeds` to see available crops.')
                    .setColor(0xff0000)
            ]
        });
    }

    const cropType = args[0].toLowerCase();
    const plotId = parseInt(args[1]) || 1;
    
    if (!CROP_TYPES[cropType]) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Unknown crop type: **${cropType}**\n\nUse \`%farm seeds\` to see available crops.`)
                    .setColor(0xff0000)
            ]
        });
    }

    const crop = CROP_TYPES[cropType];
    const userBalance = getBalance(userId);
    
    if (userBalance < crop.seed_price) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Insufficient funds!\n\n💰 **Seed Cost:** ${crop.seed_price.toLocaleString()} coins\n💳 **Your Balance:** ${userBalance.toLocaleString()} coins`)
                    .setColor(0xff0000)
            ]
        });
    }

    farmCooldowns[userId] = Date.now();
    const result = plantCrop(userId, cropType, plotId);

    if (!result.success) {
        let errorMsg = '❌ ';
        switch (result.reason) {
            case 'no_plot':
                errorMsg += 'You don\'t have enough farm plots! Upgrade your farm first.';
                break;
            case 'plot_occupied':
                errorMsg += `Plot ${plotId} is already occupied! Harvest or clear it first.`;
                break;
            default:
                errorMsg += 'Failed to plant crop!';
        }
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(errorMsg)
                    .setColor(0xff0000)
            ]
        });
    }

    subtractBalance(userId, crop.seed_price);
    
    const readyTime = Math.ceil(result.ready_time / (60 * 1000));
    let riskWarning = '';
    if (crop.risk > 0) {
        riskWarning = `\n⚠️ **Warning:** This is an illegal crop with ${Math.floor(crop.risk * 100)}% raid risk!`;
    }

    const embed = new EmbedBuilder()
        .setTitle('🌱 Crop Planted!')
        .setDescription(`${crop.emoji} Successfully planted **${crop.name}** in Plot ${plotId}!\n\n⏰ **Ready in:** ${readyTime} minutes\n💧 **Water every:** ${crop.water_interval} minutes\n💰 **Seed Cost:** ${crop.seed_price.toLocaleString()} coins\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins${riskWarning}`)
        .setColor(0x228b22)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleWaterCrops(message, userId) {
    farmCooldowns[userId] = Date.now();
    const result = waterCrops(userId);
    
    if (result.watered === 0) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('💧 No crops need watering right now!')
                    .setColor(0x95a5a6)
            ]
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('💧 Crops Watered!')
        .setDescription(`You watered **${result.watered}** crops!\n\n🌱 Your crops are now healthier and will grow better!`)
        .setColor(0x3498db)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleHarvestCrop(message, userId, args) {
    const plotId = parseInt(args[0]) || 1;
    
    farmCooldowns[userId] = Date.now();
    const result = harvestCrop(userId, plotId);

    if (!result.success) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Plot ${plotId} is not ready for harvest!`)
                    .setColor(0xff0000)
            ]
        });
    }

    addBalance(userId, result.value);
    
    const healthBonus = result.health >= 80 ? ' 🌟 **Perfect Health Bonus!**' : 
                       result.health >= 50 ? ' ✨ **Good Health**' : 
                       ' ⚠️ **Poor Health**';

    const embed = new EmbedBuilder()
        .setTitle('🌾 Harvest Complete!')
        .setDescription(`${result.crop.emoji} Harvested **${result.yield}x ${result.crop.name}** from Plot ${plotId}!\n\n💰 **Earned:** ${result.value.toLocaleString()} coins\n⭐ **XP Gained:** ${result.xp_gained}\n💚 **Crop Health:** ${result.health}%${healthBonus}\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins`)
        .setColor(0xf39c12)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleUpgradeFarm(message, userId, args) {
    if (args.length < 1) {
        return await displayUpgradeShop(message, userId);
    }

    const equipmentId = args[0].toLowerCase().replace(/\s+/g, '_');
    const equipment = FARM_EQUIPMENT[equipmentId];
    
    if (!equipment) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Unknown equipment! Use `%farm upgrade` to see available upgrades.')
                    .setColor(0xff0000)
            ]
        });
    }

    const userBalance = getBalance(userId);
    
    if (userBalance < equipment.price) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Insufficient funds!\n\n💰 **Cost:** ${equipment.price.toLocaleString()} coins\n💳 **Your Balance:** ${userBalance.toLocaleString()} coins`)
                    .setColor(0xff0000)
            ]
        });
    }

    const result = buyFarmEquipment(userId, equipmentId);
    
    if (!result.success) {
        let errorMsg = '❌ ';
        switch (result.reason) {
            case 'already_owned':
                errorMsg += 'You already own this equipment!';
                break;
            default:
                errorMsg += 'Failed to purchase equipment!';
        }
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(errorMsg)
                    .setColor(0xff0000)
            ]
        });
    }

    subtractBalance(userId, equipment.price);

    const embed = new EmbedBuilder()
        .setTitle('🔧 Farm Upgraded!')
        .setDescription(`${equipment.emoji} Successfully purchased **${equipment.name}**!\n\n${equipment.description}\n\n💰 **Cost:** ${equipment.price.toLocaleString()} coins\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins`)
        .setColor(0xe67e22)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function displayUpgradeShop(message, userId) {
    const farmData = getUserFarmData(userId);
    const userBalance = getBalance(userId);
    
    let description = '**🔧 Farm Equipment Shop**\n\n';
    description += `💰 **Your Balance:** ${userBalance.toLocaleString()} coins\n\n`;
    
    // Farm upgrades
    description += '**🏗️ Farm Upgrades:**\n';
    Object.entries(FARM_EQUIPMENT).forEach(([equipId, equipment]) => {
        if (['basic_plot', 'small_farm', 'large_farm', 'mega_farm'].includes(equipId)) {
            const canAfford = userBalance >= equipment.price;
            const priceDisplay = canAfford ? `💰 ${equipment.price.toLocaleString()}` : `❌ ${equipment.price.toLocaleString()}`;
            const current = farmData.farm_level === equipId ? ' ✅ **CURRENT**' : '';
            
            description += `${equipment.emoji} **${equipment.name}** - ${priceDisplay}${current}\n`;
            description += `└ ${equipment.description} (${equipment.max_crops} plots)\n`;
            description += `└ \`%farm upgrade ${equipId}\`\n\n`;
        }
    });
    
    // Equipment
    description += '**🔧 Equipment:**\n';
    Object.entries(FARM_EQUIPMENT).forEach(([equipId, equipment]) => {
        if (!['basic_plot', 'small_farm', 'large_farm', 'mega_farm'].includes(equipId)) {
            const canAfford = userBalance >= equipment.price;
            const priceDisplay = canAfford ? `💰 ${equipment.price.toLocaleString()}` : `❌ ${equipment.price.toLocaleString()}`;
            const owned = farmData.equipment.includes(equipId) ? ' ✅ **OWNED**' : '';
            
            description += `${equipment.emoji} **${equipment.name}** - ${priceDisplay}${owned}\n`;
            description += `└ ${equipment.description}\n`;
            description += `└ \`%farm upgrade ${equipId}\`\n\n`;
        }
    });

    const embed = new EmbedBuilder()
        .setTitle('🔧 Farm Equipment Shop')
        .setDescription(description)
        .setColor(0xe67e22)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleMarketPrices(message, userId) {
    const marketPrices = getMarketPrices();
    
    let description = '**📈 Today\'s Market Prices**\n\n';
    description += '*Prices fluctuate daily based on market conditions*\n\n';
    
    Object.entries(CROP_TYPES).forEach(([cropId, crop]) => {
        const prices = marketPrices[cropId];
        const riskIcon = crop.risk > 0 ? '⚠️' : '✅';
        
        description += `${crop.emoji} **${crop.name}** ${riskIcon}\n`;
        description += `└ 💰 Sell: ${prices.min.toLocaleString()} - ${prices.max.toLocaleString()} coins\n`;
        description += `└ 🌱 Seed: ${crop.seed_price.toLocaleString()} coins\n`;
        description += `└ ⏰ Grow Time: ${crop.grow_time} minutes\n\n`;
    });
    
    description += '⚠️ **Illegal crops carry police raid risk!**';

    const embed = new EmbedBuilder()
        .setTitle('📈 Crop Market')
        .setDescription(description)
        .setColor(0x27ae60)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleSeedShop(message, userId) {
    const userBalance = getBalance(userId);
    
    let description = '**🌱 Seed Shop**\n\n';
    description += `💰 **Your Balance:** ${userBalance.toLocaleString()} coins\n\n`;
    
    Object.entries(CROP_TYPES).forEach(([cropId, crop]) => {
        const canAfford = userBalance >= crop.seed_price;
        const priceDisplay = canAfford ? `💰 ${crop.seed_price.toLocaleString()}` : `❌ ${crop.seed_price.toLocaleString()}`;
        const riskIcon = crop.risk > 0 ? '⚠️' : '✅';
        
        description += `${crop.emoji} **${crop.name}** - ${priceDisplay} ${riskIcon}\n`;
        description += `└ ${crop.description}\n`;
        description += `└ ⏰ ${crop.grow_time}m grow time • ⭐ ${crop.xp_reward} XP\n`;
        description += `└ \`%farm plant ${cropId}\`\n\n`;
    });
    
    description += '⚠️ **Warning:** Illegal crops risk police raids!';

    const embed = new EmbedBuilder()
        .setTitle('🌱 Seed Shop')
        .setDescription(description)
        .setColor(0x27ae60)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleClearPlot(message, userId, args) {
    const plotId = parseInt(args[0]) || 1;
    
    const result = clearPlot(userId, plotId);
    
    if (!result.success) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Plot ${plotId} is already empty!`)
                    .setColor(0xff0000)
            ]
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Plot Cleared!')
        .setDescription(`Cleared **${result.crop_type.name}** from Plot ${plotId}.\n\nYou can now plant a new crop in this plot!`)
        .setColor(0x95a5a6)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}
