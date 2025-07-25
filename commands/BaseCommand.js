/**
 * Base command template for Floof Bot
 * All commands should follow this structure
 */

class BaseCommand {
    constructor() {
        this.name = '';           // Command name (required)
        this.description = '';    // Command description
        this.usage = '';         // Usage example
        this.category = '';      // Command category
        this.aliases = [];       // Alternative command names
        this.permissions = null; // Required Discord permissions
        this.ownerOnly = false;  // Owner only command
        this.cooldown = 0;       // Cooldown in seconds
    }

    /**
     * Execute the command
     * @param {Message} message - Discord message object
     * @param {Array} args - Command arguments
     */
    async execute(message, args) {
        throw new Error('Execute method must be implemented');
    }
}

module.exports = BaseCommand;
