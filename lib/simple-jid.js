import { jidDecode, jidNormalizedUser } from 'baileys-pro';

/**
 * Simplified JID Handler - Uses Baileys built-in functions
 */

/**
 * Normalize any JID to standard format using Baileys built-in function
 * @param {string} jid - The JID to normalize
 * @returns {string} - Normalized JID
 */
export function normalizeJid(jid) {
  if (!jid) return jid;

  try {
    return jidNormalizedUser(jid);
  } catch (error) {
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
    return jid.replace(/@.*$/, '');
  }
}
