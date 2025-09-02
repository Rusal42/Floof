const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, setBalance } = require('./utils/balance-manager');
const fs = require('fs');
const path = require('path');

// Race participants with different stats and odds
const RACE_PARTICIPANTS = {
    lightning_bolt: {
        name: 'Lightning Bolt',
        emoji: '⚡',
        speed: 85,
        stamina: 70,
        luck: 60,
        odds: 2.5,
        description: 'Fast starter but may tire late'
    },
    thunder_storm: {
        name: 'Thunder Storm',
        emoji: '🌩️',
        speed: 75,
        stamina: 90,
        luck: 70,
        odds: 3.2,
        description: 'Steady performer with strong finish'
    },
    midnight_shadow: {
        name: 'Midnight Shadow',
        emoji: '🌙',
        speed: 80,
        stamina: 75,
        luck: 85,
        odds: 3.8,
        description: 'Unpredictable dark horse'
    },
    golden_arrow: {
        name: 'Golden Arrow',
        emoji: '🏹',
        speed: 90,
        stamina: 60,
        luck: 50,
        odds: 2.1,
        description: 'Speed demon but fragile'
    },
    iron_will: {
        name: 'Iron Will',
        emoji: '🛡️',
        speed: 65,
        stamina: 95,
        luck: 75,
        odds: 4.5,
        description: 'Never gives up, strong closer'
    },
    fire_spirit: {
        name: 'Fire Spirit',
        emoji: '🔥',
        speed: 88,
        stamina: 65,
        luck: 80,
        odds: 2.8,
        description: 'Explosive speed when motivated'
    }
};

// Bet types with different payouts
const BET_TYPES = {
    win: { name: 'Win (1st)', description: 'Pick the winner (1st place)', multiplier: 1.0 },
    place: { name: 'Place (1st-2nd)', description: 'Pick 1st or 2nd place', multiplier: 0.6 },
    show: { name: 'Show (1st-3rd)', description: 'Pick 1st, 2nd, or 3rd place', multiplier: 0.4 },
    exacta: { name: 'Exacta', description: 'Pick 1st and 2nd in exact order', multiplier: 8.0 },
    trifecta: { name: 'Trifecta', description: 'Pick 1st, 2nd, and 3rd in exact order', multiplier: 25.0 }
};

// Data file paths
const RACE_DATA_FILE = path.join(__dirname, '../../data/race-data.json');
const RACE_STATS_FILE = path.join(__dirname, '../../data/race-stats.json');

// In-memory storage for active races and cooldowns
const activeRaces = new Map(); // guildId -> race data
const raceCooldowns = new Map(); // guildId -> timestamp

// Load persistent race data
function loadRaceData() {
    try {
        if (fs.existsSync(RACE_DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(RACE_DATA_FILE, 'utf8'));
            return data;
        }
    } catch (error) {
        console.error('Error loading race data:', error);
    }
    return {};
}

function saveRaceData(data) {
    try {
        fs.writeFileSync(RACE_DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving race data:', error);
    }
}

function loadRaceStats() {
    try {
        if (fs.existsSync(RACE_STATS_FILE)) {
            const data = JSON.parse(fs.readFileSync(RACE_STATS_FILE, 'utf8'));
            return data;
        }
    } catch (error) {
        console.error('Error loading race stats:', error);
    }
    return { totalRaces: 0, totalBets: 0, totalWinnings: 0, participantWins: {} };
}

function saveRaceStats(stats) {
    try {
        fs.writeFileSync(RACE_STATS_FILE, JSON.stringify(stats, null, 2));
    } catch (error) {
        console.error('Error saving race stats:', error);
    }
}

module.exports = {
    name: 'races',
    description: 'Bet on virtual races with multiple betting options',
    usage: '%races [start/bet/status/odds] [participant] [amount] [bet_type]',
    category: 'gambling',
    aliases: ['race', 'betting', 'track'],
    cooldown: 5,

    async execute(message, args) {
        const userId = message.author.id;
        const action = args[0]?.toLowerCase() || 'menu';

        try {
            switch (action) {
                case 'start':
                    return await startRace(message);
                case 'bet':
                    return await placeBet(message, args.slice(1));
                case 'status':
                    return await showRaceStatus(message);
                case 'odds':
                    return await showOdds(message);
                case 'menu':
                default:
                    return await showRaceMenu(message);
            }
        } catch (error) {
            console.error('Race command error:', error);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription('❌ An error occurred with the race system.')
                        .setColor(0xff0000)
                ]
            });
        }
    }
};

async function showRaceMenu(message) {
    const activeRace = activeRaces.get(message.guild.id);
    let description = '';

    if (activeRace) {
        const timeLeft = Math.ceil((activeRace.startTime - Date.now()) / 1000);
        if (timeLeft > 0) {
            description = `🏁 **Race Starting Soon!**\n\n`;
            description += `⏰ **Time until start:** ${timeLeft} seconds\n`;
            description += `💰 **Total bets:** ${activeRace.totalPool.toLocaleString()} coins\n`;
            description += `👥 **Bettors:** ${activeRace.bettors.size}\n\n`;
            description += `**🐎 Participants:**\n`;
            
            Object.entries(RACE_PARTICIPANTS).forEach(([id, participant]) => {
                description += `${participant.emoji} **${participant.name}** (${participant.odds}:1)\n`;
            });
            
            description += `\n💡 Use \`%races bet <participant> <amount> [bet_type]\` to place bets!`;
        } else {
            description = `🏁 **Race in Progress!**\n\nUse \`%races status\` to see live updates!`;
        }
    } else {
        description = `🏁 **Welcome to Floof Racing!**\n\n`;
        description += `**🎯 How to Play:**\n`;
        description += `• \`%races start\` - Start a new race (60s betting period)\n`;
        description += `• \`%races bet <participant> <amount> [type]\` - Place your bets\n`;
        description += `• \`%races odds\` - View current odds and participants\n\n`;
        
        description += `**🎲 Bet Types:**\n`;
        Object.entries(BET_TYPES).forEach(([type, info]) => {
            description += `• **${info.name}:** ${info.description}\n`;
        });
        
        description += `\n💰 **Minimum bet:** 100 coins\n`;
        description += `🏆 **Payouts:** Based on odds × bet type multiplier`;
    }

    const embed = new EmbedBuilder()
        .setTitle('🏁 Floof Racing Track')
        .setDescription(description)
        .setColor(0xf39c12)
        .setThumbnail('https://cdn.discordapp.com/emojis/🏇.png')
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`races_start_${message.author.id}`)
                .setLabel('🏁 Start Race')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!!activeRace),
            new ButtonBuilder()
                .setCustomId(`races_odds_${message.author.id}`)
                .setLabel('📊 View Odds')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`races_status_${message.author.id}`)
                .setLabel('📈 Race Status')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!activeRace)
        );

    return await sendAsFloofWebhook(message, {
        embeds: [embed],
        components: [row]
    });
}

async function startRace(message) {
    const guildId = message.guild.id;
    const userId = message.author.id;
    
    // Check cooldown
    const now = Date.now();
    const lastRace = raceCooldowns.get(guildId);
    if (lastRace && now - lastRace < 300000) { // 5 minute cooldown
        const remaining = Math.ceil((300000 - (now - lastRace)) / 60000);
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Please wait ${remaining} more minutes before starting another race.`)
                    .setColor(0xff0000)
            ]
        });
    }

    if (activeRaces.has(guildId)) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ A race is already active in this server!')
                    .setColor(0xff0000)
            ]
        });
    }

    // Create new race
    const race = {
        guildId,
        starterId: userId,
        startTime: now + 60000, // 60 seconds betting period
        participants: Object.keys(RACE_PARTICIPANTS),
        bets: new Map(),
        bettors: new Set(),
        totalPool: 0,
        status: 'betting'
    };

    activeRaces.set(guildId, race);

    const embed = new EmbedBuilder()
        .setTitle('🏁 New Race Starting!')
        .setDescription(`**🎯 Betting is now open!**\n\n⏰ **Betting closes in:** 60 seconds\n💰 **Minimum bet:** 100 coins\n\n**🐎 Participants:**\n${Object.entries(RACE_PARTICIPANTS).map(([id, p]) => `${p.emoji} **${p.name}** (${p.odds}:1)`).join('\n')}\n\n💡 Use \`%races bet <participant> <amount> [bet_type]\` to place bets!`)
        .setColor(0x00ff00)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });

    // Start race after betting period
    setTimeout(() => runRace(message), 60000);
}

async function placeBet(message, args) {
    const guildId = message.guild.id;
    const userId = message.author.id;
    const activeRace = activeRaces.get(guildId);

    if (!activeRace || activeRace.status !== 'betting') {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ No active race accepting bets right now!')
                    .setColor(0xff0000)
            ]
        });
    }

    if (!args[0] || !args[1]) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Usage: `%races bet <participant> <amount> [bet_type]`\n\n**Participants:** lightning, thunder, midnight, golden, silver, crimson')
                    .setColor(0xff0000)
            ]
        });
    }

    const participantInput = args[0].toLowerCase();
    const amount = parseInt(args[1]);
    const betType = args[2]?.toLowerCase() || 'win';

    // Validate participant with better matching
    let participant = null;
    for (const [id, p] of Object.entries(RACE_PARTICIPANTS)) {
        if (id.includes(participantInput) || 
            p.name.toLowerCase().includes(participantInput) ||
            id === participantInput) {
            participant = [id, p];
            break;
        }
    }

    if (!participant) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Invalid participant! Try: **lightning**, **thunder**, **midnight**, **golden**, **silver**, or **crimson**`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Validate bet type
    if (!BET_TYPES[betType]) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Invalid bet type! Use: ${Object.keys(BET_TYPES).join(', ')}`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Validate amount
    if (!amount || amount < 100) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Minimum bet is 100 coins!')
                    .setColor(0xff0000)
            ]
        });
    }

    const userBalance = getBalance(userId);
    if (userBalance < amount) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Insufficient funds! You have ${userBalance.toLocaleString()} coins.`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Check if user already has a bet
    const existingBet = activeRace.bets.get(userId);
    if (existingBet) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ You already have a bet on this race!')
                    .setColor(0xff0000)
            ]
        });
    }

    // Place bet
    setBalance(userId, userBalance - amount);
    activeRace.bets.set(userId, {
        participant: participant[0],
        amount,
        betType,
        odds: participant[1].odds
    });
    activeRace.bettors.add(userId);
    activeRace.totalPool += amount;

    const embed = new EmbedBuilder()
        .setTitle('🎫 Bet Placed!')
        .setDescription(`**${participant[1].emoji} ${participant[1].name}**\n\n💰 **Amount:** ${amount.toLocaleString()} coins\n🎯 **Bet Type:** ${BET_TYPES[betType].name}\n📊 **Odds:** ${participant[1].odds}:1\n💎 **Potential Payout:** ${Math.floor(amount * participant[1].odds * BET_TYPES[betType].multiplier).toLocaleString()} coins`)
        .setColor(0x00ff00)
        .setTimestamp();

    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function runRace(message) {
    const guildId = message.guild.id;
    const race = activeRaces.get(guildId);
    
    if (!race) return;

    race.status = 'running';

    // Show race starting animation
    await showRaceAnimation(message, race);

    // Simulate race
    const participants = Object.entries(RACE_PARTICIPANTS);
    const raceResults = [];

    participants.forEach(([id, participant]) => {
        // Calculate performance based on stats + randomness
        const performance = (
            participant.speed * 0.4 +
            participant.stamina * 0.3 +
            participant.luck * 0.3 +
            Math.random() * 30
        );
        
        raceResults.push({
            id,
            participant,
            performance,
            position: 0
        });
    });

    // Sort by performance and assign positions
    raceResults.sort((a, b) => b.performance - a.performance);
    raceResults.forEach((result, index) => {
        result.position = index + 1;
    });

    // Process payouts
    const winners = [];
    const losers = [];

    for (const [userId, bet] of race.bets) {
        const betParticipant = raceResults.find(r => r.id === bet.participant);
        let won = false;
        let payout = 0;

        switch (bet.betType) {
            case 'win':
                won = betParticipant.position === 1;
                break;
            case 'place':
                won = betParticipant.position <= 2;
                break;
            case 'show':
                won = betParticipant.position <= 3;
                break;
            case 'exacta':
                // For simplicity, just check if their pick won
                won = betParticipant.position === 1;
                break;
            case 'trifecta':
                // For simplicity, just check if their pick won
                won = betParticipant.position === 1;
                break;
        }

        if (won) {
            payout = Math.floor(bet.amount * bet.odds * BET_TYPES[bet.betType].multiplier);
            const currentBalance = getBalance(userId);
            setBalance(userId, currentBalance + payout);
            winners.push({ userId, bet, payout });
        } else {
            losers.push({ userId, bet });
        }
    }

    // Show animated results
    await showRaceResults(message, raceResults, winners, race);

    // Update race statistics
    const raceStats = loadRaceStats();
    raceStats.totalRaces = (raceStats.totalRaces || 0) + 1;
    raceStats.totalBets = (raceStats.totalBets || 0) + race.bets.size;
    raceStats.totalWinnings = (raceStats.totalWinnings || 0) + winners.reduce((sum, w) => sum + w.payout, 0);
    
    // Track participant wins
    if (!raceStats.participantWins) raceStats.participantWins = {};
    const winner = raceResults[0];
    raceStats.participantWins[winner.id] = (raceStats.participantWins[winner.id] || 0) + 1;
    
    saveRaceStats(raceStats);

    // Clean up
    activeRaces.delete(guildId);
    raceCooldowns.set(guildId, Date.now());
}

async function showRaceAnimation(message, race) {
    const animationFrames = [
        '🏁 **RACE STARTING!**\n\n🐎 Participants are lining up at the gate...',
        '🏁 **RACE STARTING!**\n\n🚪 Gates are opening...\n\n3️⃣',
        '🏁 **RACE STARTING!**\n\n🚪 Gates are opening...\n\n2️⃣',
        '🏁 **RACE STARTING!**\n\n🚪 Gates are opening...\n\n1️⃣',
        '🏁 **AND THEY\'RE OFF!**\n\n🏃‍♂️💨 The race has begun!'
    ];

    const embed = new EmbedBuilder()
        .setTitle('🏁 Floof Racing Track')
        .setColor(0xff6b35);

    let sentMessage;
    
    for (let i = 0; i < animationFrames.length; i++) {
        embed.setDescription(animationFrames[i]);
        
        if (i === 0) {
            sentMessage = await sendAsFloofWebhook(message, { embeds: [embed] });
        } else {
            // Wait 1 second between frames
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
                if (sentMessage && sentMessage.edit) {
                    await sentMessage.edit({ embeds: [embed] });
                }
            } catch (error) {
                // If edit fails, send new message
                await sendAsFloofWebhook(message, { embeds: [embed] });
            }
        }
    }
}

async function showRaceResults(message, raceResults, winners, race) {
    // Create animated finish line sequence
    const finishFrames = [
        '🏁 **APPROACHING THE FINISH!**\n\n🏃‍♂️💨 Neck and neck!',
        '🏁 **PHOTO FINISH!**\n\n📸 Checking the results...',
        '🏁 **OFFICIAL RESULTS!**\n\n🎊 Winners announced!'
    ];

    const embed = new EmbedBuilder()
        .setTitle('🏁 Race Results')
        .setColor(0xffd700);

    // Show finish animation
    for (let i = 0; i < finishFrames.length; i++) {
        embed.setDescription(finishFrames[i]);
        await sendAsFloofWebhook(message, { embeds: [embed] });
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Final results with celebration
    let resultsDesc = `🎊 **FINAL RESULTS** 🎊\n\n`;
    
    // Add dramatic finish line
    resultsDesc += `${'═'.repeat(30)}\n`;
    resultsDesc += `🏁 **FINISH LINE** 🏁\n`;
    resultsDesc += `${'═'.repeat(30)}\n\n`;

    raceResults.forEach((result, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}️⃣`;
        const celebration = index === 0 ? ' 🎉' : index === 1 ? ' 🎊' : index === 2 ? ' ✨' : '';
        resultsDesc += `${medal} ${result.participant.emoji} **${result.participant.name}**${celebration}\n`;
        
        if (index === 0) {
            resultsDesc += `    🏆 **WINNER!** Performance: ${result.performance.toFixed(1)}\n`;
        }
        resultsDesc += '\n';
    });

    resultsDesc += `💰 **Total Pool:** ${race.totalPool.toLocaleString()} coins\n`;
    resultsDesc += `🎯 **Total Bettors:** ${race.bettors.size}\n\n`;

    if (winners.length > 0) {
        resultsDesc += `🎉 **WINNING BETTORS:**\n`;
        resultsDesc += `${'─'.repeat(25)}\n`;
        winners.forEach(w => {
            const betInfo = race.bets.get(w.userId);
            const participant = RACE_PARTICIPANTS[betInfo.participant];
            resultsDesc += `💎 <@${w.userId}>: **+${w.payout.toLocaleString()}** coins\n`;
            resultsDesc += `   └ Bet: ${participant.emoji} ${participant.name} (${BET_TYPES[betInfo.betType].name})\n`;
        });
        resultsDesc += '\n🎊 Congratulations to all winners!';
    } else {
        resultsDesc += `😢 **No winners this time!**\n`;
        resultsDesc += `Better luck next race! 🍀`;
    }

    const finalEmbed = new EmbedBuilder()
        .setTitle('🏆 Race Complete - Final Results!')
        .setDescription(resultsDesc)
        .setColor(0xffd700)
        .setFooter({ text: 'Next race available in 5 minutes' })
        .setTimestamp();

    // Add celebration button
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`races_celebrate_${message.author.id}`)
                .setLabel('🎉 Celebrate!')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`races_menu_${message.author.id}`)
                .setLabel('🏁 Race Menu')
                .setStyle(ButtonStyle.Primary)
        );

    await sendAsFloofWebhook(message, { 
        embeds: [finalEmbed],
        components: [row]
    });
}

async function showRaceStatus(message) {
    const activeRace = activeRaces.get(message.guild.id);
    
    if (!activeRace) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ No active race in this server!')
                    .setColor(0xff0000)
            ]
        });
    }

    const timeLeft = Math.ceil((activeRace.startTime - Date.now()) / 1000);
    let description = '';

    if (timeLeft > 0) {
        description = `🏁 **Race Status: Betting Open**\n\n`;
        description += `⏰ **Time until start:** ${timeLeft} seconds\n`;
        description += `💰 **Total pool:** ${activeRace.totalPool.toLocaleString()} coins\n`;
        description += `👥 **Bettors:** ${activeRace.bettors.size}\n\n`;
        description += `💡 Betting closes when the race starts!`;
    } else {
        description = `🏁 **Race Status: In Progress**\n\n`;
        description += `🏃‍♂️ The race is currently running...\n`;
        description += `💰 **Total pool:** ${activeRace.totalPool.toLocaleString()} coins\n`;
        description += `👥 **Bettors:** ${activeRace.bettors.size}`;
    }

    const embed = new EmbedBuilder()
        .setTitle('📈 Race Status')
        .setDescription(description)
        .setColor(0x3498db)
        .setTimestamp();

    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function showOdds(message) {
    let description = `**🐎 Current Participants & Odds:**\n\n`;
    
    Object.entries(RACE_PARTICIPANTS).forEach(([id, participant]) => {
        description += `${participant.emoji} **${participant.name}**\n`;
        description += `└ 📊 Odds: ${participant.odds}:1\n`;
        description += `└ ⚡ Speed: ${participant.speed}/100\n`;
        description += `└ 💪 Stamina: ${participant.stamina}/100\n`;
        description += `└ 🍀 Luck: ${participant.luck}/100\n`;
        description += `└ 💭 ${participant.description}\n\n`;
    });

    description += `**🎲 Bet Types:**\n`;
    Object.entries(BET_TYPES).forEach(([type, info]) => {
        description += `• **${info.name}:** ${info.description} (${info.multiplier}x)\n`;
    });

    const embed = new EmbedBuilder()
        .setTitle('📊 Racing Odds & Stats')
        .setDescription(description)
        .setColor(0x9b59b6)
        .setTimestamp();

    return await sendAsFloofWebhook(message, { embeds: [embed] });
}

// Export functions for interaction handler
module.exports.showRaceMenu = showRaceMenu;
module.exports.showOdds = showOdds;
module.exports.showRaceStatus = showRaceStatus;
module.exports.startRace = startRace;
module.exports.placeBet = placeBet;
