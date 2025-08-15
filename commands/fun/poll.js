const { PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const fs = require('fs');
const path = require('path');

const pollsPath = path.join(__dirname, '../../polls-data.json');

function loadPolls() {
    if (!fs.existsSync(pollsPath)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(pollsPath, 'utf8'));
    } catch (error) {
        console.error('Error loading polls:', error);
        return {};
    }
}

function savePolls(polls) {
    try {
        fs.writeFileSync(pollsPath, JSON.stringify(polls, null, 2));
    } catch (error) {
        console.error('Error saving polls:', error);
    }
}

function getServerPolls(guildId) {
    const polls = loadPolls();
    return polls[guildId] || {};
}

function saveServerPolls(guildId, serverPolls) {
    const polls = loadPolls();
    polls[guildId] = serverPolls;
    savePolls(polls);
}

module.exports = {
    name: 'poll',
    aliases: ['vote', 'survey'],
    description: 'Create interactive polls with multiple options and voting',
    usage: '%poll <question> | <option1> | <option2> [| option3...]',
    category: 'fun',
    permissions: [],
    cooldown: 10,

    async execute(message, args) {
        if (!args.length) {
            return this.showHelp(message);
        }

        const subcommand = args[0].toLowerCase();

        switch (subcommand) {
            case 'quick':
                return this.quickPoll(message, args.slice(1));
            case 'anonymous':
            case 'anon':
                return this.anonymousPoll(message, args.slice(1));
            case 'end':
            case 'close':
                return this.endPoll(message, args.slice(1));
            case 'results':
                return this.showResults(message, args.slice(1));
            case 'list':
                return this.listPolls(message);
            default:
                return this.createPoll(message, args);
        }
    },

    async showHelp(message) {
        const embed = new EmbedBuilder()
            .setTitle('📊 Advanced Polling System')
            .setDescription('Create interactive polls with multiple voting options')
            .setColor(0x00BFFF)
            .addFields(
                {
                    name: '📊 **Basic Polls**',
                    value: [
                        '`%poll <question> | <option1> | <option2>` - Create poll',
                        '`%poll What\'s your favorite color? | Red | Blue | Green`',
                        '`%poll quick <question>` - Quick yes/no poll',
                        '`%poll anonymous <question> | <options>` - Anonymous poll'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🔧 **Management**',
                    value: [
                        '`%poll end <poll_id>` - End a poll early',
                        '`%poll results <poll_id>` - View detailed results',
                        '`%poll list` - List active polls'
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: 'Separate options with | (pipe) • Max 10 options per poll' });

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async createPoll(message, args) {
        const pollText = args.join(' ');
        const parts = pollText.split('|').map(part => part.trim());

        if (parts.length < 3) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Usage: `%poll <question> | <option1> | <option2> [| option3...]`\nExample: `%poll Favorite pizza? | Pepperoni | Cheese | Hawaiian`')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const question = parts[0];
        const options = parts.slice(1);

        if (options.length > 10) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Maximum 10 options allowed per poll.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        return this.createInteractivePoll(message, question, options, false);
    },

    async quickPoll(message, args) {
        if (!args.length) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Usage: `%poll quick <question>`\nExample: `%poll quick Should we have pizza for lunch?`')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const question = args.join(' ');
        return this.createInteractivePoll(message, question, ['Yes', 'No'], false);
    },

    async anonymousPoll(message, args) {
        const pollText = args.join(' ');
        const parts = pollText.split('|').map(part => part.trim());

        if (parts.length < 3) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Usage: `%poll anonymous <question> | <option1> | <option2>`')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const question = parts[0];
        const options = parts.slice(1);

        return this.createInteractivePoll(message, question, options, true);
    },

    async createInteractivePoll(message, question, options, anonymous = false) {
        const pollId = Date.now().toString();
        const serverPolls = getServerPolls(message.guild.id);

        const pollData = {
            id: pollId,
            question,
            options: options.map(option => ({ text: option, votes: [] })),
            createdBy: message.author.id,
            createdAt: Date.now(),
            channelId: message.channel.id,
            messageId: null,
            anonymous,
            active: true
        };

        const embed = new EmbedBuilder()
            .setTitle(`📊 ${anonymous ? 'Anonymous ' : ''}Poll`)
            .setDescription(`**${question}**`)
            .setColor(0x00BFFF)
            .setFooter({ 
                text: `Poll ID: ${pollId} • Created by ${message.author.username}${anonymous ? ' • Anonymous voting' : ''}` 
            })
            .setTimestamp();

        // Add options to embed
        const optionText = options.map((option, index) => 
            `${this.getEmoji(index)} ${option}`
        ).join('\n');

        embed.addFields({
            name: '📋 Options',
            value: optionText,
            inline: false
        });

        // Create buttons
        const rows = [];
        let currentRow = new ActionRowBuilder();
        
        for (let i = 0; i < options.length; i++) {
            if (i > 0 && i % 5 === 0) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }

            const button = new ButtonBuilder()
                .setCustomId(`poll_vote_${pollId}_${i}`)
                .setLabel(`${this.getEmoji(i)} ${options[i]}`)
                .setStyle(ButtonStyle.Primary);

            currentRow.addComponents(button);
        }

        if (currentRow.components.length > 0) {
            rows.push(currentRow);
        }

        // Add control buttons
        const controlRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll_results_${pollId}`)
                    .setLabel('📊 Results')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`poll_end_${pollId}`)
                    .setLabel('🔒 End Poll')
                    .setStyle(ButtonStyle.Danger)
            );

        rows.push(controlRow);

        const pollMessage = await sendAsFloofWebhook(message, { 
            embeds: [embed], 
            components: rows 
        });

        pollData.messageId = pollMessage.id;
        serverPolls[pollId] = pollData;
        saveServerPolls(message.guild.id, serverPolls);

        // Auto-end poll after 24 hours
        setTimeout(() => {
            this.autoEndPoll(pollId, message.guild.id);
        }, 24 * 60 * 60 * 1000);
    },

    async handlePollInteraction(interaction) {
        const [action, pollId, optionIndex] = interaction.customId.split('_').slice(1);
        const serverPolls = getServerPolls(interaction.guild.id);
        const poll = serverPolls[pollId];

        if (!poll || !poll.active) {
            await interaction.reply({ 
                content: '❌ This poll is no longer active.', 
                ephemeral: true 
            });
            return;
        }

        switch (action) {
            case 'vote':
                await this.handleVote(interaction, poll, parseInt(optionIndex));
                break;
            case 'results':
                await this.showPollResults(interaction, poll);
                break;
            case 'end':
                await this.handleEndPoll(interaction, poll);
                break;
        }

        // Save updated poll data
        serverPolls[pollId] = poll;
        saveServerPolls(interaction.guild.id, serverPolls);
    },

    async handleVote(interaction, poll, optionIndex) {
        const userId = interaction.user.id;
        
        // Check if user already voted
        const existingVoteIndex = poll.options.findIndex(option => 
            option.votes.includes(userId)
        );

        if (existingVoteIndex !== -1) {
            // Remove previous vote
            poll.options[existingVoteIndex].votes = poll.options[existingVoteIndex].votes
                .filter(id => id !== userId);
        }

        // Add new vote
        poll.options[optionIndex].votes.push(userId);

        const optionText = poll.options[optionIndex].text;
        const voteCount = poll.options[optionIndex].votes.length;

        await interaction.reply({ 
            content: `✅ You voted for **${optionText}** (${voteCount} vote${voteCount !== 1 ? 's' : ''})`, 
            ephemeral: true 
        });

        // Update the poll message
        await this.updatePollMessage(interaction, poll);
    },

    async showPollResults(interaction, poll) {
        const totalVotes = poll.options.reduce((sum, option) => sum + option.votes.length, 0);
        
        if (totalVotes === 0) {
            await interaction.reply({ 
                content: '📊 No votes yet!', 
                ephemeral: true 
            });
            return;
        }

        const results = poll.options
            .map((option, index) => {
                const percentage = totalVotes > 0 ? Math.round((option.votes.length / totalVotes) * 100) : 0;
                const bar = this.createProgressBar(percentage);
                return `${this.getEmoji(index)} **${option.text}**\n${bar} ${option.votes.length} votes (${percentage}%)`;
            })
            .join('\n\n');

        const embed = new EmbedBuilder()
            .setTitle(`📊 Poll Results: ${poll.question}`)
            .setDescription(results)
            .setColor(0x00FF7F)
            .addFields({
                name: '📈 Summary',
                value: `**Total Votes:** ${totalVotes}\n**Status:** ${poll.active ? 'Active' : 'Ended'}`,
                inline: true
            })
            .setTimestamp();

        if (!poll.anonymous && totalVotes <= 20) {
            // Show voters for small, non-anonymous polls
            const voterInfo = poll.options
                .filter(option => option.votes.length > 0)
                .map((option, index) => {
                    const voters = option.votes.map(id => `<@${id}>`).join(', ');
                    return `${this.getEmoji(index)} ${option.text}: ${voters}`;
                })
                .join('\n');

            if (voterInfo) {
                embed.addFields({
                    name: '👥 Voters',
                    value: voterInfo,
                    inline: false
                });
            }
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async handleEndPoll(interaction, poll) {
        // Check if user can end the poll
        const canEnd = poll.createdBy === interaction.user.id || 
                      interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages);

        if (!canEnd) {
            await interaction.reply({ 
                content: '❌ Only the poll creator or moderators can end this poll.', 
                ephemeral: true 
            });
            return;
        }

        poll.active = false;
        await this.updatePollMessage(interaction, poll, true);
        
        await interaction.reply({ 
            content: '🔒 Poll ended successfully.', 
            ephemeral: true 
        });
    },

    async updatePollMessage(interaction, poll, ended = false) {
        const totalVotes = poll.options.reduce((sum, option) => sum + option.votes.length, 0);
        
        const embed = new EmbedBuilder()
            .setTitle(`📊 ${poll.anonymous ? 'Anonymous ' : ''}Poll${ended ? ' (Ended)' : ''}`)
            .setDescription(`**${poll.question}**`)
            .setColor(ended ? 0xFF6B6B : 0x00BFFF)
            .setFooter({ 
                text: `Poll ID: ${poll.id} • Created by ${interaction.guild.members.cache.get(poll.createdBy)?.displayName || 'Unknown'}${poll.anonymous ? ' • Anonymous voting' : ''} • ${totalVotes} total votes` 
            })
            .setTimestamp(poll.createdAt);

        // Show current results
        if (totalVotes > 0) {
            const results = poll.options.map((option, index) => {
                const percentage = Math.round((option.votes.length / totalVotes) * 100);
                const bar = this.createProgressBar(percentage);
                return `${this.getEmoji(index)} **${option.text}**\n${bar} ${option.votes.length} votes (${percentage}%)`;
            }).join('\n\n');

            embed.addFields({
                name: '📊 Current Results',
                value: results,
                inline: false
            });
        } else {
            const optionText = poll.options.map((option, index) => 
                `${this.getEmoji(index)} ${option.text}`
            ).join('\n');

            embed.addFields({
                name: '📋 Options',
                value: optionText,
                inline: false
            });
        }

        try {
            const channel = interaction.guild.channels.cache.get(poll.channelId);
            const message = await channel.messages.fetch(poll.messageId);
            
            if (ended) {
                await message.edit({ embeds: [embed], components: [] });
            } else {
                await message.edit({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error updating poll message:', error);
        }
    },

    async endPoll(message, args) {
        if (!args.length) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Usage: `%poll end <poll_id>`')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const pollId = args[0];
        const serverPolls = getServerPolls(message.guild.id);
        const poll = serverPolls[pollId];

        if (!poll) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Poll not found. Use `%poll list` to see active polls.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const canEnd = poll.createdBy === message.author.id || 
                      message.member.permissions.has(PermissionsBitField.Flags.ManageMessages);

        if (!canEnd) {
            const embed = new EmbedBuilder()
                .setDescription('❌ Only the poll creator or moderators can end this poll.')
                .setColor(0xFF0000);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        poll.active = false;
        saveServerPolls(message.guild.id, serverPolls);

        const embed = new EmbedBuilder()
            .setDescription(`✅ Poll "${poll.question}" has been ended.`)
            .setColor(0x00FF00);

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async listPolls(message) {
        const serverPolls = getServerPolls(message.guild.id);
        const activePolls = Object.values(serverPolls).filter(poll => poll.active);

        if (activePolls.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('📭 No active polls in this server.')
                .setColor(0x7289DA);
            return sendAsFloofWebhook(message, { embeds: [embed] });
        }

        const pollList = activePolls.map(poll => {
            const totalVotes = poll.options.reduce((sum, option) => sum + option.votes.length, 0);
            const creator = message.guild.members.cache.get(poll.createdBy)?.displayName || 'Unknown';
            const age = Math.floor((Date.now() - poll.createdAt) / (1000 * 60 * 60));
            
            return `**${poll.id}** - ${poll.question}\n` +
                   `👤 ${creator} • 📊 ${totalVotes} votes • ⏰ ${age}h ago`;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setTitle(`📊 Active Polls (${activePolls.length})`)
            .setDescription(pollList)
            .setColor(0x7289DA)
            .setFooter({ text: 'Use %poll results <id> for detailed results' });

        return sendAsFloofWebhook(message, { embeds: [embed] });
    },

    async autoEndPoll(pollId, guildId) {
        const serverPolls = getServerPolls(guildId);
        const poll = serverPolls[pollId];

        if (poll && poll.active) {
            poll.active = false;
            saveServerPolls(guildId, serverPolls);
        }
    },

    // Helper functions
    getEmoji(index) {
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        return emojis[index] || '📊';
    },

    createProgressBar(percentage) {
        const filled = Math.floor(percentage / 10);
        const empty = 10 - filled;
        return '▰'.repeat(filled) + '▱'.repeat(empty);
    }
};
