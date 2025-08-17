const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(process.cwd(), 'data', 'server-configs.json');

function getServerConfig(guildId) {
    try {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        const all = JSON.parse(raw);
        return all[guildId] || {};
    } catch {
        return {};
    }
}

// Usage: %makerulesmenu [#channel] [roleName]
// Posts the rules with an "I agree" button. Options allow custom title/description/footer/button.
// options: { title?, description?, footer?, buttonLabel?, assignRoleName? }
async function postRulesMenu(channel, guild, options = {}) {
    const { title, description, footer, buttonLabel, assignRoleName } = options;
    // Ensure bot can manage roles if an assign role is specified
    if (assignRoleName && !guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        throw new Error('Manage Roles permission required to assign roles from rules menu');
    }
    // Find or create the role if specified
    let assignRole = null;
    if (assignRoleName) {
        assignRole = guild.roles.cache.find(r => r.name === assignRoleName);
        if (!assignRole) {
            try {
                assignRole = await guild.roles.create({ name: assignRoleName, reason: 'Floof rules menu setup' });
            } catch {}
        }
    }

    const defaultRules = [
        'Be kind and respectful! ✨',
        'No spam or self-promo.',
        'Keep things cozy and safe for all floofs.',
        'You can be weird, but not *too* weird~',
        'Try to keep arguing to a minimum.',
        'Show lots of love to Floof (if she\'s working)!',
        'Dark humor is okay, but don\'t say anything too crazy!',
        'Listen to mods and have fun!'
    ];

    const embed = new EmbedBuilder()
        .setTitle(title || '🐾 Floof\'s Fluffy Den Rules')
        .setDescription(
            description
                ? description
                : defaultRules.map((r, i) => `${i + 1}. ${r}`).join('\n')
        )
        .setColor(0xffb6c1);
    if (footer) embed.setFooter({ text: footer });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('floof_rules_agree')
            .setLabel(buttonLabel || 'I agree! 🐾')
            .setStyle(ButtonStyle.Success)
    );

    if (!channel || !channel.isTextBased()) {
        throw new Error('Invalid target channel for the rules menu');
    }
    await channel.send({ embeds: [embed], components: [row] });
}

// Handler for the rules button
async function handleRulesMenuInteraction(interaction) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'floof_rules_agree') return;
    const member = interaction.member;
    // Assign configured role (default: Member)
    const cfg = getServerConfig(interaction.guild.id);
    const roleName = (cfg.rulesAssignRole || 'Member').toLowerCase();
    const assignRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === roleName);
    if (!assignRole) {
        return interaction.reply({ content: 'Sorry, I could not find the "Member" role! Please let a mod know.', flags: 64 });
    }
    if (!member.roles.cache.has(assignRole.id)) {
        try {
            await member.roles.add(assignRole);
            await interaction.reply({ content: 'Yay! You have been given the Member role! Welcome to the fluff! (ฅ^•ﻌ•^ฅ)♡', flags: 64 });
        } catch (err) {
            return interaction.reply({ content: 'I do not have permission to assign roles. Please let a mod know!', flags: 64 });
        }
    } else {
        await interaction.reply({ content: 'You already have the Member role! (ฅ^•ﻌ•^ฅ)', flags: 64 });
    }
}

// Backward-compatible command-style function. Accepts optional #channel and role name.
async function makeRulesMenu(message, args) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('❌ You need Administrator to use this command. Use `%config rulesmenu` instead.');
    }
    const maybeChannel = args[0];
    const roleArg = args[1];
    const channel = maybeChannel && /^<#\d+>$/.test(maybeChannel)
        ? message.guild.channels.cache.get(maybeChannel.replace(/[^\d]/g, ''))
        : message.channel;
    try {
        await postRulesMenu(channel, message.guild, roleArg);
        if (channel && channel.id !== message.channel.id) {
            await message.reply(`Rules menu sent to ${channel}!`);
        }
    } catch (e) {
        await message.reply('Failed to send rules menu: ' + e.message);
    }
}

module.exports = { makeRulesMenu, handleRulesMenuInteraction, postRulesMenu };
