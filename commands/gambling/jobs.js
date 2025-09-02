const { EmbedBuilder } = require('discord.js');
const { sendAsFloofWebhook } = require('../../utils/webhook-util');
const { getBalance, subtractBalance } = require('./utils/balance-manager');
const fs = require('fs');
const path = require('path');

// File to store user jobs
const userJobsFile = path.join(__dirname, 'user-jobs.json');

// Available jobs with requirements and pay rates
const JOB_TYPES = {
    unemployed: {
        name: 'Unemployed',
        emoji: '😴',
        description: 'No job - can only beg, gamble, or do crimes',
        pay_min: 0,
        pay_max: 0,
        application_cost: 0,
        requirements: 'None'
    },
    cashier: {
        name: 'Cashier',
        emoji: '🛒',
        description: 'Entry-level retail job',
        pay_min: 50,
        pay_max: 120,
        application_cost: 100,
        requirements: 'None'
    },
    delivery: {
        name: 'Delivery Driver',
        emoji: '🚚',
        description: 'Deliver packages around town',
        pay_min: 80,
        pay_max: 180,
        application_cost: 250,
        requirements: 'None'
    },
    waiter: {
        name: 'Waiter/Waitress',
        emoji: '🍽️',
        description: 'Serve customers at restaurants',
        pay_min: 60,
        pay_max: 200,
        application_cost: 150,
        requirements: 'None'
    },
    security: {
        name: 'Security Guard',
        emoji: '🛡️',
        description: 'Protect businesses and events',
        pay_min: 120,
        pay_max: 250,
        application_cost: 500,
        requirements: '1000+ coins earned'
    },
    programmer: {
        name: 'Programmer',
        emoji: '💻',
        description: 'Code websites and applications',
        pay_min: 200,
        pay_max: 400,
        application_cost: 1000,
        requirements: '5000+ coins earned'
    },
    manager: {
        name: 'Manager',
        emoji: '👔',
        description: 'Oversee business operations',
        pay_min: 300,
        pay_max: 500,
        application_cost: 2000,
        requirements: '15000+ coins earned'
    },
    executive: {
        name: 'Executive',
        emoji: '💼',
        description: 'High-level corporate position',
        pay_min: 500,
        pay_max: 800,
        application_cost: 5000,
        requirements: '50000+ coins earned'
    }
};

// Load user jobs data
function loadUserJobs() {
    try {
        if (fs.existsSync(userJobsFile)) {
            return JSON.parse(fs.readFileSync(userJobsFile, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading user jobs:', error);
    }
    return {};
}

// Save user jobs data
function saveUserJobs(data) {
    try {
        fs.writeFileSync(userJobsFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving user jobs:', error);
    }
}

// Get user's current job
function getUserJob(userId) {
    const userJobs = loadUserJobs();
    return userJobs[userId] || 'unemployed';
}

// Set user's job
function setUserJob(userId, jobId) {
    const userJobs = loadUserJobs();
    userJobs[userId] = jobId;
    saveUserJobs(userJobs);
}

// Get total coins earned by user (for job requirements)
function getTotalEarned(userId) {
    const userJobs = loadUserJobs();
    return userJobs[`${userId}_total_earned`] || 0;
}

// Add to total earned
function addTotalEarned(userId, amount) {
    const userJobs = loadUserJobs();
    userJobs[`${userId}_total_earned`] = (userJobs[`${userId}_total_earned`] || 0) + amount;
    saveUserJobs(userJobs);
}

module.exports = {
    name: 'jobs',
    description: 'Browse and apply for jobs to earn money',
    usage: '%jobs [apply] [job] | %job [apply] [job]',
    category: 'gambling',
    aliases: ['job', 'career', 'employment'],
    cooldown: 5,

    async execute(message, args) {
        const userId = message.author.id;
        
        // Check if user is arrested
        const { isArrested, getArrestTimeRemaining } = require('./beatup');
        if (isArrested(userId)) {
            const remainingMinutes = Math.ceil(getArrestTimeRemaining(userId) / 60);
            return await sendAsFloofWebhook(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`🚔 You are currently under arrest! You cannot apply for jobs for another **${remainingMinutes}** minutes.`)
                        .setColor(0xff0000)
                ]
            });
        }

        // Handle numbered application
        if (!isNaN(parseInt(args[0]))) {
            const jobNumber = parseInt(args[0]);
            return await handleNumberedApplication(message, userId, jobNumber);
        }

        // Handle apply command
        if (args[0] && args[0].toLowerCase() === 'apply' && args[1]) {
            const jobId = args[1].toLowerCase();
            return await handleJobApplication(message, userId, jobId);
        }

        // Show job center
        return await displayJobCenter(message, userId);
    }
};

async function displayJobCenter(message, userId) {
    const userBalance = getBalance(userId);
    const currentJob = getUserJob(userId);
    const totalEarned = getTotalEarned(userId);
    const currentJobInfo = JOB_TYPES[currentJob];
    
    let description = '💼 **Welcome to the Job Center!**\n\n';
    description += `👤 **Current Job:** ${currentJobInfo.emoji} ${currentJobInfo.name}\n`;
    description += `💰 **Total Earned:** ${totalEarned.toLocaleString()} coins\n\n`;
    description += '**📋 Available Jobs:**\n';
    
    let jobIndex = 1;
    for (const [jobId, jobInfo] of Object.entries(JOB_TYPES)) {
        if (jobId === 'unemployed') continue;
        
        const canApply = checkJobRequirements(userId, jobId);
        const status = currentJob === jobId ? '✅ Current Job' : 
                      canApply ? `💰 ${jobInfo.application_cost.toLocaleString()} coins` : '🔒 Locked';
        
        description += `**${jobIndex}.** ${jobInfo.emoji} **${jobInfo.name}** - ${status}\n`;
        description += `└ ${jobInfo.description}\n`;
        description += `└ Pay: ${jobInfo.pay_min}-${jobInfo.pay_max} coins | Req: ${jobInfo.requirements}\n`;
        jobIndex++;
    }
    
    description += `\n💡 **Apply:** \`%jobs apply <job>\` or \`%jobs <number>\``;

    const embed = new EmbedBuilder()
        .setTitle('💼 Job Center')
        .setDescription(description)
        .setColor(0x3498db)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

async function handleNumberedApplication(message, userId, jobNumber) {
    const jobIds = Object.keys(JOB_TYPES).filter(id => id !== 'unemployed');
    
    if (jobNumber < 1 || jobNumber > jobIds.length) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Invalid job number! Choose between 1 and ${jobIds.length}.\n\nUse \`%jobs\` to see available positions.`)
                    .setColor(0xff0000)
            ]
        });
    }
    
    const jobId = jobIds[jobNumber - 1];
    return await handleJobApplication(message, userId, jobId);
}

async function handleJobApplication(message, userId, jobId) {
    const jobInfo = JOB_TYPES[jobId];
    if (!jobInfo) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('❌ Job not found! Use `%jobs` to see available positions.')
                    .setColor(0xff0000)
            ]
        });
    }

    const currentJob = getUserJob(userId);
    if (currentJob === jobId) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You already work as a **${jobInfo.name}**!`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Check requirements
    if (!checkJobRequirements(userId, jobId)) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ You don't meet the requirements for **${jobInfo.name}**!\n\n📋 **Required:** ${jobInfo.requirements}\n💰 **Your Total Earned:** ${getTotalEarned(userId).toLocaleString()} coins`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Check application cost
    const userBalance = getBalance(userId);
    if (userBalance < jobInfo.application_cost) {
        return await sendAsFloofWebhook(message, {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`❌ Insufficient funds for application!\n\n${jobInfo.emoji} **${jobInfo.name}**\n💰 **Application Cost:** ${jobInfo.application_cost.toLocaleString()} coins\n💳 **Your Balance:** ${userBalance.toLocaleString()} coins`)
                    .setColor(0xff0000)
            ]
        });
    }

    // Apply for job
    subtractBalance(userId, jobInfo.application_cost);
    setUserJob(userId, jobId);

    const embed = new EmbedBuilder()
        .setTitle('🎉 Job Application Successful!')
        .setDescription(`${jobInfo.emoji} **Congratulations!** You are now employed as a **${jobInfo.name}**!\n\n💰 **Application Cost:** ${jobInfo.application_cost.toLocaleString()} coins\n💳 **New Balance:** ${getBalance(userId).toLocaleString()} coins\n💼 **Pay Range:** ${jobInfo.pay_min}-${jobInfo.pay_max} coins per shift\n\n🎯 Use \`%work\` to start earning money!`)
        .setColor(0x00ff00)
        .setTimestamp();

    await sendAsFloofWebhook(message, { embeds: [embed] });
}

function checkJobRequirements(userId, jobId) {
    const jobInfo = JOB_TYPES[jobId];
    const totalEarned = getTotalEarned(userId);
    
    // Parse requirements
    if (jobInfo.requirements === 'None') return true;
    
    const match = jobInfo.requirements.match(/(\d+)\+ coins earned/);
    if (match) {
        const requiredEarnings = parseInt(match[1]);
        return totalEarned >= requiredEarnings;
    }
    
    return true;
}

// Export functions for use in work command
module.exports.getUserJob = getUserJob;
module.exports.setUserJob = setUserJob;
module.exports.getTotalEarned = getTotalEarned;
module.exports.addTotalEarned = addTotalEarned;
module.exports.JOB_TYPES = JOB_TYPES;
