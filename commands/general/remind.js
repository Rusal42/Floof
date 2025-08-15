const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const fs = require('fs');
const path = require('path');

const remindersPath = path.join(__dirname, '../../reminders.json');

function loadReminders() {
    if (!fs.existsSync(remindersPath)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(remindersPath, 'utf8'));
    } catch (error) {
        console.error('Error loading reminders:', error);
        return {};
    }
}

function saveReminders(reminders) {
    try {
        fs.writeFileSync(remindersPath, JSON.stringify(reminders, null, 2));
    } catch (error) {
        console.error('Error saving reminders:', error);
    }
}

function parseTime(timeStr) {
    const timeRegex = /^(\d+)([smhd])$/i;
    const match = timeStr.match(timeRegex);
    
    if (!match) return null;
    
    const amount = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    const multipliers = {
        's': 1000,
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000
    };
    
    return amount * multipliers[unit];
}

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

module.exports = {
    name: 'remind',
    aliases: ['reminder', 'remindme'],
    description: 'Set personal and server reminders',
    usage: '%remind <time> <message> OR %remind list/clear',
    category: 'general',
    permissions: [],
    cooldown: 3,

    async execute(message, args) {
        if (!args.length) {
            return this.showHelp(message);
        }

        const subcommand = args[0].toLowerCase();

        switch (subcommand) {
            case 'list':
                return this.listReminders(message);
            case 'clear':
            case 'delete':
                return this.clearReminder(message, args.slice(1));
            case 'server':
                return this.serverReminder(message, args.slice(1));
            default:
                return this.createReminder(message, args);
        }
    },

    async showHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('⏰ Reminder System')
            .setDescription('Set personal and server-wide reminders')
            .setColor(0x00BFFF)
            .addFields(
                {
                    name: '⏰ **Personal Reminders**',
                    value: [
                        '`%remind <time> <message>` - Set personal reminder',
                        '`%remind 1h Take a break` - Remind in 1 hour',
                        '`%remind 30m Check the oven` - Remind in 30 minutes',
                        '`%remind 2d Pay bills` - Remind in 2 days'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🌐 **Server Reminders**',
                    value: [
                        '`%remind server <time> <message>` - Server-wide reminder',
                        '`%remind server 1h Meeting in voice chat` - Notify everyone'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '📋 **Management**',
                    value: [
                        '`%remind list` - List your active reminders',
                        '`%remind clear <id>` - Cancel a reminder'
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: 'Time format: 1s, 5m, 2h, 3d (seconds, minutes, hours, days)' });

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async createReminder(message, args) {
        if (args.length < 2) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Usage: `%remind <time> <message>`\nExample: `%remind 1h Take a break`')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const timeStr = args[0];
        const reminderText = args.slice(1).join(' ');
        const delay = parseTime(timeStr);

        if (!delay) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Invalid time format. Use: 1s, 5m, 2h, 3d')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        if (delay > 30 * 24 * 60 * 60 * 1000) { // 30 days max
            const embed = new EmbedBuilder()
                .setDescription('❌ Maximum reminder time is 30 days.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const reminders = loadReminders();
        const reminderId = Date.now().toString();
        const triggerTime = Date.now() + delay;

        if (!reminders[message.guild.id]) {
            reminders[message.guild.id] = {};
        }

        reminders[message.guild.id][reminderId] = {
            userId: message.author.id,
            channelId: message.channel.id,
            message: reminderText,
            triggerTime,
            isServerWide: false,
            createdAt: Date.now()
        };

        saveReminders(reminders);

        // Set timeout
        setTimeout(() => {
            this.triggerReminder(reminderId, message.guild.id);
        }, delay);

        const embed = new EmbedBuilder()
            .setTitle('✅ Reminder Set')
            .setDescription(`I'll remind you about: **${reminderText}**`)
            .addFields({
                name: 'Details',
                value: [
                    `**Time:** ${formatTime(delay)}`,
                    `**When:** <t:${Math.floor(triggerTime / 1000)}:F>`,
                    `**ID:** ${reminderId}`
                ].join('\n')
            })
            .setColor(0x00FF00)
            .setTimestamp();

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async serverReminder(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            const embed = new EmbedBuilder()
                .setDescription('❌ You need `Manage Messages` permission for server reminders.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        if (args.length < 2) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Usage: `%remind server <time> <message>`')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const timeStr = args[0];
        const reminderText = args.slice(1).join(' ');
        const delay = parseTime(timeStr);

        if (!delay) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Invalid time format. Use: 1s, 5m, 2h, 3d')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const reminders = loadReminders();
        const reminderId = Date.now().toString();
        const triggerTime = Date.now() + delay;

        if (!reminders[message.guild.id]) {
            reminders[message.guild.id] = {};
        }

        reminders[message.guild.id][reminderId] = {
            userId: message.author.id,
            channelId: message.channel.id,
            message: reminderText,
            triggerTime,
            isServerWide: true,
            createdAt: Date.now()
        };

        saveReminders(reminders);

        // Set timeout
        setTimeout(() => {
            this.triggerReminder(reminderId, message.guild.id);
        }, delay);

        const embed = new EmbedBuilder()
            .setTitle('✅ Server Reminder Set')
            .setDescription(`Server-wide reminder: **${reminderText}**`)
            .addFields({
                name: 'Details',
                value: [
                    `**Time:** ${formatTime(delay)}`,
                    `**When:** <t:${Math.floor(triggerTime / 1000)}:F>`,
                    `**Set by:** ${message.author}`,
                    `**ID:** ${reminderId}`
                ].join('\n')
            })
            .setColor(0xFF69B4)
            .setTimestamp();

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async listReminders(message) {
        const reminders = loadReminders();
        const guildReminders = reminders[message.guild.id] || {};
        
        const userReminders = Object.entries(guildReminders)
            .filter(([, reminder]) => reminder.userId === message.author.id)
            .sort(([, a], [, b]) => a.triggerTime - b.triggerTime);

        if (userReminders.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('📭 You have no active reminders.')
                .setColor(0x7289DA);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const reminderList = userReminders.map(([id, reminder]) => {
            const timeLeft = reminder.triggerTime - Date.now();
            const timeLeftStr = timeLeft > 0 ? formatTime(timeLeft) : 'Overdue';
            const type = reminder.isServerWide ? '🌐 Server' : '👤 Personal';
            
            return `**${id}** - ${type}\n` +
                   `📝 ${reminder.message}\n` +
                   `⏰ ${timeLeftStr} (<t:${Math.floor(reminder.triggerTime / 1000)}:R>)`;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setTitle(`⏰ Your Active Reminders (${userReminders.length})`)
            .setDescription(reminderList)
            .setColor(0x00BFFF)
            .setFooter({ text: 'Use %remind clear <id> to cancel a reminder' });

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async clearReminder(message, args) {
        if (!args.length) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Usage: `%remind clear <reminder_id>`')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const reminderId = args[0];
        const reminders = loadReminders();
        const guildReminders = reminders[message.guild.id] || {};
        
        if (!guildReminders[reminderId]) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Reminder not found. Use `%remind list` to see your reminders.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const reminder = guildReminders[reminderId];
        
        // Check if user owns the reminder or has manage permissions for server reminders
        const canDelete = reminder.userId === message.author.id || 
                         (reminder.isServerWide && message.member.permissions.has(PermissionsBitField.Flags.ManageMessages));

        if (!canDelete) {
            const embed = new EmbedBuilder()
                .setDescription('❌ You can only delete your own reminders.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        delete guildReminders[reminderId];
        reminders[message.guild.id] = guildReminders;
        saveReminders(reminders);

        const embed = new EmbedBuilder()
            .setDescription(`✅ Reminder cancelled: **${reminder.message}**`)
            .setColor(0x00FF00);

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async triggerReminder(reminderId, guildId) {
        const reminders = loadReminders();
        const guildReminders = reminders[guildId] || {};
        const reminder = guildReminders[reminderId];

        if (!reminder) return; // Reminder was deleted

        try {
            const guild = global.client?.guilds.cache.get(guildId);
            if (!guild) return;

            const channel = guild.channels.cache.get(reminder.channelId);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setTitle('⏰ Reminder!')
                .setDescription(reminder.message)
                .setColor(0xFF69B4)
                .setTimestamp();

            if (reminder.isServerWide) {
                embed.setFooter({ text: `Server reminder set by ${guild.members.cache.get(reminder.userId)?.displayName || 'Unknown User'}` });
                await channel.send({ content: '@here', embeds: [embed] });
            } else {
                await channel.send({ content: `<@${reminder.userId}>`, embeds: [embed] });
            }

            // Remove the triggered reminder
            delete guildReminders[reminderId];
            reminders[guildId] = guildReminders;
            saveReminders(reminders);

        } catch (error) {
            console.error('Error triggering reminder:', error);
        }
    }
};

// Initialize reminders on bot startup
function initializeReminders(client) {
    global.client = client;
    
    const reminders = loadReminders();
    const now = Date.now();
    
    for (const [guildId, guildReminders] of Object.entries(reminders)) {
        for (const [reminderId, reminder] of Object.entries(guildReminders)) {
            const timeLeft = reminder.triggerTime - now;
            
            if (timeLeft <= 0) {
                // Trigger overdue reminders immediately
                setTimeout(() => {
                    module.exports.triggerReminder(reminderId, guildId);
                }, 1000);
            } else {
                // Schedule future reminders
                setTimeout(() => {
                    module.exports.triggerReminder(reminderId, guildId);
                }, timeLeft);
            }
        }
    }
}

module.exports.initializeReminders = initializeReminders;
