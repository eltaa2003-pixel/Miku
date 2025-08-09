import { getPhoneNumber } from './simple-jid.js';

/**
 * Check if a user is an owner based on config.js
 * @param {string} jid - User's JID
 * @returns {boolean} - True if user is owner
 */
export function isOwner(jid) {
  if (!jid) return false;
  
  // Get owner numbers from global config
  const owners = global.owner || [];
  const ownerNumbers = owners.map(owner => {
    if (Array.isArray(owner)) {
      return owner[0].replace(/^\+/, '');
    }
    return owner.replace(/^\+/, '');
  });
  
  // Get phone number from JID
  const userNumber = getPhoneNumber(jid);
  if (!userNumber) return false;
  
  // Check if user number matches any owner number
  return ownerNumbers.some(owner => 
    userNumber.includes(owner) || owner.includes(userNumber)
  );
}

/**
 * Check if a user is a premium user based on config.js
 * @param {string} jid - User's JID
 * @returns {boolean} - True if user is premium
 */
export function isPremium(jid) {
  if (!jid) return false;
  
  // Check if user is owner first
  if (isOwner(jid)) return true;
  
  // Get premium numbers from global config
  const prems = global.prems || [];
  const userNumber = getPhoneNumber(jid);
  if (!userNumber) return false;
  
  // Check if user number matches any premium number
  return prems.some(prem => 
    userNumber.includes(prem.replace(/^\+/, '')) || 
    prem.replace(/^\+/, '').includes(userNumber)
  );
}

/**
 * Check if a user is a moderator based on config.js
 * @param {string} jid - User's JID
 * @returns {boolean} - True if user is moderator
 */
export function isModerator(jid) {
  if (!jid) return false;
  
  // Check if user is owner first
  if (isOwner(jid)) return true;
  
  // Get moderator numbers from global config
  const mods = global.mods || [];
  const userNumber = getPhoneNumber(jid);
  if (!userNumber) return false;
  
  // Check if user number matches any moderator number
  return mods.some(mod => 
    userNumber.includes(mod.replace(/^\+/, '')) || 
    mod.replace(/^\+/, '').includes(userNumber)
  );
}

export default {
  isOwner,
  isPremium,
  isModerator
};