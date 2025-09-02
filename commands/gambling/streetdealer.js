const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');
const { 
    DRUG_DEALERS,
    getUserCrimeData,
    buyFromDealer,
    increaseFriendship
} = require('./utils/crime-manager');

// Street dealer cooldowns
const dealerCooldowns = {};

module.exports = {
    name: 'streetdealer',
    description: 'Buy drugs from shady NPC dealers on the streets - cheaper but riskier!',
    usage: '%streetdealer [dealer] [buy] [drug] [amount]',
    category: 'gambling',
    aliases: ['dealer', 'street', 'npc', 'sd', 'drugs'],
    cooldown: 8,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining } = require('./beatup');
        if (isArrested(userId)) {
            const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`🚔 You are currently under arrest! You cannot buy drugs for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Check cooldown
        const now = Date.now();
        const cooldownAmount = 8 * 1000; // 8 seconds
        
        if (dealerCooldowns[userId] && now < dealerCooldowns[userId] + cooldownAmount) {
            const timeLeft = Math.round((dealerCooldowns[userId] + cooldownAmount - now) / 1000);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`⏰ The dealers are watching for cops! Wait **${timeLeft}** more seconds.`)
                        .setColor(0xffa500)
                ]
            });
        }

        if (args.length === 0) {
            return await displayDealers(message, userId);
        }

        const dealerId = args[0].toLowerCase();
        
        // Handle numbered dealer selection: %sd 1, %sd 2 1
        if (!isNaN(parseInt(dealerId))) {
            const dealerNumber = parseInt(dealerId);
            const dealerIds = Object.keys(DRUG_DEALERS);
            
            if (dealerNumber < 1 || dealerNumber > dealerIds.length) {
                return await sendAsFloofWebhook(message, {
                    embeds: [
                        new EmbedBuilder()
                            .setDescription(`❌ Invalid dealer number! Choose 1-${dealerIds.length}.\nUse \`%sd\` to see all dealers.`)
                            .setColor(0xff0000)
                    ]
                });
            }
            
            const selectedDealerId = dealerIds[dealerNumber - 1];
            
            if (args.length === 1) {
                return await displayDealerInventory(message, userId, selectedDealerId);
            }
            
            // Handle numbered drug purchase: %sd 1 2 (dealer 1, drug 2)
            if (args.length >= 2 && !isNaN(parseInt(args[1]))) {
                const drugNumber = parseInt(args[1]);
                const amount = args[2] ? parseInt(args[2]) : 1;
                return await handleNumberedDrugPurchase(message, userId, selectedDealerId, drugNumber, amount);
            }
            
            if (args[1].toLowerCase() === 'buy') {
                return await handleBuyFromDealer(message, userId, selectedDealerId, args.slice(2));
            }
            
            return await displayDealerInventory(message, userId, selectedDealerId);
        }
        
        if (args.length === 1) {
            return await displayDealerInventory(message, userId, dealerId);
        }

        if (args[1].toLowerCase() === 'buy') {
            return await handleBuyFromDealer(message, userId, dealerId, args.slice(2));
        }

        return await displayDealers(message, userId);
    }
};

async function displayDealers(message, userId) {
    const userBalance = getBalance(userId);
    
    let description = '**🕴️ Street Dealers**\n\n';
    description += '*Psst... looking for something the blackmarket doesn\'t have?*\n\n';
    description += `💰 **Your Balance:** ${userBalance.toLocaleString()} coins\n\n`;
    description += '**Available Dealers:**\n';
    
    let dealerIndex = 1;
    Object.entries(DRUG_DEALERS).forEach(([dealerId, dealer]) => {
        description += `**${dealerIndex}.** ${dealer.emoji} **${dealer.name}**\n`;
        description += `└ 📍 Location: ${dealer.location}\n`;
        description += `└ 🚔 Risk: ${Math.floor(dealer.arrest_chance * 100)}%\n`;
        description += `└ ${dealer.description}\n`;
        description += `└ \`%sd ${dealerIndex}\` or \`%sd ${dealerId}\`\n\n`;
        dealerIndex++;
    });
    
    description += '⚠️ **Warning:** Street deals are risky but offer better prices!\n';
    description += '💡 **Quick Buy:** `%sd <dealer#> <drug#> [amount]`';

    const embed = new EmbedBuilder()
        .setTitle('🕴️ Street Dealers')
        .setDescription(description)
        .setColor(0x2c2c2c)
        .setFooter({ text: 'Meet in the shadows... 🌙' })
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function displayDealerInventory(message, userId, dealerId) {
    const dealer = DRUG_DEALERS[dealerId];
    if (!dealer) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Unknown dealer! Use `%sd` to see available dealers.')
                    .setColor(0xff0000)
            ]
        });
    }

    const userBalance = getBalance(userId);
    const { BLACKMARKET_ITEMS } = require('./utils/blackmarket-manager');
    
    let description = `**${dealer.emoji} ${dealer.name}**\n`;
    description += `📍 **Location:** ${dealer.location}\n`;
    description += `🚔 **Risk Level:** ${Math.floor(dealer.arrest_chance * 100)}%\n\n`;
    description += `💰 **Your Balance:** ${userBalance.toLocaleString()} coins\n\n`;
    description += `*"${dealer.description}"*\n\n`;
    description += '**Available Drugs:**\n';
    
    let drugIndex = 1;
    Object.entries(dealer.prices).forEach(([drugId, discount]) => {
        const drug = BLACKMARKET_ITEMS[drugId];
        if (drug) {
            const discountedPrice = Math.floor(drug.price.min * discount);
            const savings = drug.price.min - discountedPrice;
            const canAfford = userBalance >= discountedPrice;
            const priceDisplay = canAfford ? `💰 ${discountedPrice.toLocaleString()}` : `❌ ${discountedPrice.toLocaleString()}`;
            
            description += `**${drugIndex}.** ${drug.emoji} **${drug.name}** - ${priceDisplay}\n`;
            description += `└ ${drug.description}\n`;
            description += `└ 💸 Save ${savings.toLocaleString()} coins (${Math.floor((1-discount)*100)}% off)\n`;
            description += `└ \`%sd ${dealerId} ${drugIndex}\` or \`%sd ${dealerId} buy ${drugId}\`\n\n`;
            drugIndex++;
        }
    });
    
    description += '⚠️ **Remember:** Street deals carry arrest risk!\n';
    description += '💡 **Quick Buy:** `%sd <dealer#> <drug#> [amount]`';

    const embed = new EmbedBuilder()
        .setTitle(`🕴️ ${dealer.name}'s Inventory`)
        .setDescription(description)
        .setColor(0x2c2c2c)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleBuyFromDealer(message, userId, dealerId, args) {
    if (args.length < 1) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify what drug to buy!\nExample: `%streetdealer sketchy_steve buy weed`')
                    .setColor(0xff0000)
            ]
        });
    }

    const drugId = args[0].toLowerCase();
    const quantity = parseInt(args[1]) || 1;

    if (quantity < 1 || quantity > 5) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Quantity must be between 1 and 5!')
                    .setColor(0xff0000)
            ]
        });
    }

    const userBalance = getBalance(userId);
    
    // Set cooldown
    dealerCooldowns[userId] = Date.now();

    const result = buyFromDealer(userId, dealerId, drugId, quantity);

    if (!result.success) {
        if (result.reason === 'arrested') {
            // Use crime manager arrest function
            const { arrestUser } = require('./utils/crime-manager');
            const arrestDuration = result.arrest_time * 60 * 1000; // Convert to milliseconds
            arrestUser(userId, arrestDuration, 'Drug Deal', result.bail_amount);
            
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🚨 BUSTED!')
                        .setDescription(`**UNDERCOVER COPS!** You were caught buying drugs from ${result.dealer.emoji} **${result.dealer.name}**!\n\n🚔 **ARRESTED** for ${result.arrest_time} minutes!\n💸 **Bail Amount:** ${result.bail_amount.toLocaleString()} coins\n\n*It was a setup! The dealer was working with the cops...*\n\nUse \`%bail\` to pay bail or wait for help!`)
                        .setColor(0xff0000)
                        .setTimestamp()
                ]
            });
        }
        
        let errorMsg = '❌ ';
        switch (result.reason) {
            case 'invalid_dealer':
                errorMsg += 'Unknown dealer!';
                break;
            case 'drug_not_available':
                errorMsg += 'That dealer doesn\'t sell that drug!';
                break;
            case 'invalid_drug':
                errorMsg += 'Unknown drug type!';
                break;
            default:
                errorMsg += 'Purchase failed!';
        }
        
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(errorMsg)
                    .setColor(0xff0000)
            ]
        });
    }

    if (userBalance < result.total_cost) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Insufficient funds!\n\n💰 **Cost:** ${result.total_cost.toLocaleString()} coins\n💳 **Your Balance:** ${userBalance.toLocaleString()} coins`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Successful purchase
    subtractBalance(userId, result.total_cost);
    
    // Add to blackmarket inventory (reusing the system)
    const { getUserBlackmarketItems } = require('./utils/blackmarket-manager');
    const userData = getUserBlackmarketItems(userId);
    if (!userData.items[drugId]) {
        userData.items[drugId] = 0;
    }
    userData.items[drugId] += quantity;
    
    // Save the data
    const fs = require('fs');
    const path = require('path');
    const BLACKMARKET_DATA_FILE = path.join(__dirname, '../../../blackmarket-data.json');
    const data = JSON.parse(fs.readFileSync(BLACKMARKET_DATA_FILE, 'utf8') || '{}');
    data[userId] = userData;
    fs.writeFileSync(BLACKMARKET_DATA_FILE, JSON.stringify(data, null, 2));

    // Increase friendship with dealer (for future bail help)
    increaseFriendship(userId, `dealer_${dealerId}`, 1);

    const embed = new EmbedBuilder()
        .setTitle('💊 Street Deal Complete!')
        .setDescription(`*${result.dealer.name} slides you the goods in ${result.dealer.location}...*\n\n${result.drug.emoji} Successfully purchased **${quantity}x ${result.drug.name}**!\n\n💰 **Cost:** ${result.total_cost.toLocaleString()} coins\n💸 **You Saved:** ${((result.drug.price.min * quantity) - result.total_cost).toLocaleString()} coins\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins\n\n💡 Use \`%blackmarket use ${drugId}\` to consume the drugs!`)
        .setColor(0x2c2c2c)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

// Handle numbered drug purchase from dealer
async function handleNumberedDrugPurchase(message, userId, dealerId, drugNumber, amount = 1) {
    const dealer = DRUG_DEALERS[dealerId];
    if (!dealer) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Unknown dealer!')
                    .setColor(0xff0000)
            ]
        });
    }

    const drugIds = Object.keys(dealer.prices);
    
    if (drugNumber < 1 || drugNumber > drugIds.length) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Invalid drug number! Choose 1-${drugIds.length} for ${dealer.name}.\nUse \`%sd ${dealerId}\` to see available drugs.`)
                    .setColor(0xff0000)
            ]
        });
    }
    
    const selectedDrugId = drugIds[drugNumber - 1];
    return await handleBuyFromDealer(message, userId, dealerId, [selectedDrugId, amount.toString()]);
}
