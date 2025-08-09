import { jidDecode, jidNormalizedUser } from '@whiskeysockets/baileys';

/**
 * Simplified JID Handler - Uses Baileys built-in functions
 * This replaces the complex jidTransformer.js with simple, reliable functions
 */

/**
 * Normalize any JID to standard format using Baileys built-in function
 * @param {string} jid - The JID to normalize
 * @returns {string} - Normalized JID
 */
export function normalizeJid(jid) {
  if (!jid) return jid;
  
  try {
    // Use Baileys' built-in normalization
    return jidNormalizedUser(jid);
  } catch (error) {
    // Fallback: manual cleaning
    return jid.replace(/@lid$/, '@s.whatsapp.net');
  }
}

/**
 * Get phone number from any JID format
 * @param {string} jid - The JID to decode
 * @returns {string} - Phone number
 */
export function getPhoneNumber(jid) {
  if (!jid) return null;
  
  try {
    const decoded = jidDecode(jid);
    return decoded?.user || null;
  } catch (error) {
    // Fallback: extract manually
    return jid.replace(/@.*$/, '');
  }
}

/**
 * Clean phone number format
 * @param {string} phoneNumber - Phone number to clean
 * @returns {string} - Cleaned phone number
 */
export function cleanPhoneNumber(phoneNumber) {
  if (!phoneNumber) return '';
  
  return phoneNumber.toString()
    .replace(/^\+/, '')
    .replace(/@.*$/, '')
    .replace(/[^0-9]/g, '');
}

/**
 * Create JID from phone number
 * @param {string} phoneNumber - Phone number
 * @returns {string} - JID in standard format
 */
export function createJid(phoneNumber) {
  const clean = cleanPhoneNumber(phoneNumber);
  return `${clean}@s.whatsapp.net`;
}

/**
 * Check if JID is a group
 * @param {string} jid - JID to check
 * @returns {boolean} - True if group
 */
export function isGroup(jid) {
  return jid?.endsWith('@g.us') || false;
}

/**
 * Check if JID is a broadcast
 * @param {string} jid - JID to check
 * @returns {boolean} - True if broadcast
 */
export function isBroadcast(jid) {
  return jid?.endsWith('@broadcast') || false;
}

export default {
  normalizeJid,
  getPhoneNumber,
  cleanPhoneNumber,
  createJid,
  isGroup,
  isBroadcast
};