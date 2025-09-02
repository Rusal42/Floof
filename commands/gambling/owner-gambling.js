// owner-gambling.js
// Owner-only gambling commands for Floof bot

const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, addBalance, subtractBalance, setBalance } = require('./utils/balance-manager');
const { getUserJob, setUserJob, getTotalEarned, addTotalEarned, JOB_TYPES } = require('./jobs');
const { arrestUser, isArrested, releaseUser } = require('./utils/crime-manager');

// Use environment variable for owner ID
const { isOwner } = require('../../utils/owner-util');

module.exports = {
    name: 'Ry',
    description: 'Owner-only gambling management commands',
    usage: '%Ry <give/take/set/job/arrest/release/stats> <amount|jobtype|minutes> [@user|userID]',
    category: 'gambling',
    aliases: ['ry'],
    ownerOnly: true,
    cooldown: 0,

    async execute(message, args) {
        // Silent check - no response if not owner
        if (!isOwner(message.author.id)) {
            return;
        }

        if (args.length === 0) {
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🎰 Owner Gambling Commands')
                        .setDescription('**Available Commands:**\n\n' +
                            '💰 **Balance Management:**\n' +
                            '• `%Ry give <amount> [@user|userID]` - Give coins (defaults to self)\n' +
                            '• `%Ry take <amount> [@user|userID]` - Take coins (defaults to self)\n' +
                            '• `%Ry set <amount> [@user|userID]` - Set balance (defaults to self)\n\n' +
                            '💼 **Job Management:**\n' +
                            '• `%Ry job <jobtype> [@user|userID]` - Set user job (defaults to self)\n' +
                            '• `%Ry joblist` - List all job types\n\n' +
                            '🚔 **Arrest System:**\n' +
                            '• `%Ry arrest <minutes> [@user|userID]` - Arrest user (defaults to self)\n' +
                            '• `%Ry release [@user|userID]` - Release from jail (defaults to self)\n\n' +
                            '📊 **Statistics:**\n' +
                            '• `%Ry stats [@user|userID]` - View user stats (defaults to self)')
                        .setColor(0x9b59b6)
                        .setTimestamp()
                ]
            });
        }

        const subcommand = args[0].toLowerCase();

        switch (subcommand) {
            case 'give':
                return await handleGiveCoins(message, args.slice(1));
            case 'take':
                return await handleTakeCoins(message, args.slice(1));
            case 'set':
                return await handleSetBalance(message, args.slice(1));
            case 'job':
                return await handleSetJob(message, args.slice(1));
            case 'joblist':
                return await handleJobList(message);
            case 'arrest':
                return await handleArrest(message, args.slice(1));
            case 'release':
                return await handleRelease(message, args.slice(1));
            case 'stats':
                return await handleStats(message, args.slice(1));
            default:
                return await sendAsFloofWebhook(message, {
                    embeds: [
                        new EmbedBuilder()
                            .setDescription('❌ Invalid subcommand! Use `%Ry` to see available commands.')
                            .setColor(0xff0000)
                    ]
                });
        }
    }
};

async function handleGiveCoins(message, args) {
    const amount = parseInt(args[0], 10);
    if (isNaN(amount) || amount <= 0) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please provide a valid amount to give!')
                    .setColor(0xff0000)
            ]
        });
    }

    const targetUser = await getTargetUser(message, args[1]);
    if (!targetUser) return;

    const newBalance = addBalance(targetUser.id, amount);

    return await sendAsFloofWebhook(message, {
        embeds: [
            new EmbedBuilder()
                .setTitle('💰 Coins Given!')
                .setDescription(`Successfully gave **${amount.toLocaleString()}** coins to ${targetUser.username}!\n\n💳 **New Balance:** ${newBalance.toLocaleString()} coins`)
                .setColor(0x00ff00)
                .setThumbnail(targetUser.displayAvatarURL())
        ]
    });
}

async function handleTakeCoins(message, args) {
    const amount = parseInt(args[0], 10);
    if (isNaN(amount) || amount <= 0) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please provide a valid amount to take!')
                    .setColor(0xff0000)
            ]
        });
    }

    const targetUser = await getTargetUser(message, args[1]);
    if (!targetUser) return;

    const currentBalance = getBalance(targetUser.id);
    const newBalance = subtractBalance(targetUser.id, amount);

    return await sendAsFloofWebhook(message, {
        embeds: [
            new EmbedBuilder()
                .setTitle('💸 Coins Taken!')
                .setDescription(`Successfully took **${amount.toLocaleString()}** coins from ${targetUser.username}!\n\n💳 **Previous Balance:** ${currentBalance.toLocaleString()} coins\n💳 **New Balance:** ${newBalance.toLocaleString()} coins`)
                .setColor(0xff6b6b)
                .setThumbnail(targetUser.displayAvatarURL())
        ]
    });
}

async function handleSetBalance(message, args) {
    const amount = parseInt(args[0], 10);
    if (isNaN(amount) || amount < 0) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please provide a valid balance amount!')
                    .setColor(0xff0000)
            ]
        });
    }

    const targetUser = await getTargetUser(message, args[1]);
    if (!targetUser) return;

    const oldBalance = getBalance(targetUser.id);
    setBalance(targetUser.id, amount);

    return await sendAsFloofWebhook(message, {
        embeds: [
            new EmbedBuilder()
                .setTitle('⚖️ Balance Set!')
                .setDescription(`Successfully set ${targetUser.username}'s balance!\n\n💳 **Previous Balance:** ${oldBalance.toLocaleString()} coins\n💳 **New Balance:** ${amount.toLocaleString()} coins`)
                .setColor(0x3498db)
                .setThumbnail(targetUser.displayAvatarURL())
        ]
    });
}

async function handleSetJob(message, args) {
    if (args.length < 1) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please specify a job type! Use `%Ry joblist` to see available jobs.')
                    .setColor(0xff0000)
            ]
        });
    }

    const jobId = args[0].toLowerCase();
    if (!JOB_TYPES[jobId]) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Invalid job type! Use `%Ry joblist` to see available jobs.')
                    .setColor(0xff0000)
            ]
        });
    }

    const targetUser = await getTargetUser(message, args[1]);
    if (!targetUser) return;

    const oldJob = getUserJob(targetUser.id);
    setUserJob(targetUser.id, jobId);
    const jobInfo = JOB_TYPES[jobId];

    return await sendAsFloofWebhook(message, {
        embeds: [
            new EmbedBuilder()
                .setTitle('💼 Job Set!')
                .setDescription(`Successfully changed ${targetUser.username}'s job!\n\n👔 **Previous Job:** ${JOB_TYPES[oldJob]?.name || 'Unknown'}\n💼 **New Job:** ${jobInfo.emoji} ${jobInfo.name}\n💰 **Pay Range:** ${jobInfo.pay_min}-${jobInfo.pay_max} coins`)
                .setColor(0x3498db)
                .setThumbnail(targetUser.displayAvatarURL())
        ]
    });
}

async function handleJobList(message) {
    let description = '**Available Job Types:**\n\n';
    
    for (const [jobId, jobInfo] of Object.entries(JOB_TYPES)) {
        description += `**${jobId}** - ${jobInfo.emoji} ${jobInfo.name}\n`;
        description += `└ Pay: ${jobInfo.pay_min}-${jobInfo.pay_max} coins\n`;
        description += `└ Requirements: ${jobInfo.requirements}\n\n`;
    }

    return await sendAsFloofWebhook(message, {
        embeds: [
            new EmbedBuilder()
                .setTitle('💼 Job Types')
                .setDescription(description)
                .setColor(0x3498db)
        ]
    });
}

async function handleArrest(message, args) {
    const minutes = parseInt(args[0], 10);
    if (isNaN(minutes) || minutes <= 0 || minutes > 60) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Please provide a valid arrest time (1-60 minutes)!')
                    .setColor(0xff0000)
            ]
        });
    }

    const targetUser = await getTargetUser(message, args[1]);
    if (!targetUser) return;

    if (isArrested(targetUser.id)) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ ${targetUser.username} is already arrested!`)
                    .setColor(0xff0000)
            ]
        });
    }

    const duration = minutes * 60 * 1000; // Convert to milliseconds
    arrestUser(targetUser.id, duration, 'Owner Command', 0);

    return await sendAsFloofWebhook(message, {
        embeds: [
            new EmbedBuilder()
                .setTitle('🚔 User Arrested!')
                .setDescription(`Successfully arrested ${targetUser.username} for **${minutes}** minutes!\n\n⏰ **Release Time:** <t:${Math.floor((Date.now() + duration) / 1000)}:R>`)
                .setColor(0xff0000)
                .setThumbnail(targetUser.displayAvatarURL())
        ]
    });
}

async function handleRelease(message, args) {
    const targetUser = await getTargetUser(message, args[0]);
    if (!targetUser) return;

    if (!isArrested(targetUser.id)) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ ${targetUser.username} is not arrested!`)
                    .setColor(0xff0000)
            ]
        });
    }

    releaseUser(targetUser.id);

    return await sendAsFloofWebhook(message, {
        embeds: [
            new EmbedBuilder()
                .setTitle('🔓 User Released!')
                .setDescription(`Successfully released ${targetUser.username} from jail!`)
                .setColor(0x00ff00)
                .setThumbnail(targetUser.displayAvatarURL())
        ]
    });
}

async function handleStats(message, args) {
    const targetUser = await getTargetUser(message, args[0]);
    if (!targetUser) return;

    const balance = getBalance(targetUser.id);
    const currentJob = getUserJob(targetUser.id);
    const totalEarned = getTotalEarned(targetUser.id);
    const jobInfo = JOB_TYPES[currentJob];
    const arrested = isArrested(targetUser.id);

    let description = `**📊 Gambling Statistics for ${targetUser.username}**\n\n`;
    description += `💰 **Current Balance:** ${balance.toLocaleString()} coins\n`;
    description += `💼 **Current Job:** ${jobInfo.emoji} ${jobInfo.name}\n`;
    description += `📈 **Total Earned:** ${totalEarned.toLocaleString()} coins\n`;
    description += `🚔 **Arrest Status:** ${arrested ? '🔒 Arrested' : '✅ Free'}\n`;

    return await sendAsFloofWebhook(message, {
        embeds: [
            new EmbedBuilder()
                .setTitle('📊 User Statistics')
                .setDescription(description)
                .setColor(0x3498db)
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp()
        ]
    });
}

async function getTargetUser(message, userArg) {
    let targetUser = message.author;
    
    if (userArg) {
        if (message.mentions.users.size > 0) {
            targetUser = message.mentions.users.first();
        } else {
            try {
                targetUser = await message.client.users.fetch(userArg);
            } catch (error) {
                await sendAsFloofWebhook(message, {
                    embeds: [
                        new EmbedBuilder()
                            .setDescription('❌ User not found! Please mention a user, provide a valid user ID, or leave blank to target yourself.')
                            .setColor(0xff0000)
                    ]
                });
                return null;
            }
        }
    }
    
    return targetUser;
}
