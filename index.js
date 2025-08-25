require('dotenv').config();
// Allow using DISCORD_BOT_TOKEN in .env without renaming
process.env.DISCORD_TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

// Initialize data directory
async function initializeDataDirectory() {
    const dataDir = path.join(__dirname, 'data');
    const configFiles = [
        'server-configs.json',
        'infractions.json',
        'ticket-config.json',
        'voice-config.json',
        'voice-channels.json',
        'prefix-config.json',
        'meowlock.json'
    ];

    try {
        // Create data directory if it doesn't exist
        await fs.mkdir(dataDir, { recursive: true });
        console.log(`✅ Created/Verified data directory: ${dataDir}`);

        // Initialize empty config files if they don't exist
        for (const file of configFiles) {
            const filePath = path.join(dataDir, file);
            try {
                await fs.access(filePath);
                console.log(`✅ Config file exists: ${file}`);
            } catch {
                await fs.writeFile(filePath, '{}', 'utf8');
                console.log(`✅ Created empty config: ${file}`);
            }
        }

        // Attempt to restore infractions from backup if current is empty
        try {
            const backupPath = path.join(__dirname, 'infractions.json.backup');
            const infractionsPath = path.join(dataDir, 'infractions.json');

            // Check backup exists
            await fs.access(backupPath);

            // Read current infractions (may be newly created `{}`)
            let currentRaw = '{}';
            try {
                currentRaw = await fs.readFile(infractionsPath, 'utf8');
            } catch {/* ignore, treat as empty */}
            const currentJson = JSON.parse(currentRaw || '{}');

            // Read backup
            const backupRaw = await fs.readFile(backupPath, 'utf8');
            const backupJson = JSON.parse(backupRaw || '{}');

            const currentEmpty = !currentJson || Object.keys(currentJson).length === 0;
            const backupHasData = backupJson && Object.keys(backupJson).length > 0;

            if (currentEmpty && backupHasData) {
                await fs.writeFile(infractionsPath, JSON.stringify(backupJson, null, 2), 'utf8');
                console.log('✅ Restored data/infractions.json from infractions.json.backup');
            } else {
                console.log('ℹ️ Skipped infractions restore: current has data or backup empty');
            }
        } catch (e) {
            console.log('ℹ️ No valid infractions backup to restore (or restore skipped):', e.message);
        }
    } catch (error) {
        console.error('❌ Error initializing data directory:', error);
        process.exit(1);
    }
}

// Run initialization
initializeDataDirectory().catch(console.error);

const { sendAsFloofWebhook } = require('./utils/webhook-util');
const CommandHandler = require('./handlers/CommandHandler');
const { isOwner, getPrimaryOwnerId } = require('./utils/owner-util');
const { 
    startStatsUpdater, 
    incrementCommandUsage, 
    recordDisconnection,
    initializeStats 
} = require('./utils/website-integration');

// Set your Discord user ID here (now supports multiple owners)
const OWNER_ID = getPrimaryOwnerId();

// (AI features removed)

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers, // Needed for welcome system
        GatewayIntentBits.GuildVoiceStates // Needed for voice channel management
    ]
});

// Initialize command handler
const commandHandler = new CommandHandler(client);

// Load owner commands
const ownerCommands = require('./owner-commands/owner-commands');
const { ownerMenu } = ownerCommands;
const nukeCommand = require('./owner-commands/nukeall');
const floofyCommand = require('./owner-commands/floofy');
const floofymCommand = require('./owner-commands/floofym');

// Register owner commands with the command handler
Object.entries({ ownerMenu }).forEach(([name, execute]) => {
    commandHandler.commands.set(name.toLowerCase(), { 
        name, 
        execute, 
        ownerOnly: true,
        description: 'Owner command',
        aliases: []
    });
});

// Register individual meowlock commands as owner-only
const meowlockCommands = {
    'meowlock': ownerCommands.meowlock,
    'meowunlock': ownerCommands.meowunlock,
    'meowlockclear': ownerCommands.meowlockclear,
    'meowlocked': ownerCommands.meowlocked
};

Object.entries(meowlockCommands).forEach(([name, execute]) => {
    if (execute) {
        commandHandler.commands.set(name, { 
            name, 
            execute, 
            ownerOnly: true,
            description: `Meowlock command: ${name}`,
            aliases: []
        });
        console.log(`✅ Registered ${name} command (owner only)`);
    }
});

// Register floofy command
if (floofyCommand && floofyCommand.execute) {
    console.log('✅ Registering floofy command with command handler');
    
    // Add aliases if they don't exist
    if (!floofyCommand.aliases) {
        floofyCommand.aliases = [];
    }
    
    // Register the command directly
    commandHandler.commands.set('floofy', floofyCommand);
    
    console.log(`✅ Registered floofy command with ${floofyCommand.aliases.length} aliases`);
}

// Register floofym command
if (floofymCommand && floofymCommand.execute) {
    console.log('✅ Registering floofym command with command handler');
    
    // Add aliases if they don't exist
    if (!floofymCommand.aliases) {
        floofymCommand.aliases = [];
    }
    
    // Register the command directly
    commandHandler.commands.set('floofym', floofymCommand);
    
    console.log(`✅ Registered floofym command with ${floofymCommand.aliases.length} aliases`);
}

// Register nuke command
if (nukeCommand && nukeCommand.execute) {
    console.log('✅ Registering nukeall command with command handler');
    
    // Add aliases if they don't exist
    if (!nukeCommand.aliases) {
        nukeCommand.aliases = [];
    }
    
    // Register the command directly
    commandHandler.commands.set('nukeall', nukeCommand);
    
    // Register aliases if they exist
    if (nukeCommand.aliases && nukeCommand.aliases.length > 0) {
        nukeCommand.aliases.forEach(alias => {
            commandHandler.aliases.set(alias.toLowerCase(), 'nukeall');
        });
    }
    
    console.log(`✅ Registered nukeall command with ${nukeCommand.aliases.length} aliases`);
} else {
    console.error('❌ Failed to load nukeall command - missing execute function');
}

// Register fluffy commands
const { fluffySnap } = require('./creation/fluffy-snap');
const { fluffySetup } = require('./creation/fluffy-setup');

// Register fluffysnap command
commandHandler.commands.set('fluffysnap', {
    name: 'fluffysnap',
    execute: fluffySnap,
    ownerOnly: true,
    description: 'Remove all channels and prepare for a fresh setup (owner only)',
    permissions: ['Administrator']
});

// Import and register leaveservers command
const leaveServersCommand = require('./owner-commands/leave-foreign-servers');
commandHandler.commands.set(leaveServersCommand.name, leaveServersCommand);

// Register fluffysetup command
commandHandler.commands.set('fluffysetup', {
    name: 'fluffysetup',
    execute: fluffySetup,
    ownerOnly: true,
    description: 'Set up the server with default channels and categories (owner only)',
    permissions: ['Administrator']
});

client.once('ready', () => {
    console.log(`🟢 Floof is online as ${client.user.tag}!`);
    console.log(`📋 Loaded ${commandHandler.commands.size} commands`);
    
    // Initialize website stats tracking
    initializeStats();
    
    // Start automatic website stats updates (every 5 minutes)
    startStatsUpdater(client, 5);
    
    // Set bot activity to show server invite
    client.user.setActivity('discord.gg/Acpx662Eyg', { 
        type: 3 // 3 = WATCHING
    });
});

// Track disconnections for uptime calculation
client.on('disconnect', () => {
    console.log('🔴 Bot disconnected');
    recordDisconnection();
});

client.on('error', (error) => {
    console.error('🔴 Bot error:', error);
    recordDisconnection();
});

// Handle button interactions for blackjack and snipe commands
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    // Handle blackjack button interactions
    if (interaction.customId === 'blackjack_hit' || interaction.customId === 'blackjack_stand') {
        const { handleBlackjackInteraction } = require('./commands/gambling/blackjack-handler');
        await handleBlackjackInteraction(interaction);
        return;
    }
    
    // Handle snipe navigation buttons
    if (interaction.customId.startsWith('snipe_') || interaction.customId.startsWith('bulk_')) {
        await handleSnipeInteraction(interaction);
        return;
    }
    
    // Handle ticket button interactions
    if (interaction.customId === 'ticket_claim' || interaction.customId === 'ticket_close') {
        const { handleTicketInteraction } = require('./commands/moderation/ticket');
        await handleTicketInteraction(interaction);
        return;
    }
    
    // Handle voice channel button interactions
    if (interaction.customId.startsWith('voice_')) {
        await handleVoiceInteraction(interaction);
        return;
    }
});

// Auto-leave any server where the owner is not a member
client.on('guildCreate', async (guild) => {
    try {
        // Fetch the owner's member object in this guild
        const ownerMember = await guild.members.fetch(OWNER_ID).catch(() => null);
        
        if (!ownerMember) {
            // Owner is not a member of this guild, leave it
            await guild.leave();
            console.log(`Left guild ${guild.name} (${guild.id}) because the owner is not a member.`);
        } else {
            console.log(`Joined guild where owner is a member: ${guild.name} (${guild.id})`);
        }
    } catch (error) {
        console.error('Error processing guildCreate:', error);
    }
});

const { handleRoleMenuInteraction } = require('./creation/role-menu');
const { handleRulesMenuInteraction } = require('./creation/rules-menu');
const { handleColorMenuInteraction } = require('./creation/setup-color-roles');
client.on('interactionCreate', async interaction => {
    if (interaction.isStringSelectMenu()) {
        // Handle color select menu first, then role menu
        await handleColorMenuInteraction(interaction);
        await handleRoleMenuInteraction(interaction);
    }
    if (interaction.isButton()) {
        await handleRulesMenuInteraction(interaction);
    }
});

const { handleMemberJoin, handleMemberLeave, handleMemberKickBan } = require('./creation/welcome');
client.on('guildMemberAdd', async (member) => {
    await handleMemberJoin(member);
});
client.on('guildMemberRemove', async (member) => {
    await handleMemberLeave(member);
    // Optionally: Detect kicks here in the future
});

// Voice channel auto-deletion system
client.on('voiceStateUpdate', async (oldState, newState) => {
    const fs = require('fs');
    const path = require('path');
    const { ChannelType, PermissionFlagsBits } = require('discord.js');
    
    try {
        // Paths for data
        const voiceDataPath = path.join(__dirname, 'data', 'voice-channels.json');
        const configPath = path.join(__dirname, 'data', 'voice-config.json');

        // Ensure voice data exists
        let voiceData = {};
        if (fs.existsSync(voiceDataPath)) {
            try { voiceData = JSON.parse(fs.readFileSync(voiceDataPath, 'utf8')) || {}; } catch { voiceData = {}; }
        }

        // Auto-create on lobby join
        if (newState.channel && oldState.channel?.id !== newState.channel.id) {
            // Load lobby config if present
            let guildConfig = null;
            if (fs.existsSync(configPath)) {
                try {
                    const all = JSON.parse(fs.readFileSync(configPath, 'utf8')) || {};
                    guildConfig = all[newState.guild.id] || null;
                } catch { guildConfig = null; }
            }

            const lobbyId = guildConfig?.lobbyChannelId;
            if (lobbyId && newState.channel.id === lobbyId) {
                const member = newState.member;

                // Prevent duplicates: if member already owns a temp channel, move them there
                const existingChannel = newState.guild.channels.cache.find(ch => 
                    ch.type === ChannelType.GuildVoice && voiceData[ch.id] === member.id
                );
                if (existingChannel) {
                    try { await member.voice.setChannel(existingChannel); } catch (e) { /* ignore move errors */ }
                    return;
                }

                // Choose parent category: prefer configured allowed category, else lobby's parent
                const allowedCategoryId = guildConfig?.categoryId || newState.channel.parent?.id || null;
                const parent = allowedCategoryId ? newState.guild.channels.cache.get(allowedCategoryId) : null;

                try {
                    const newChannel = await newState.guild.channels.create({
                        name: `${member.displayName}'s Channel`,
                        type: ChannelType.GuildVoice,
                        parent: parent || null,
                        userLimit: 0,
                        permissionOverwrites: [
                            {
                                id: member.id,
                                allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers]
                            }
                        ]
                    });

                    // Move to top of category if possible
                    if (newChannel.parent) {
                        try {
                            const categoryChannels = newChannel.parent.children.cache
                                .filter(ch => ch.type === ChannelType.GuildVoice)
                                .sort((a, b) => a.position - b.position);
                            const firstPos = categoryChannels.first()?.position || 0;
                            await newChannel.setPosition(firstPos);
                        } catch {/* ignore position errors */}
                    }

                    // Track ownership
                    voiceData[newChannel.id] = member.id;
                    fs.writeFileSync(voiceDataPath, JSON.stringify(voiceData, null, 2));

                    // Move member to the new channel
                    try { await member.voice.setChannel(newChannel); } catch (e) { /* ignore */ }
                } catch (e) {
                    console.error('Error auto-creating lobby voice channel:', e);
                }
            }
        }

        // Check if someone left a voice channel -> cleanup temp if empty
        if (oldState.channel && oldState.channel !== newState.channel) {
            const channelId = oldState.channel.id;
            if (voiceData[channelId]) {
                setTimeout(async () => {
                    try {
                        const channel = await oldState.guild.channels.fetch(channelId);
                        if (channel && channel.members.size === 0) {
                            try {
                                await channel.delete('Temporary voice channel auto-delete: empty');
                                delete voiceData[channelId];
                                fs.writeFileSync(voiceDataPath, JSON.stringify(voiceData, null, 2));
                                console.log(`🗑️ Auto-deleted empty temporary voice channel: ${channel.name}`);
                            } catch (error) {
                                console.error('Error auto-deleting voice channel:', error);
                            }
                        }
                    } catch (error) {
                        if (error.code !== 10003) { // Unknown Channel
                            console.error('Error checking channel for auto-delete:', error);
                        }
                    }
                }, 1000);
            }
        }
    } catch (error) {
        console.error('Error in voice state update handler:', error);
    }
});

// Import auto moderation
const { handleAutoModeration } = require('./moderation/automod');

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Run auto moderation first
    await handleAutoModeration(message);
    // --- Meowlock Intercept ---
    const fs = require('fs');
    const path = require('path');
    const meowlockPath = path.join(__dirname, 'data', 'meowlock.json');
    const guildId = message.guild?.id;
    if (!guildId) return; // Only run in guilds
    let allLocks = {};
    if (fs.existsSync(meowlockPath)) {
        try {
            const raw = fs.readFileSync(meowlockPath, 'utf8');
            allLocks = JSON.parse(raw || '{}');
        } catch {
            allLocks = {};
        }
    }
    const locked = Array.isArray(allLocks[guildId]) ? allLocks[guildId] : [];
    const meowEntry = locked.find(entry => entry.id === message.author.id);
    if (meowEntry) {
        // Block GIFs for meowlocked users
        const hasGif = (
            // Attachments: check for .gif extension
            message.attachments.some(att => att.url && att.url.toLowerCase().endsWith('.gif')) ||
            // Embeds: check for GIF URLs in embeds
            message.embeds.some(embed => (embed.url && embed.url.toLowerCase().endsWith('.gif')) || (embed.image && embed.image.url && embed.image.url.toLowerCase().endsWith('.gif'))) ||
            // Direct links in message content
            /https?:\/\/\S+\.gif(\?|$)/i.test(message.content)
        );
        if (hasGif) {
            await message.delete();
            const { sendAsFloofWebhook } = require('./utils/webhook-util');
            const gifBlockMessages = [
                "There's no getting around this! No GIFs while meowlocked!",
                "Nya~! Even GIFs can't escape the meowlock.",
                "Floof says: GIFs are forbidden for the meowlocked!",
                "No GIFs for you! The meowlock is absolute.",
                "Meowlocked users can't use GIFs, sorry!",
                "You can't outsmart the meowlock. No GIFs!"
            ];
            const blockMsg = gifBlockMessages[Math.floor(Math.random() * gifBlockMessages.length)];
            await sendAsFloofWebhook(message, { content: blockMsg });
            return;
        }
        // Catify message
        let catMsg = message.content;
        if (meowEntry.style === 'nya') {
            // Enhanced stutter words and kawaii interjections
            // Super intense meowlock
            const kawaii = ['uwu', 'owo', 'rawr', 'nyaa~', '>:3', 'x3', '(*^ω^*)', 'ฅ^•ﻌ•^ฅ', 'nya~', 'meow~', 'purr~'];
            // Strongly mess up the first word
            let wordsArr = catMsg.split(' ');
            if (wordsArr[0].length > 2) {
                // Always stutter and prepend kawaii interjection
                const kawaiiWord = kawaii[Math.floor(Math.random() * kawaii.length)];
                wordsArr[0] = kawaiiWord + ' ' + wordsArr[0][0] + '-' + wordsArr[0];
            }
            // Randomly stutter most other words
            for (let i = 1; i < wordsArr.length; i++) {
                if (wordsArr[i].length > 2 && Math.random() < 0.7) {
                    wordsArr[i] = wordsArr[i][0] + '-' + wordsArr[i];
                }
            }
            catMsg = wordsArr.join(' ');
            // Replace common words
            catMsg = catMsg.replace(/\b(is|are|am|was|were|the|my|your|you|i)\b/gi, 'nya');
            // Insert kawaii interjections randomly
            let words = catMsg.split(' ');
            for (let i = 1; i < words.length; i++) {
                if (Math.random() < 0.3) {
                    words.splice(i, 0, kawaii[Math.floor(Math.random() * kawaii.length)]);
                    i++;
                }
            }
            catMsg = words.join(' ');
            // Random ending
            const nyaEndings = [
                'nya~ uwu', 'nyaa! >w<', 'uwu~', '(*^ω^*) nya!', 'nyaa owo', 'nya~ :3', 'nyaa~', 'nyan~', 'nya! uwu', 'nyaaa~', 'nya~ ฅ^•ﻌ•^ฅ', 'nya! x3', 'nyaa! (*≧ω≦)', 'nya~ purr~', 'nya owo', 'nya~ uwu owo'
            ];
            catMsg = catMsg + ' ' + nyaEndings[Math.floor(Math.random() * nyaEndings.length)];
        } else if (meowEntry.style === 'meow') {
            // Enhanced meow stutter and interjections
            // Super intense meowlock
            const kawaii = ['uwu', 'owo', 'rawr', 'nyaa~', '>:3', 'x3', '(*^ω^*)', 'ฅ^•ﻌ•^ฅ', 'nya~', 'meow~', 'purr~'];
            // Strongly mess up the first word
            let wordsArr = catMsg.split(' ');
            if (wordsArr[0].length > 2) {
                // Always stutter and prepend kawaii interjection
                const kawaiiWord = kawaii[Math.floor(Math.random() * kawaii.length)];
                wordsArr[0] = kawaiiWord + ' ' + wordsArr[0][0] + '-meow' + wordsArr[0];
            }
            // Randomly stutter most other words
            for (let i = 1; i < wordsArr.length; i++) {
                if (wordsArr[i].length > 2 && Math.random() < 0.7) {
                    wordsArr[i] = wordsArr[i][0] + '-meow' + wordsArr[i];
                }
            }
            catMsg = wordsArr.join(' ');
            // Replace common words
            catMsg = catMsg.replace(/\b(is|are|am|was|were|the|my|your|you|i)\b/gi, 'meow');
            // Insert kawaii interjections randomly
            let words = catMsg.split(' ');
            for (let i = 1; i < words.length; i++) {
                if (Math.random() < 0.3) {
                    words.splice(i, 0, kawaii[Math.floor(Math.random() * kawaii.length)]);
                    i++;
                }
            }
            catMsg = words.join(' ');
            // Random ending
            const meowEndings = [
                'meow~', 'purr~', 'meow owo', 'rawr x3', 'meow! :3', 'meow uwu', 'meow! >w<', 'meow~ :3', 'meow! x3', 'meow~ uwu', 'meow! ฅ^•ﻌ•^ฅ', 'meow~ purr~', 'meow owo', 'meow~ uwu owo', 'meow nyan~'
            ];
            catMsg = 'Meow! ' + catMsg + ' ' + meowEndings[Math.floor(Math.random() * meowEndings.length)];
        }
        // Send via webhook
        let webhook;
        const webhooks = await message.channel.fetchWebhooks();
        webhook = webhooks.find(wh => wh.owner && wh.owner.id === message.client.user.id);
        if (!webhook) {
            webhook = await message.channel.createWebhook({
                name: 'Floof Webhook',
                avatar: message.client.user.displayAvatarURL()
            });
        }
        await webhook.send({
            username: message.member ? message.member.displayName : message.author.username,
            avatarURL: message.author.displayAvatarURL({ dynamic: true, size: 4096 }),
            content: catMsg
        });
        await message.delete();
        return;
    }
    // --- End Meowlock Intercept ---
    const { setAfk, showAfk, afkStore } = require('./commands/afk/afk');
    // 1. Auto-clear AFK if author is AFK
    if (afkStore && afkStore[message.author.id]) {
        console.log('DEBUG AFK CLEARED:', { user: message.author.id, afkStore });
        delete afkStore[message.author.id];
        await sendAsFloofWebhook(message, {
            embeds: [
                new (require('discord.js').EmbedBuilder)()
                    .setTitle('Welcome back!')
                    .setDescription('Your AFK status has been removed.')
                    .setColor(0x7289da)
            ]
        });
    }

    const content = message.content.trim();
    const lower = content.toLowerCase();

    // Only AFK command: %afk [reason]
    if (lower.startsWith('%afk')) {
        const reason = content.slice(4).trim();
        await setAfk(message, reason);
        return;
    }

    // If a mentioned user is AFK, show their AFK status
    if (message.mentions && message.mentions.users && message.mentions.users.size > 0) {
        for (const [, user] of message.mentions.users) {
            if (afkStore && afkStore[user.id]) {
                await showAfk(message, user);
                // Only show for the first AFK user mentioned
                break;
            }
        }
    }

    // 3. Notify if pinging or replying to an AFK user (embed style, no duplicates)
    const afkUsersToNotify = new Set();
    // Mentions
    if (message.mentions.users.size > 0) {
        for (const [, user] of message.mentions.users) {
            afkUsersToNotify.add(user.id);
        }
    }
    // Reply check
    if (message.reference && message.reference.messageId) {
        try {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
            if (repliedMsg && repliedMsg.author && !afkUsersToNotify.has(repliedMsg.author.id)) {
                afkUsersToNotify.add(repliedMsg.author.id);
            }
        } catch (e) { /* ignore */ }
    }
    if (afkUsersToNotify.size > 0) {
        
        for (const userId of afkUsersToNotify) {
            const user = await message.client.users.fetch(userId).catch(() => null);
            if (user) showAfk(message, user);
        }
    }
    
    // Bump sticky message (if configured for this channel)
    try {
        const { bumpStickyIfNeeded } = require('./moderation/sticky-manager');
        await bumpStickyIfNeeded(message);
    } catch (e) {
        console.error('Sticky bump err:', e);
    }
    // (AI conversational handler removed)
    
    // Check if message starts with command prefix (% or custom prefix)
    
    function getPrefixConfig() {
        const configPath = path.join(__dirname, 'data', 'prefix-config.json');
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        return {};
    }
    
    // Check for custom prefix first
    let usedPrefix = '%';
    let hasValidPrefix = message.content.startsWith('%');
    
    if (!hasValidPrefix && message.guild) {
        const prefixConfig = getPrefixConfig();
        const guildConfig = prefixConfig[message.guild.id];
        
        if (guildConfig && guildConfig[message.author.id]) {
            const customPrefix = guildConfig[message.author.id].prefix;
            if (message.content.startsWith(customPrefix)) {
                usedPrefix = customPrefix;
                hasValidPrefix = true;
            }
        }
    }
    
    if (!hasValidPrefix) return;
    
    // Handle AFK command specially (since it has complex logic)
    if (message.content.startsWith(usedPrefix + 'afk')) {
        const args = message.content.slice(usedPrefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        
        if (message.mentions.users.size > 0) {
            // Show AFK for mentioned user
            const user = message.mentions.users.first();
            showAfk(message, user);
        } else {
            // Set AFK for self
            setAfk(message, args.join(' '));
        }
        return;
    }
    
    // Handle all other commands through the command handler
    const commandHandled = await commandHandler.handleCommand(message, usedPrefix);
    if (commandHandled) {
        try { incrementCommandUsage(); } catch (e) { console.error('incrementCommandUsage failed:', e); }
        return;
    }
    
    // Public commands available to everyone
    const args = message.content.slice(usedPrefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    
    // Gambling menu - available to everyone
    if (commandName === 'floofgambling') {
        await ownerCommands.gamblingMenu(message);
        return;
    }
    
    // Legacy owner commands (now available to moderators+)
    const hasModPerms = message.member?.permissions.has('ModerateMembers') || isOwner(message.author.id);
    
    if (hasModPerms) {
        if (commandName === 'floof') {
            await ownerCommands.funMenu(message);
            return;
        }
        if (commandName === 'floofmod') {
            await ownerCommands.modMenu(message);
            return;
        }
        if (commandName === 'floofroles') {
            await ownerCommands.roleMenu(message);
            return;
        }
        if (commandName === 'flooffun' || commandName === 'floof') {
            await ownerCommands.funMenu(message);
            return;
        }
        if (commandName === 'floofutil') {
            await ownerCommands.utilityMenu(message);
            return;
        }
        // floofy command is now handled by the command handler (owner-commands/floofy.js)
        // Removed hardcoded override to allow proper command routing
        if (commandName === 'av' || commandName === 'avatar') {
            const userArg = args[0];
            await ownerCommands.avatar(message, userArg);
            return;
        }
        // Meowlock commands are registered as owner-only via the command handler.
        // Legacy moderator access removed to enforce strict owner-only usage.
        if (commandName === 'leaveservers') {
            const leaveCommand = commandHandler.commands.get('leaveservers');
            if (leaveCommand) {
                await leaveCommand.execute(message);
            } else {
                console.error('Leaveservers command not found in command handler');
                await message.reply('Error: Leaveservers command not properly loaded.');
            }
            return;
        }
        if (commandName === 'servers') {
            await ownerCommands.servers(message);
            return;
        }
    }
    
    // If command wasn't handled by new system, it might be a legacy command
    // or an unknown command - no need to do anything else
});

// In-memory storage for deleted messages per channel (stores up to 10 messages per channel)
const deletedMessages = new Map();
client.deletedMessages = deletedMessages;

client.on('messageDelete', (message) => {
    // Only store if the message is not from a bot and has content
    if (!message.author || message.author.bot) return;
    if (!message.content && message.attachments.size === 0) return;
    
    const channelId = message.channel.id;
    
    // Initialize array for this channel if it doesn't exist
    if (!deletedMessages.has(channelId)) {
        deletedMessages.set(channelId, []);
    }
    
    const channelDeleted = deletedMessages.get(channelId);
    
    // Add new deleted message to the beginning of the array
    channelDeleted.unshift({
        content: message.content || '',
        authorTag: message.author.tag,
        authorId: message.author.id,
        authorAvatar: message.author.displayAvatarURL({ dynamic: true }),
        channelId: message.channel.id,
        deletedAt: new Date(),
        attachments: message.attachments.map(att => ({ url: att.url, name: att.name }))
    });
    
    // Keep only the last 10 deleted messages per channel
    if (channelDeleted.length > 10) {
        channelDeleted.splice(10);
    }
});

// Auto-grab invite links when joining new servers
client.on('guildCreate', async (guild) => {
    console.log(`🏰 Joined new server: ${guild.name} (${guild.memberCount} members)`);
    
    try {
        // Import the floofy command functions for invite management
        const floofyCommand = require('./owner-commands/floofy.js');
        
        // Try to create an invite link for the new server
        const invite = await floofyCommand.createInviteForGuild(guild);
        
        if (invite) {
            await floofyCommand.storeInvite(guild.id, invite);
            console.log(`✅ Auto-grabbed invite for ${guild.name}: ${invite.url}`);
            
            // Notify owner about new server join
            try {
                const owner = await client.users.fetch(OWNER_ID);
                if (owner) {
                    const { EmbedBuilder } = require('discord.js');
                    const embed = new EmbedBuilder()
                        .setTitle('🏰 Joined New Server!')
                        .setDescription(`Floof has joined **${guild.name}**`)
                        .setColor(0x00FF7F)
                        .addFields(
                            {
                                name: '📊 Server Info',
                                value: [
                                    `**Members:** ${guild.memberCount}`,
                                    `**Owner:** <@${guild.ownerId}>`,
                                    `**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`
                                ].join('\n'),
                                inline: true
                            },
                            {
                                name: '🔗 Auto-Generated Invite',
                                value: invite.url,
                                inline: false
                            }
                        )
                        .setThumbnail(guild.iconURL({ dynamic: true }))
                        .setFooter({ text: `Server ID: ${guild.id}` })
                        .setTimestamp();
                    
                    await owner.send({ embeds: [embed] });
                }
            } catch (error) {
                console.error('Failed to notify owner about new server:', error);
            }
        } else {
            console.log(`⚠️ Could not create invite for ${guild.name} - insufficient permissions`);
        }
    } catch (error) {
        console.error(`Error auto-grabbing invite for ${guild.name}:`, error);
    }
});

// Log when leaving servers
client.on('guildDelete', (guild) => {
    console.log(`👋 Left server: ${guild.name} (${guild.memberCount} members)`);
    
    // Optionally notify owner about server leaves
    try {
        client.users.fetch(OWNER_ID).then(owner => {
            if (owner) {
                owner.send(`👋 Floof left server: **${guild.name}** (${guild.memberCount} members)`);
            }
        }).catch(console.error);
    } catch (error) {
        console.error('Failed to notify owner about server leave:', error);
    }
});

function getDeletedMessages(channelId) {
    return deletedMessages.get(channelId) || [];
}

function clearDeletedMessages(channelId) {
    if (channelId) {
        deletedMessages.delete(channelId);
    } else {
        deletedMessages.clear();
    }
}

async function handleVoiceInteraction(interaction) {
    const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
    const fs = require('fs');
    const path = require('path');
    
    try {
        const member = interaction.member;
        const action = interaction.customId.replace('voice_', '');
        
        // Debug logging
        console.log(`Voice interaction: ${action} by ${member.displayName} (${member.id})`);
        
        // Load voice channel owners data
        const voiceDataPath = path.join(__dirname, 'data', 'voice-channels.json');
        let voiceData = {};
        if (fs.existsSync(voiceDataPath)) {
            voiceData = JSON.parse(fs.readFileSync(voiceDataPath, 'utf8'));
        }
        
        // Handle create action separately (doesn't require being in a voice channel)
        if (action === 'create') {
            // Check voice channel configuration
            const configPath = path.join(__dirname, 'data', 'voice-config.json');
            let allowedCategory = null;
            
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                const guildConfig = config[interaction.guild.id];
                if (guildConfig) {
                    allowedCategory = interaction.guild.channels.cache.get(guildConfig.categoryId);
                    if (!allowedCategory) {
                        return await interaction.reply({
                            content: `❌ Voice channel configuration error! The configured category no longer exists. Ask an admin to run \`%vcconfig clear\`.`,
                            flags: 64 // MessageFlags.Ephemeral
                        });
                    }
                }
            }
            
            // Check if user is in the correct category (if restriction is set)
            if (allowedCategory && member.voice.channel && member.voice.channel.parent?.id !== allowedCategory.id) {
                return await interaction.reply({
                    content: `❌ You can only create voice channels in the **${allowedCategory.name}** category! Join a voice channel there first.`,
                    flags: 64 // MessageFlags.Ephemeral
                });
            }
            
            // Check if user already has a temporary voice channel
            const existingChannel = interaction.guild.channels.cache.find(ch => 
                ch.type === ChannelType.GuildVoice && voiceData[ch.id] === member.id
            );
            
            if (existingChannel) {
                return await interaction.reply({
                    content: `❌ You already have a temporary voice channel: **${existingChannel.name}**`,
                    flags: 64 // MessageFlags.Ephemeral
                });
            }
            
            // Create new temporary voice channel
            try {
                const newChannel = await interaction.guild.channels.create({
                    name: `${member.displayName}'s Channel`,
                    type: ChannelType.GuildVoice,
                    parent: allowedCategory || member.voice.channel?.parent || null,
                    userLimit: 0, // Start with unlimited
                    permissionOverwrites: [
                        {
                            id: member.id,
                            allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers]
                        }
                    ]
                });

                // Move channel to top of category
                if (newChannel.parent) {
                    try {
                        const categoryChannels = newChannel.parent.children.cache
                            .filter(ch => ch.type === ChannelType.GuildVoice)
                            .sort((a, b) => a.position - b.position);
                        const firstPos = categoryChannels.first()?.position || 0;
                        await newChannel.setPosition(firstPos);
                    } catch {/* ignore position errors */}
                }
                
                // Store channel owner
                voiceData[newChannel.id] = member.id;
                fs.writeFileSync(voiceDataPath, JSON.stringify(voiceData, null, 2));
                
                // Move user to new channel (only if they're currently in a voice channel)
                if (member.voice.channel) {
                    try {
                        await member.voice.setChannel(newChannel);
                    } catch (error) {
                        console.error('Error moving user to new voice channel:', error);
                        // Still notify them about the channel creation
                        return await interaction.reply({
                            content: `✅ Created your temporary voice channel: **${newChannel.name}**\n⚠️ Couldn't move you automatically - please join manually.\nYou have full control over this channel and it will auto-delete when empty.`,
                            flags: 64 // MessageFlags.Ephemeral
                        });
                    }
                } else {
                    // User not in voice, just create the channel
                    return await interaction.reply({
                        content: `✅ Created your temporary voice channel: **${newChannel.name}**\n💡 Join a voice channel first, then click Create to be moved automatically.\nYou have full control over this channel and it will auto-delete when empty.`,
                        flags: 64 // MessageFlags.Ephemeral
                    });
                }
                
                // If we get here, user was successfully moved
                return await interaction.reply({
                    content: `✅ Created your temporary voice channel: **${newChannel.name}**\n🎤 You've been moved to your new channel!\nYou have full control over this channel and it will auto-delete when empty.`,
                    flags: 64 // MessageFlags.Ephemeral
                });
                
            } catch (error) {
                console.error('Error creating voice channel:', error);
                return await interaction.reply({
                    content: `❌ Failed to create voice channel. Please check bot permissions or try again.`,
                    flags: 64 // MessageFlags.Ephemeral
                });
            }
        }
        
        // For all other actions, user must be in a voice channel
        const voiceChannel = member.voice.channel;
        if (!voiceChannel) {
            return await interaction.reply({
                content: '❌ You must be in a voice channel to use voice controls!',
                flags: 64 // MessageFlags.Ephemeral
            });
        }
        
        // Reload voice data to ensure we have the latest ownership info
        if (fs.existsSync(voiceDataPath)) {
            voiceData = JSON.parse(fs.readFileSync(voiceDataPath, 'utf8'));
        }
        
        // Check if user is the owner of this temporary voice channel
        const isChannelOwner = voiceData[voiceChannel.id] === member.id;
        const hasManagePermission = member.permissions.has(PermissionFlagsBits.ManageChannels);
        
        if (!isChannelOwner && !hasManagePermission) {
            return await interaction.reply({
                content: '❌ Only the channel owner or users with Manage Channels permission can use voice controls!',
                flags: 64 // MessageFlags.Ephemeral
            });
        }
        
        switch (action) {
            case 'lock':
                await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                    Connect: false
                });
                // Fetch fresh channel data to get updated name
                const freshChannel = await interaction.guild.channels.fetch(voiceChannel.id);
                await interaction.reply({
                    content: `🔒 **${freshChannel.name}** has been locked!`,
                    flags: 64 // MessageFlags.Ephemeral
                });
                break;
                
            case 'unlock':
                await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                    Connect: null
                });
                const freshChannel2 = await interaction.guild.channels.fetch(voiceChannel.id);
                await interaction.reply({
                    content: `🔓 **${freshChannel2.name}** has been unlocked!`,
                    flags: 64 // MessageFlags.Ephemeral
                });
                break;
                
            case 'ghost':
                await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                    ViewChannel: false
                });
                const freshChannel3 = await interaction.guild.channels.fetch(voiceChannel.id);
                await interaction.reply({
                    content: `👁️ **${freshChannel3.name}** is now hidden!`,
                    flags: 64 // MessageFlags.Ephemeral
                });
                break;
                
            case 'reveal':
                await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                    ViewChannel: null
                });
                const freshChannel4 = await interaction.guild.channels.fetch(voiceChannel.id);
                await interaction.reply({
                    content: `👻 **${freshChannel4.name}** is now visible!`,
                    flags: 64 // MessageFlags.Ephemeral
                });
                break;
                
            case 'increase':
                const currentLimit = voiceChannel.userLimit;
                const newLimit = currentLimit === 0 ? 2 : Math.min(currentLimit + 1, 99);
                await voiceChannel.setUserLimit(newLimit);
                const freshChannel5 = await interaction.guild.channels.fetch(voiceChannel.id);
                await interaction.reply({
                    content: `➕ **${freshChannel5.name}** user limit increased to ${newLimit}!`,
                    flags: 64 // MessageFlags.Ephemeral
                });
                break;
                
            case 'decrease':
                const currentLimit2 = voiceChannel.userLimit;
                const newLimit2 = currentLimit2 <= 1 ? 0 : currentLimit2 - 1;
                await voiceChannel.setUserLimit(newLimit2);
                const freshChannel6 = await interaction.guild.channels.fetch(voiceChannel.id);
                await interaction.reply({
                    content: `➖ **${freshChannel6.name}** user limit ${newLimit2 === 0 ? 'removed' : `decreased to ${newLimit2}`}!`,
                    flags: 64 // MessageFlags.Ephemeral
                });
                break;
                
            case 'view':
                const freshChannel7 = await interaction.guild.channels.fetch(voiceChannel.id);
                const embed = new EmbedBuilder()
                    .setTitle(`ℹ️ ${freshChannel7.name} Information`)
                    .setColor('#7289DA')
                    .addFields(
                        {
                            name: '👥 Members',
                            value: voiceChannel.members.size > 0 ? 
                                voiceChannel.members.map(m => m.displayName).join(', ') : 
                                'No members',
                            inline: true
                        },
                        {
                            name: '🔢 User Limit',
                            value: voiceChannel.userLimit === 0 ? 'Unlimited' : voiceChannel.userLimit.toString(),
                            inline: true
                        },
                        {
                            name: '🔒 Permissions',
                            value: [
                                voiceChannel.permissionOverwrites.cache.get(interaction.guild.roles.everyone.id)?.deny.has(PermissionFlagsBits.Connect) ? '🔒 Locked' : '🔓 Unlocked',
                                voiceChannel.permissionOverwrites.cache.get(interaction.guild.roles.everyone.id)?.deny.has(PermissionFlagsBits.ViewChannel) ? '👁️ Hidden' : '👻 Visible'
                            ].join('\n'),
                            inline: true
                        }
                    )
                    .setTimestamp();
                
                await interaction.reply({
                    embeds: [embed],
                    flags: 64 // MessageFlags.Ephemeral
                });
                break;
                
            case 'disconnect':
                if (voiceChannel.members.size === 0) {
                    return await interaction.reply({
                        content: '❌ No members to disconnect!',
                        flags: 64 // MessageFlags.Ephemeral
                    });
                }
                
                const disconnected = [];
                for (const [, member] of voiceChannel.members) {
                    if (member.id !== interaction.user.id) {
                        try {
                            await member.voice.disconnect();
                            disconnected.push(member.displayName);
                        } catch (error) {
                            console.error(`Failed to disconnect ${member.displayName}:`, error);
                        }
                    }
                }
                
                await interaction.reply({
                    content: disconnected.length > 0 ? 
                        `🔗 Disconnected: ${disconnected.join(', ')}` : 
                        '❌ No members could be disconnected!',
                    flags: 64 // MessageFlags.Ephemeral
                });
                break;
                
            case 'start':
                await interaction.reply({
                    content: '⭐ Activity feature coming soon! This will allow you to start Discord activities in your voice channel.',
                    flags: 64 // MessageFlags.Ephemeral
                });
                break;
                
            default:
                await interaction.reply({
                    content: '❌ Unknown voice command!',
                    flags: 64 // MessageFlags.Ephemeral
                });
        }
        
    } catch (error) {
        console.error('Voice interaction error:', error);
        await interaction.reply({
            content: '❌ Something went wrong with the voice control!',
            flags: 64 // MessageFlags.Ephemeral
        });
    }
}

async function handleSnipeInteraction(interaction) {
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    
    const parts = interaction.customId.split('_');
    const action = parts[1]; // prev, next, info
    const channelId = parts[2];
    const currentIndex = parseInt(parts[3]) || 0;
    
    const channelDeleted = getDeletedMessages(channelId);
    
    if (channelDeleted.length === 0) {
        return interaction.reply({ content: 'No deleted messages found.', ephemeral: true });
    }
    
    if (interaction.customId.startsWith('snipe_')) {
        // Handle single message navigation
        let newIndex = currentIndex;
        
        if (action === 'prev' && currentIndex > 0) {
            newIndex = currentIndex - 1;
        } else if (action === 'next' && currentIndex < channelDeleted.length - 1) {
            newIndex = currentIndex + 1;
        } else if (action === 'info') {
            return interaction.reply({ content: `Showing message ${currentIndex + 1} of ${channelDeleted.length}`, ephemeral: true });
        }
        
        const deletedMsg = channelDeleted[newIndex];
        const embed = new EmbedBuilder()
            .setAuthor({ 
                name: deletedMsg.authorTag, 
                iconURL: deletedMsg.authorAvatar 
            })
            .setDescription(deletedMsg.content || '*No text content*')
            .setColor(0xff6b6b)
            .setFooter({ text: `Deleted ${deletedMsg.deletedAt.toLocaleString()}` })
            .setTimestamp();
        
        if (deletedMsg.attachments && deletedMsg.attachments.length > 0) {
            const attachmentText = deletedMsg.attachments.map(att => `[${att.name}](${att.url})`).join('\n');
            embed.addFields({ name: 'Attachments', value: attachmentText });
        }
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`snipe_prev_${channelId}_${newIndex}`)
                    .setLabel('◀ Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(newIndex === 0),
                new ButtonBuilder()
                    .setCustomId(`snipe_next_${channelId}_${newIndex}`)
                    .setLabel('Next ▶')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(newIndex === channelDeleted.length - 1),
                new ButtonBuilder()
                    .setCustomId(`snipe_info_${channelId}`)
                    .setLabel(`${newIndex + 1}/${channelDeleted.length}`)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true)
            );
        
        await interaction.update({ embeds: [embed], components: [row] });
        
    } else if (interaction.customId.startsWith('bulk_')) {
        // Handle bulk message navigation (5 messages at a time)
        let newIndex = currentIndex;
        
        if (action === 'prev' && currentIndex > 0) {
            newIndex = Math.max(0, currentIndex - 5);
        } else if (action === 'next' && currentIndex + 5 < channelDeleted.length) {
            newIndex = currentIndex + 5;
        } else if (action === 'info') {
            const endIndex = Math.min(currentIndex + 5, channelDeleted.length);
            return interaction.reply({ content: `Showing messages ${currentIndex + 1}-${endIndex} of ${channelDeleted.length}`, ephemeral: true });
        }
        
        const messagesToShow = Math.min(5, channelDeleted.length - newIndex);
        const embed = new EmbedBuilder()
            .setTitle(`🗑️ Deleted Messages ${newIndex + 1}-${newIndex + messagesToShow}`)
            .setColor(0xff6b6b)
            .setFooter({ text: `${channelDeleted.length} total deleted messages stored` })
            .setTimestamp();
        
        for (let i = 0; i < messagesToShow; i++) {
            const deletedMsg = channelDeleted[newIndex + i];
            let fieldValue = deletedMsg.content || '*No text content*';
            
            if (deletedMsg.attachments && deletedMsg.attachments.length > 0) {
                const attachmentText = deletedMsg.attachments.map(att => `[${att.name}](${att.url})`).join(', ');
                fieldValue += `\n📎 ${attachmentText}`;
            }
            
            if (fieldValue.length > 1000) {
                fieldValue = fieldValue.substring(0, 997) + '...';
            }
            
            embed.addFields({
                name: `${newIndex + i + 1}. ${deletedMsg.authorTag} - ${deletedMsg.deletedAt.toLocaleString()}`,
                value: fieldValue,
                inline: false
            });
        }
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`bulk_prev_${channelId}_${newIndex}`)
                    .setLabel('◀ Previous 5')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(newIndex === 0),
                new ButtonBuilder()
                    .setCustomId(`bulk_next_${channelId}_${newIndex}`)
                    .setLabel('Next 5 ▶')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(newIndex + 5 >= channelDeleted.length),
                new ButtonBuilder()
                    .setCustomId(`bulk_info_${channelId}`)
                    .setLabel(`${newIndex + 1}-${newIndex + messagesToShow}/${channelDeleted.length}`)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true)
            );
        
        await interaction.update({ embeds: [embed], components: [row] });
    }
}

module.exports.getDeletedMessages = getDeletedMessages;
module.exports.clearDeletedMessages = clearDeletedMessages;

// Backward-compatible token resolution
const BOT_TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN || '';

(async () => {
    await ensureAiReady();
    if (!BOT_TOKEN) {
        console.error('❌ No Discord token found. Set DISCORD_TOKEN (preferred) or DISCORD_BOT_TOKEN in your environment or .env file.');
        process.exit(1);
    }
    try {
        await client.login(BOT_TOKEN);
    } catch (err) {
        console.error('❌ Failed to login. Check your DISCORD_TOKEN / DISCORD_BOT_TOKEN value.', err);
        process.exit(1);
    }
})();