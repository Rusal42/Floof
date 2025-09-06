const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance } = require('./utils/balance-manager');
const fs = require('fs');
const path = require('path');

// Lottery data file
const LOTTERY_FILE = path.join(__dirname, '../../data/lottery-data.json');

// Ticket prices and prizes
const TICKET_PRICE = 100;
const JACKPOT_BASE = 10000;

module.exports = {
    name: 'lottery',
    description: 'Buy lottery tickets and win big prizes!',
    usage: '%lottery [buy/draw/check/jackpot]',
    category: 'gambling',
    aliases: ['lotto', 'tickets'],
    cooldown: 3,

    async execute(message, args) {
        const userId = message.author.id;
        
        if (args.length === 0) {
            return await showLotteryInfo(message);
        }

        const action = args[0].toLowerCase();
        
        switch (action) {
            case 'buy':
                return await buyLotteryTicket(message, userId, args.slice(1));
            case 'draw':
                return await drawLottery(message, userId);
            case 'check':
                return await checkTickets(message, userId);
            case 'jackpot':
            case 'prize':
                return await showJackpot(message);
            default:
                return await showLotteryInfo(message);
        }
    }
};

function getLotteryData() {
    try {
        if (fs.existsSync(LOTTERY_FILE)) {
            return JSON.parse(fs.readFileSync(LOTTERY_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error reading lottery data:', error);
    }
    
    return {
        currentDraw: 1,
        jackpot: JACKPOT_BASE,
        tickets: {},
        lastDraw: 0,
        winningNumbers: [],
        winners: []
    };
}

function saveLotteryData(data) {
    try {
        const dataDir = path.dirname(LOTTERY_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(LOTTERY_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving lottery data:', error);
    }
}

function generateLotteryNumbers() {
    const numbers = [];
    while (numbers.length < 6) {
        const num = Math.floor(Math.random() * 49) + 1;
        if (!numbers.includes(num)) {
            numbers.push(num);
        }
    }
    return numbers.sort((a, b) => a - b);
}

async function buyLotteryTicket(message, userId, args) {
    const userBalance = getBalance(userId);
    
    let ticketCount = 1;
    if (args.length > 0) {
        ticketCount = parseInt(args[0]);
        if (isNaN(ticketCount) || ticketCount < 1 || ticketCount > 10) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ You can buy 1-10 tickets at a time!')
                        .setColor(0xff0000)
                ]
            });
        }
    }
    
    const totalCost = TICKET_PRICE * ticketCount;
    
    if (userBalance < totalCost) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You need **${totalCost.toLocaleString()}** coins to buy ${ticketCount} ticket(s)!\nYou have **${userBalance.toLocaleString()}** coins.`)
                    .setColor(0xff0000)
            ]
        });
    }
    
    const lotteryData = getLotteryData();
    
    if (!lotteryData.tickets[userId]) {
        lotteryData.tickets[userId] = [];
    }
    
    const tickets = [];
    for (let i = 0; i < ticketCount; i++) {
        const numbers = generateLotteryNumbers();
        tickets.push({
            numbers,
            draw: lotteryData.currentDraw,
            timestamp: Date.now()
        });
        lotteryData.tickets[userId].push({
            numbers,
            draw: lotteryData.currentDraw,
            timestamp: Date.now()
        });
    }
    
    // Add to jackpot
    lotteryData.jackpot += Math.floor(totalCost * 0.7);
    
    subtractBalance(userId, totalCost);
    saveLotteryData(lotteryData);
    
    let description = `🎫 **Lottery Tickets Purchased!**\n\n`;
    description += `**Tickets Bought:** ${ticketCount}\n`;
    description += `**Total Cost:** ${totalCost.toLocaleString()} coins\n`;
    description += `**Draw #:** ${lotteryData.currentDraw}\n\n`;
    
    description += `**Your Numbers:**\n`;
    tickets.forEach((ticket, index) => {
        description += `🎫 **Ticket ${index + 1}:** ${ticket.numbers.join(' - ')}\n`;
    });
    
    description += `\n**💰 Current Jackpot:** ${lotteryData.jackpot.toLocaleString()} coins`;
    description += `\n**💳 Balance:** ${getBalance(userId).toLocaleString()} coins`;
    
    const embed = new EmbedBuilder()
        .setTitle('🎫 Lottery Tickets')
        .setDescription(description)
        .setColor(0xf39c12)
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`lottery_buy_${userId}`)
                .setLabel('🎫 Buy More')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`lottery_check_${userId}`)
                .setLabel('📋 My Tickets')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row]
    });
}

async function drawLottery(message, userId) {
    // Only allow owner to draw
    const { isOwner } = require('../../utils/owner-util');
    if (!isOwner(userId)) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Only the bot owner can draw the lottery!')
                    .setColor(0xff0000)
            ]
        });
    }
    
    const lotteryData = getLotteryData();
    const winningNumbers = generateLotteryNumbers();
    
    // Find winners
    const winners = [];
    const allTickets = Object.entries(lotteryData.tickets);
    
    for (const [playerId, playerTickets] of allTickets) {
        for (const ticket of playerTickets) {
            if (ticket.draw === lotteryData.currentDraw) {
                const matches = ticket.numbers.filter(num => winningNumbers.includes(num)).length;
                if (matches >= 3) {
                    winners.push({
                        userId: playerId,
                        matches,
                        numbers: ticket.numbers,
                        prize: calculatePrize(matches, lotteryData.jackpot)
                    });
                }
            }
        }
    }
    
    // Distribute prizes
    let totalPaid = 0;
    for (const winner of winners) {
        addBalance(winner.userId, winner.prize);
        totalPaid += winner.prize;
    }
    
    // Update lottery data
    lotteryData.winningNumbers = winningNumbers;
    lotteryData.winners = winners;
    lotteryData.lastDraw = Date.now();
    lotteryData.currentDraw++;
    lotteryData.jackpot = Math.max(JACKPOT_BASE, lotteryData.jackpot - totalPaid);
    lotteryData.tickets = {}; // Clear old tickets
    
    saveLotteryData(lotteryData);
    
    let description = `🎰 **LOTTERY DRAW COMPLETE!**\n\n`;
    description += `**Winning Numbers:** ${winningNumbers.join(' - ')}\n\n`;
    
    if (winners.length > 0) {
        description += `**🏆 WINNERS:**\n`;
        for (const winner of winners) {
            try {
                const user = await message.client.users.fetch(winner.userId);
                description += `🎉 ${user.username}: ${winner.matches} matches - ${winner.prize.toLocaleString()} coins\n`;
            } catch {
                description += `🎉 Player: ${winner.matches} matches - ${winner.prize.toLocaleString()} coins\n`;
            }
        }
        description += `\n**💰 Total Paid:** ${totalPaid.toLocaleString()} coins`;
    } else {
        description += `**😢 No Winners This Draw**\nJackpot rolls over!`;
    }
    
    description += `\n\n**💎 Next Jackpot:** ${lotteryData.jackpot.toLocaleString()} coins`;
    description += `\n**🎫 Draw #${lotteryData.currentDraw}** now open for tickets!`;
    
    const embed = new EmbedBuilder()
        .setTitle('🎰 Lottery Draw Results')
        .setDescription(description)
        .setColor(0x2ecc71)
        .setTimestamp();
    
    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

function calculatePrize(matches, jackpot) {
    switch (matches) {
        case 6: return jackpot; // Full jackpot
        case 5: return Math.floor(jackpot * 0.1); // 10%
        case 4: return Math.floor(jackpot * 0.02); // 2%
        case 3: return Math.floor(jackpot * 0.005); // 0.5%
        default: return 0;
    }
}

async function checkTickets(message, userId) {
    const lotteryData = getLotteryData();
    const userTickets = lotteryData.tickets[userId] || [];
    
    if (userTickets.length === 0) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('🎫 You don\'t have any lottery tickets!\nUse `%lottery buy` to purchase tickets.')
                    .setColor(0xffa500)
            ]
        });
    }
    
    let description = `**🎫 Your Lottery Tickets**\n\n`;
    description += `**Current Draw:** #${lotteryData.currentDraw}\n`;
    description += `**Your Tickets:** ${userTickets.length}\n\n`;
    
    userTickets.forEach((ticket, index) => {
        description += `🎫 **Ticket ${index + 1}:** ${ticket.numbers.join(' - ')}\n`;
    });
    
    description += `\n**💰 Current Jackpot:** ${lotteryData.jackpot.toLocaleString()} coins`;
    
    if (lotteryData.winningNumbers.length > 0) {
        description += `\n\n**Last Draw Winners:** ${lotteryData.winningNumbers.join(' - ')}`;
    }
    
    const embed = new EmbedBuilder()
        .setTitle('🎫 Your Lottery Tickets')
        .setDescription(description)
        .setColor(0x3498db)
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`lottery_buy_${userId}`)
                .setLabel('🎫 Buy More')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`lottery_jackpot_${userId}`)
                .setLabel('💰 Jackpot Info')
                .setStyle(ButtonStyle.Success)
        );
    
    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row]
    });
}

async function showJackpot(message) {
    const lotteryData = getLotteryData();
    
    let description = `**💰 Current Jackpot Information**\n\n`;
    description += `**💎 Jackpot:** ${lotteryData.jackpot.toLocaleString()} coins\n`;
    description += `**🎫 Ticket Price:** ${TICKET_PRICE.toLocaleString()} coins\n`;
    description += `**🎰 Current Draw:** #${lotteryData.currentDraw}\n\n`;
    
    description += `**🏆 Prize Structure:**\n`;
    description += `🎯 **6 matches:** Full Jackpot\n`;
    description += `🎯 **5 matches:** 10% of Jackpot\n`;
    description += `🎯 **4 matches:** 2% of Jackpot\n`;
    description += `🎯 **3 matches:** 0.5% of Jackpot\n\n`;
    
    if (lotteryData.winningNumbers.length > 0) {
        description += `**Last Draw:** ${lotteryData.winningNumbers.join(' - ')}\n`;
        description += `**Winners:** ${lotteryData.winners.length}`;
    }
    
    const embed = new EmbedBuilder()
        .setTitle('💰 Lottery Jackpot')
        .setDescription(description)
        .setColor(0xf1c40f)
        .setTimestamp();
    
    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function showLotteryInfo(message) {
    const lotteryData = getLotteryData();
    
    const embed = new EmbedBuilder()
        .setTitle('🎰 Floof Lottery')
        .setDescription(`**How to Play:**
• Buy tickets with 6 random numbers (1-49)
• Match 3+ numbers to win prizes
• More matches = bigger prizes!

**Commands:**
\`%lottery buy [amount]\` - Buy 1-10 tickets
\`%lottery check\` - View your tickets
\`%lottery jackpot\` - Current jackpot info

**Current Jackpot:** ${lotteryData.jackpot.toLocaleString()} coins
**Ticket Price:** ${TICKET_PRICE} coins each
**Draw #:** ${lotteryData.currentDraw}

**Prize Structure:**
🎯 6 matches: Full Jackpot
🎯 5 matches: 10% of Jackpot  
🎯 4 matches: 2% of Jackpot
🎯 3 matches: 0.5% of Jackpot`)
        .setColor(0xe67e22)
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`lottery_buy_${message.author.id}`)
                .setLabel('🎫 Buy Tickets')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`lottery_jackpot_${message.author.id}`)
                .setLabel('💰 Jackpot Info')
                .setStyle(ButtonStyle.Primary)
        );
    
    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row]
    });
}

async function handleLotteryAction(interaction, action) {
    const userId = interaction.user.id;
    
    await interaction.deferUpdate();
    
    const message = {
        author: interaction.user,
        channel: interaction.channel,
        guild: interaction.guild,
        client: interaction.client
    };
    
    switch (action) {
        case 'buy':
            return await buyLotteryTicket(message, userId, ['1']);
        case 'check':
            return await checkTickets(message, userId);
        case 'jackpot':
            return await showJackpot(message);
    }
}

module.exports.handleLotteryAction = handleLotteryAction;
