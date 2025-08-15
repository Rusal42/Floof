const { PermissionsBitField, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const fs = require('fs');
const path = require('path');

const analyticsPath = path.join(__dirname, '../../analytics-data.json');

function loadAnalytics() {
    if (!fs.existsSync(analyticsPath)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(analyticsPath, 'utf8'));
    } catch (error) {
        console.error('Error loading analytics:', error);
        return {};
    }
}

function saveAnalytics(data) {
    try {
        fs.writeFileSync(analyticsPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving analytics:', error);
    }
}

function getServerAnalytics(guildId) {
    const analytics = loadAnalytics();
    return analytics[guildId] || {
        memberJoins: [],
        memberLeaves: [],
        messageStats: {},
        commandUsage: {},
        channelActivity: {},
        dailyStats: {}
    };
}

function saveServerAnalytics(guildId, data) {
    const analytics = loadAnalytics();
    analytics[guildId] = data;
    saveAnalytics(analytics);
}

function getDateKey(date = new Date()) {
    return date.toISOString().split('T')[0];
}

function trackMemberJoin(guildId, userId) {
    const analytics = getServerAnalytics(guildId);
    analytics.memberJoins.push({
        userId,
        timestamp: Date.now(),
        date: getDateKey()
    });
    
    // Keep only last 1000 joins
    if (analytics.memberJoins.length > 1000) {
        analytics.memberJoins = analytics.memberJoins.slice(-1000);
    }
    
    saveServerAnalytics(guildId, analytics);
}

function trackMemberLeave(guildId, userId) {
    const analytics = getServerAnalytics(guildId);
    analytics.memberLeaves.push({
        userId,
        timestamp: Date.now(),
        date: getDateKey()
    });
    
    // Keep only last 1000 leaves
    if (analytics.memberLeaves.length > 1000) {
        analytics.memberLeaves = analytics.memberLeaves.slice(-1000);
    }
    
    saveServerAnalytics(guildId, analytics);
}

function trackMessage(guildId, channelId, userId) {
    const analytics = getServerAnalytics(guildId);
    const today = getDateKey();
    
    // Track daily stats
    if (!analytics.dailyStats[today]) {
        analytics.dailyStats[today] = { messages: 0, activeUsers: new Set() };
    }
    analytics.dailyStats[today].messages++;
    analytics.dailyStats[today].activeUsers.add(userId);
    
    // Convert Set to Array for JSON storage
    analytics.dailyStats[today].activeUsers = Array.from(analytics.dailyStats[today].activeUsers);
    
    // Track channel activity
    if (!analytics.channelActivity[channelId]) {
        analytics.channelActivity[channelId] = 0;
    }
    analytics.channelActivity[channelId]++;
    
    // Track user message count
    if (!analytics.messageStats[userId]) {
        analytics.messageStats[userId] = 0;
    }
    analytics.messageStats[userId]++;
    
    saveServerAnalytics(guildId, analytics);
}

function trackCommand(guildId, commandName, userId) {
    const analytics = getServerAnalytics(guildId);
    
    if (!analytics.commandUsage[commandName]) {
        analytics.commandUsage[commandName] = { count: 0, users: [] };
    }
    
    analytics.commandUsage[commandName].count++;
    if (!analytics.commandUsage[commandName].users.includes(userId)) {
        analytics.commandUsage[commandName].users.push(userId);
    }
    
    saveServerAnalytics(guildId, analytics);
}

module.exports = {
    name: 'analytics',
    aliases: ['stats', 'serverstat', 'serverstats'],
    description: 'View detailed server analytics and statistics',
    usage: '%analytics [members|messages|commands|channels|growth]',
    category: 'general',
    permissions: [PermissionsBitField.Flags.ManageGuild],
    cooldown: 10,

    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            const embed = new EmbedBuilder()
                .setDescription('❌ You need `Manage Server` permission to view analytics.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const type = args[0]?.toLowerCase() || 'overview';
        const analytics = getServerAnalytics(message.guild.id);

        switch (type) {
            case 'members':
            case 'member':
                return this.showMemberAnalytics(message, analytics);
            case 'messages':
            case 'message':
                return this.showMessageAnalytics(message, analytics);
            case 'commands':
            case 'command':
                return this.showCommandAnalytics(message, analytics);
            case 'channels':
            case 'channel':
                return this.showChannelAnalytics(message, analytics);
            case 'growth':
                return this.showGrowthAnalytics(message, analytics);
            default:
                return this.showOverview(message, analytics);
        }
    },

    async showOverview(message, analytics) {
        const guild = message.guild;
        const totalMessages = Object.values(analytics.messageStats).reduce((a, b) => a + b, 0);
        const totalCommands = Object.values(analytics.commandUsage).reduce((a, b) => a + b.count, 0);
        const recentJoins = analytics.memberJoins.filter(j => Date.now() - j.timestamp < 7 * 24 * 60 * 60 * 1000).length;
        const recentLeaves = analytics.memberLeaves.filter(l => Date.now() - l.timestamp < 7 * 24 * 60 * 60 * 1000).length;

        const embed = new EmbedBuilder()
            .setTitle(`📊 ${guild.name} Analytics Overview`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setColor(0x7289DA)
            .addFields(
                {
                    name: '👥 **Member Stats**',
                    value: [
                        `**Total Members:** ${guild.memberCount}`,
                        `**Joins (7d):** ${recentJoins}`,
                        `**Leaves (7d):** ${recentLeaves}`,
                        `**Net Growth:** ${recentJoins - recentLeaves}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '💬 **Activity Stats**',
                    value: [
                        `**Total Messages:** ${totalMessages.toLocaleString()}`,
                        `**Commands Used:** ${totalCommands.toLocaleString()}`,
                        `**Active Channels:** ${Object.keys(analytics.channelActivity).length}`,
                        `**Active Users:** ${Object.keys(analytics.messageStats).length}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '📈 **Quick Stats**',
                    value: [
                        `**Most Active Channel:** ${this.getMostActiveChannel(message.guild, analytics)}`,
                        `**Most Used Command:** ${this.getMostUsedCommand(analytics)}`,
                        `**Avg Daily Messages:** ${this.getAverageDailyMessages(analytics)}`,
                        `**Server Created:** ${guild.createdAt.toLocaleDateString()}`
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: 'Use %analytics [type] for detailed stats • Types: members, messages, commands, channels, growth' })
            .setTimestamp();

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async showMemberAnalytics(message, analytics) {
        const guild = message.guild;
        const last30Days = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const last7Days = Date.now() - (7 * 24 * 60 * 60 * 1000);
        
        const joins30d = analytics.memberJoins.filter(j => j.timestamp > last30Days).length;
        const leaves30d = analytics.memberLeaves.filter(l => l.timestamp > last30Days).length;
        const joins7d = analytics.memberJoins.filter(j => j.timestamp > last7Days).length;
        const leaves7d = analytics.memberLeaves.filter(l => l.timestamp > last7Days).length;

        // Calculate daily join/leave trends
        const dailyJoins = {};
        const dailyLeaves = {};
        
        analytics.memberJoins.forEach(join => {
            if (!dailyJoins[join.date]) dailyJoins[join.date] = 0;
            dailyJoins[join.date]++;
        });
        
        analytics.memberLeaves.forEach(leave => {
            if (!dailyLeaves[leave.date]) dailyLeaves[leave.date] = 0;
            dailyLeaves[leave.date]++;
        });

        const embed = new EmbedBuilder()
            .setTitle(`👥 ${guild.name} Member Analytics`)
            .setColor(0x00FF7F)
            .addFields(
                {
                    name: '📈 **Growth Stats**',
                    value: [
                        `**Current Members:** ${guild.memberCount}`,
                        `**30d Joins:** ${joins30d}`,
                        `**30d Leaves:** ${leaves30d}`,
                        `**30d Net Growth:** ${joins30d - leaves30d}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '⚡ **Recent Activity**',
                    value: [
                        `**7d Joins:** ${joins7d}`,
                        `**7d Leaves:** ${leaves7d}`,
                        `**7d Net Growth:** ${joins7d - leaves7d}`,
                        `**Growth Rate:** ${((joins7d - leaves7d) / guild.memberCount * 100).toFixed(2)}%`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '📊 **Trends**',
                    value: [
                        `**Avg Daily Joins:** ${(joins30d / 30).toFixed(1)}`,
                        `**Avg Daily Leaves:** ${(leaves30d / 30).toFixed(1)}`,
                        `**Best Join Day:** ${this.getBestJoinDay(dailyJoins)}`,
                        `**Retention Rate:** ${(((guild.memberCount - leaves30d) / guild.memberCount) * 100).toFixed(1)}%`
                    ].join('\n'),
                    inline: false
                }
            )
            .setTimestamp();

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async showMessageAnalytics(message, analytics) {
        const guild = message.guild;
        const totalMessages = Object.values(analytics.messageStats).reduce((a, b) => a + b, 0);
        const activeUsers = Object.keys(analytics.messageStats).length;
        
        // Get top users
        const topUsers = Object.entries(analytics.messageStats)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([userId, count], index) => `${index + 1}. <@${userId}> - ${count.toLocaleString()} messages`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setTitle(`💬 ${guild.name} Message Analytics`)
            .setColor(0xFF69B4)
            .addFields(
                {
                    name: '📊 **Overall Stats**',
                    value: [
                        `**Total Messages:** ${totalMessages.toLocaleString()}`,
                        `**Active Users:** ${activeUsers}`,
                        `**Avg per User:** ${Math.round(totalMessages / activeUsers)}`,
                        `**Daily Average:** ${this.getAverageDailyMessages(analytics)}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🏆 **Top Chatters**',
                    value: topUsers || 'No data available',
                    inline: false
                }
            )
            .setTimestamp();

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async showCommandAnalytics(message, analytics) {
        const guild = message.guild;
        const totalCommands = Object.values(analytics.commandUsage).reduce((a, b) => a + b.count, 0);
        
        // Get top commands
        const topCommands = Object.entries(analytics.commandUsage)
            .sort(([,a], [,b]) => b.count - a.count)
            .slice(0, 15)
            .map(([cmd, data], index) => `${index + 1}. \`${cmd}\` - ${data.count} uses (${data.users.length} users)`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setTitle(`⚡ ${guild.name} Command Analytics`)
            .setColor(0xFFD700)
            .addFields(
                {
                    name: '📊 **Command Stats**',
                    value: [
                        `**Total Commands:** ${totalCommands.toLocaleString()}`,
                        `**Unique Commands:** ${Object.keys(analytics.commandUsage).length}`,
                        `**Avg per Command:** ${Math.round(totalCommands / Object.keys(analytics.commandUsage).length)}`,
                        `**Most Popular:** ${this.getMostUsedCommand(analytics)}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🏆 **Top Commands**',
                    value: topCommands || 'No commands tracked yet',
                    inline: false
                }
            )
            .setTimestamp();

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async showChannelAnalytics(message, analytics) {
        const guild = message.guild;
        
        // Get top channels
        const topChannels = Object.entries(analytics.channelActivity)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 15)
            .map(([channelId, count], index) => {
                const channel = guild.channels.cache.get(channelId);
                const channelName = channel ? `#${channel.name}` : 'Deleted Channel';
                return `${index + 1}. ${channelName} - ${count.toLocaleString()} messages`;
            })
            .join('\n');

        const totalChannelMessages = Object.values(analytics.channelActivity).reduce((a, b) => a + b, 0);

        const embed = new EmbedBuilder()
            .setTitle(`📺 ${guild.name} Channel Analytics`)
            .setColor(0x00BFFF)
            .addFields(
                {
                    name: '📊 **Channel Stats**',
                    value: [
                        `**Active Channels:** ${Object.keys(analytics.channelActivity).length}`,
                        `**Total Messages:** ${totalChannelMessages.toLocaleString()}`,
                        `**Avg per Channel:** ${Math.round(totalChannelMessages / Object.keys(analytics.channelActivity).length)}`,
                        `**Most Active:** ${this.getMostActiveChannel(guild, analytics)}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🏆 **Top Channels**',
                    value: topChannels || 'No channel activity tracked',
                    inline: false
                }
            )
            .setTimestamp();

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async showGrowthAnalytics(message, analytics) {
        const guild = message.guild;
        
        // Calculate growth over different periods
        const periods = [1, 7, 30, 90];
        const growthData = periods.map(days => {
            const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
            const joins = analytics.memberJoins.filter(j => j.timestamp > cutoff).length;
            const leaves = analytics.memberLeaves.filter(l => l.timestamp > cutoff).length;
            const net = joins - leaves;
            const rate = ((net / guild.memberCount) * 100).toFixed(2);
            
            return `**${days}d:** +${joins} -${leaves} = ${net >= 0 ? '+' : ''}${net} (${rate}%)`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setTitle(`📈 ${guild.name} Growth Analytics`)
            .setColor(0x32CD32)
            .addFields(
                {
                    name: '📊 **Growth Periods**',
                    value: growthData,
                    inline: false
                },
                {
                    name: '🎯 **Projections**',
                    value: [
                        `**Weekly Trend:** ${this.getWeeklyTrend(analytics)} members/week`,
                        `**Monthly Projection:** ${this.getMonthlyProjection(analytics)} members`,
                        `**Growth Velocity:** ${this.getGrowthVelocity(analytics)}`,
                        `**Health Score:** ${this.getHealthScore(analytics)}/10`
                    ].join('\n'),
                    inline: false
                }
            )
            .setTimestamp();

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    // Helper functions
    getMostActiveChannel(guild, analytics) {
        const entries = Object.entries(analytics.channelActivity);
        if (entries.length === 0) return 'None';
        
        const [channelId] = entries.sort(([,a], [,b]) => b - a)[0];
        const channel = guild.channels.cache.get(channelId);
        return channel ? `#${channel.name}` : 'Deleted Channel';
    },

    getMostUsedCommand(analytics) {
        const entries = Object.entries(analytics.commandUsage);
        if (entries.length === 0) return 'None';
        
        const [command] = entries.sort(([,a], [,b]) => b.count - a.count)[0];
        return command;
    },

    getAverageDailyMessages(analytics) {
        const days = Object.keys(analytics.dailyStats).length;
        if (days === 0) return '0';
        
        const totalMessages = Object.values(analytics.dailyStats).reduce((sum, day) => sum + day.messages, 0);
        return Math.round(totalMessages / days).toLocaleString();
    },

    getBestJoinDay(dailyJoins) {
        const entries = Object.entries(dailyJoins);
        if (entries.length === 0) return 'None';
        
        const [date, count] = entries.sort(([,a], [,b]) => b - a)[0];
        return `${date} (${count} joins)`;
    },

    getWeeklyTrend(analytics) {
        const last2Weeks = Date.now() - (14 * 24 * 60 * 60 * 1000);
        const lastWeek = Date.now() - (7 * 24 * 60 * 60 * 1000);
        
        const week1Joins = analytics.memberJoins.filter(j => j.timestamp > last2Weeks && j.timestamp < lastWeek).length;
        const week1Leaves = analytics.memberLeaves.filter(l => l.timestamp > last2Weeks && l.timestamp < lastWeek).length;
        const week2Joins = analytics.memberJoins.filter(j => j.timestamp > lastWeek).length;
        const week2Leaves = analytics.memberLeaves.filter(l => l.timestamp > lastWeek).length;
        
        const week1Net = week1Joins - week1Leaves;
        const week2Net = week2Joins - week2Leaves;
        
        return week2Net >= week1Net ? `+${week2Net}` : `${week2Net}`;
    },

    getMonthlyProjection(analytics) {
        const last30Days = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const joins = analytics.memberJoins.filter(j => j.timestamp > last30Days).length;
        const leaves = analytics.memberLeaves.filter(l => l.timestamp > last30Days).length;
        const net = joins - leaves;
        
        return net >= 0 ? `+${net}` : `${net}`;
    },

    getGrowthVelocity(analytics) {
        const last7Days = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const recentJoins = analytics.memberJoins.filter(j => j.timestamp > last7Days).length;
        const recentLeaves = analytics.memberLeaves.filter(l => l.timestamp > last7Days).length;
        const net = recentJoins - recentLeaves;
        
        if (net > 10) return 'Rapid Growth 🚀';
        if (net > 5) return 'Steady Growth 📈';
        if (net > 0) return 'Slow Growth 📊';
        if (net === 0) return 'Stable 📊';
        if (net > -5) return 'Slight Decline 📉';
        return 'Declining 📉';
    },

    getHealthScore(analytics) {
        const last30Days = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const joins = analytics.memberJoins.filter(j => j.timestamp > last30Days).length;
        const leaves = analytics.memberLeaves.filter(l => l.timestamp > last30Days).length;
        const retention = joins > 0 ? ((joins - leaves) / joins) * 100 : 0;
        
        if (retention >= 90) return 10;
        if (retention >= 80) return 9;
        if (retention >= 70) return 8;
        if (retention >= 60) return 7;
        if (retention >= 50) return 6;
        if (retention >= 40) return 5;
        if (retention >= 30) return 4;
        if (retention >= 20) return 3;
        if (retention >= 10) return 2;
        return 1;
    },

    // Export tracking functions for use in other parts of the bot
    trackMemberJoin,
    trackMemberLeave,
    trackMessage,
    trackCommand
};
