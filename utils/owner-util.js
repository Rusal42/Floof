/**
 * Owner utility functions for handling multiple bot owners
 */

/**
 * Get array of owner IDs from environment variable
 * Supports both single ID and comma-separated multiple IDs
 * @returns {string[]} Array of owner Discord IDs
 */
function getOwnerIds() {
    const ownerEnv = process.env.OWNER_ID || '1007799027716329484';
    // Split by comma and trim whitespace, filter out empty strings
    return ownerEnv.split(',').map(id => id.trim()).filter(id => id.length > 0);
}

/**
 * Check if a user ID is an owner
 * @param {string} userId - Discord user ID to check
 * @returns {boolean} True if user is an owner
 */
function isOwner(userId) {
    const ownerIds = getOwnerIds();
    return ownerIds.includes(userId);
}

/**
 * Get the primary owner ID (first in the list)
 * @returns {string} Primary owner Discord ID
 */
function getPrimaryOwnerId() {
    const ownerIds = getOwnerIds();
    return ownerIds[0] || '1007799027716329484';
}

module.exports = {
    getOwnerIds,
    isOwner,
    getPrimaryOwnerId
};
