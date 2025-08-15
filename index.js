require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('./utils/webhook-util');
const CommandHandler = require('./handlers/CommandHandler');
const { isOwner, getPrimaryOwnerId } = require('./utils/owner-util');

// Set your Discord user ID here (now supports multiple owners)
const OWNER_ID = getPrimaryOwnerId();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers // Needed for welcome system
    ]
});

// Initialize command handler
const commandHandler = new CommandHandler(client);

// Load owner commands
const ownerCommands = require('./owner-commands/owner-commands');
const { ownerMenu, revive } = ownerCommands;
const nukeCommand = require('./owner-commands/nukeall');
const floofyCommand = require('./owner-commands/floofy');
const floofymCommand = require('./owner-commands/floofym');

// Register owner commands with the command handler
Object.entries({ ownerMenu, revive }).forEach(([name, execute]) => {
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
    
    // Set bot activity to show server invite
    client.user.setActivity('discord.gg/Acpx662Eyg', { 
        type: 3 // 3 = WATCHING
    });
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
client.on('guildBanAdd', async (ban) => {
    await handleMemberKickBan(ban.user, ban.guild, 'banned');
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
    const meowlockPath = path.join(__dirname, 'meowlock.json');
    const guildId = message.guild?.id;
    if (!guildId) return; // Only run in guilds
    let allLocks = {};
    if (fs.existsSync(meowlockPath)) allLocks = JSON.parse(fs.readFileSync(meowlockPath));
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
    
    // Check if message starts with command prefix
    if (!message.content.startsWith('%')) return;
    
    // Handle AFK command specially (since it has complex logic)
    if (message.content.startsWith('%afk')) {
        const args = message.content.slice(1).trim().split(/ +/);
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
    const commandHandled = await commandHandler.handleCommand(message);
    if (commandHandled) return;
    
    // Legacy owner commands (now available to moderators+)
    const hasModPerms = message.member?.permissions.has('ModerateMembers') || isOwner(message.author.id);
    
    if (hasModPerms) {
        const args = message.content.slice(1).trim().split(/\s+/);
        const commandName = args.shift().toLowerCase();
        
        if (commandName === 'floof') {
            await ownerCommands.funMenu(message);
            return;
        }
        if (commandName === 'floofmod') {
            await ownerCommands.modMenu(message);
            return;
        }
        if (commandName === 'floofgambling') {
            await ownerCommands.gamblingMenu(message);
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
        if (commandName === 'meowlock') {
            // Pass all arguments to the meowlock function
            await ownerCommands.meowlock(message, args);
            return;
        }
        if (commandName === 'meowunlock') {
            const userArg = args[0];
            await ownerCommands.meowunlock(message, userArg);
            return;
        }
        if (commandName === 'meowlockclear') {
            await ownerCommands.meowlockclear(message);
            return;
        }
        if (commandName === 'meowlocked') {
            await ownerCommands.meowlocked(message);
            return;
        }
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

client.login(process.env.DISCORD_BOT_TOKEN);