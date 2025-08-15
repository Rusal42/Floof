const fs = require('fs');
const path = require('path');

class CommandHandler {
    constructor(client) {
        this.client = client;
        this.commands = new Map();
        this.aliases = new Map();
        this.loadCommands();
    }

    loadCommands() {
        const commandsPath = path.join(__dirname, '..', 'commands');
        
        // Load all regular commands, but mark gambling commands as owner-only
        const items = fs.readdirSync(commandsPath);
        for (const item of items) {
            const itemPath = path.join(commandsPath, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                // Load all directories without ownerOnly flag
                this.loadCommandsFromDirectory(itemPath);
            } else if (item.endsWith('.js')) {
                // Load individual command files in the root commands directory
                this.loadCommandFile(itemPath);
            }
        }
        
        // Load creation commands with owner-only flag
        const creationPath = path.join(__dirname, '..', 'creation');
        this.loadCommandsFromDirectory(creationPath, { ownerOnly: true });
        
        // Load moderation commands
        const moderationPath = path.join(__dirname, '..', 'moderation');
        this.loadCommandsFromDirectory(moderationPath);
        
        // Load owner commands
        const ownerCommandsPath = path.join(__dirname, '..', 'owner-commands');
        this.loadCommandsFromDirectory(ownerCommandsPath, { ownerOnly: true });
    }

    loadCommandFile(filePath) {
        const fileName = path.basename(filePath);
        const dirName = path.basename(path.dirname(filePath));
        
        // Skip utility files that aren't commands
        const skipFiles = ['BaseCommand.js', 'balance-manager.js', 'gambling.js', 'gambling-menu.js', 'blackjack-handler.js'];
        
        if (skipFiles.includes(fileName)) {
            console.log(`Skipping non-command file: ${fileName}`);
            return;
        }
        
        try {
            console.log(`Loading command file: ${fileName}`);
            const command = require(filePath);
            
            // Only mark owner-gambling.js commands as ownerOnly
            if (fileName === 'owner-gambling.js' && dirName === 'gambling') {
                command.ownerOnly = true;
            }
            
            // Validate command structure
            if (!command.name || !command.execute) {
                console.warn(`⚠️  Command ${fileName} is missing required properties (name, execute)`);
                return;
            }
            
            // Register command
            this.registerCommand(command, filePath);
        } catch (error) {
            console.error(`❌ Failed to load command ${fileName}:`, error);
        }
    }
    
    registerCommand(command, filePath) {
        // Store file path for potential reloading
        command.filePath = filePath;
        
        // Debug log command registration
        const cmdName = command.name.toLowerCase();
        const isOwnerOnly = command.ownerOnly ? 'OWNER-ONLY' : 'PUBLIC';
        console.log(`📝 Registering command: ${cmdName.padEnd(15)} [${isOwnerOnly}] from ${path.basename(filePath)}`);
        
        // Register command
        this.commands.set(cmdName, command);
        
        // Register aliases if they exist
        if (command.aliases && Array.isArray(command.aliases)) {
            for (const alias of command.aliases) {
                this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
            }
        }
        
        console.log(`✅ Loaded command: ${command.name}${command.ownerOnly ? ' (owner only)' : ''}`);
    }
    
    loadCommandsFromDirectory(dir, options = {}) {
        const { ownerOnly = false } = options;
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                // Recursively load commands from subdirectories
                this.loadCommandsFromDirectory(itemPath, options);
            } else if (item.endsWith('.js')) {
                try {
                    const command = require(itemPath);
                    
                    // Validate command structure
                    if (!command.name || !command.execute) {
                        console.warn(`⚠️  Command ${item} is missing required properties (name, execute)`);
                        continue;
                    }
                    
                    // Apply ownerOnly flag if specified in options
                    if (ownerOnly) {
                        command.ownerOnly = true;
                    }
                    
                    // Store file path for potential reloading
                    command.filePath = itemPath;
                    
                    // Register command
                    this.commands.set(command.name.toLowerCase(), command);
                    
                    // Register aliases if they exist
                    if (command.aliases && Array.isArray(command.aliases)) {
                        for (const alias of command.aliases) {
                            this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
                        }
                    }
                    
                    console.log(`✅ Loaded command: ${command.name}${command.ownerOnly ? ' (owner only)' : ''}`);
                } catch (error) {
                    console.error(`❌ Failed to load command ${item}:`, error);
                }
            }
        }
    }

    async handleCommand(message, usedPrefix = '%') {
        const args = message.content.slice(usedPrefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        
        // Check if it's a command or alias
        let command = this.commands.get(commandName);
        if (!command) {
            const aliasCommand = this.aliases.get(commandName);
            if (aliasCommand) {
                command = this.commands.get(aliasCommand);
            }
        }
        
        // If this is a gambling command, check if the other bot is online
        if (command && command.category === 'gambling' && message.guild) {
            const OTHER_BOT_ID = '1399482685545779241'; // The ID of the other gambling bot
            
            try {
                // Try to get the bot from cache first (faster)
                let otherBot = message.guild.members.cache.get(OTHER_BOT_ID);
                
                // If not in cache, try to fetch it (slower but more accurate)
                if (!otherBot) {
                    otherBot = await message.guild.members.fetch(OTHER_BOT_ID).catch(() => null);
                }
                
                // If we found the bot, check its status
                if (otherBot) {
                    const status = otherBot.presence?.status || 'offline';
                    const isOnline = status !== 'offline' && status !== 'invisible';
                    
                    console.log(`[BOT STATUS] ${otherBot.user.tag} is ${isOnline ? 'ONLINE' : 'OFFLINE'} (status: ${status})`);
                    
                    // If the other bot is online, ignore the command
                    if (isOnline) {
                        console.log(`[COMMAND] Ignoring ${commandName} - other gambling bot is online`);
                        return false;
                    }
                    console.log(`[COMMAND] Processing ${commandName} - other gambling bot is offline`);
                } else {
                    console.log(`[BOT STATUS] Other gambling bot (${OTHER_BOT_ID}) not found in server`);
                }
            } catch (error) {
                console.error('[ERROR] Failed to check bot status:', error);
                // Continue with command execution if there's an error
                console.log(`[COMMAND] Processing ${commandName} - error checking bot status`);
            }
        }
        
        if (!command) {
            return false; // Command not found
        }
        
        try {
            // Check permissions if specified
            if (command.permissions && message.guild) {
                const memberPermissions = message.member.permissions;
                if (!memberPermissions.has(command.permissions)) {
                    return message.reply('❌ You do not have permission to use this command.');
                }
            }
            
            // Check if owner only - silently ignore if not owner
            if (command.ownerOnly) {
                console.log(`Command ${command.name} is owner-only`);
                const { isOwner } = require('../utils/owner-util');
                if (!isOwner(message.author.id)) {
                    console.log(`User ${message.author.tag} is not an owner, ignoring command`);
                    return false;
                }
            } else {
                console.log(`Command ${command.name} is available to all users`);
            }
            
            // Execute command
            await command.execute(message, args);
            
            // Track command usage for website stats
            try {
                const { incrementCommandUsage } = require('../utils/website-integration');
                incrementCommandUsage();
            } catch (error) {
                console.error('Error tracking command usage:', error);
            }
            
            return true;
        } catch (error) {
            console.error(`Error executing command ${commandName}:`, error);
            message.reply('❌ There was an error executing this command.');
            return true;
        }
    }

    // Reload a specific command
    reloadCommand(commandName) {
        const command = this.commands.get(commandName.toLowerCase());
        if (!command) return false;
        
        try {
            // Clear from require cache
            const commandPath = require.resolve(command.filePath);
            delete require.cache[commandPath];
            
            // Reload
            const newCommand = require(commandPath);
            this.commands.set(newCommand.name.toLowerCase(), newCommand);
            
            return true;
        } catch (error) {
            console.error(`Failed to reload command ${commandName}:`, error);
            return false;
        }
    }

    // Get all commands for help
    getAllCommands() {
        return Array.from(this.commands.values());
    }

    // Get commands by category
    getCommandsByCategory(category) {
        return Array.from(this.commands.values()).filter(cmd => cmd.category === category);
    }
}

module.exports = CommandHandler;
