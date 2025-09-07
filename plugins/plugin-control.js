// plugins/plugin-control.js
const handler = async (m, { conn, args, usedPrefix }) => {
  // Only the bot owners can manage plugins
  const senderId = m.sender && m.sender.split('@')[0];
  const owners   = global.owner.map(([num]) => num.replace(/[^0-9]/g, ''));
  if (!owners.includes(senderId)) {
    return m.reply('❌ This command is for the bot owner(s) only.');
  }

  // Ensure the settings object for plugins exists
  const settings = global.db.data.settings;
  if (!settings.plugins) {
    settings.plugins = {};
  }

  const [action, pluginName] = args;
  if (!action || !/^(enable|disable|list)$/i.test(action)) {
    return m.reply(
      `Usage: ${usedPrefix}plugin <enable|disable|list> [pluginName]\n` +
      `Example: ${usedPrefix}plugin disable menu.js`
    );
  }

  // Show a list of loaded plugins
  if (/^list$/i.test(action)) {
    const lines = Object.keys(global.plugins).map(name => {
      const plugin = global.plugins[name];
      const dbState = settings.plugins[name] || {};
      const status = plugin.disabled || dbState.disabled ? 'disabled' : 'enabled';
      return `• ${name} — ${status}`;
    }).join('\n');
    return m.reply(`📦 Plugin list:\n\n${lines}`);
  }

  // Validate plugin name
  if (!pluginName) {
    return m.reply('Please specify the plugin file name, e.g. menu.js');
  }
  const normalizedName = pluginName.toLowerCase();
  const target = Object.keys(global.plugins).find(name => name.toLowerCase() === normalizedName);
  if (!target) {
    return m.reply(`Plugin "${pluginName}" not found.`);
  }

  // Enable or disable the plugin
  const plugin = global.plugins[target];
  if (/^disable$/i.test(action)) {
    if (plugin.disabled) {
      return m.reply(`Plugin "${target}" is already disabled.`);
    }
    plugin.disabled = true;
    settings.plugins[target] = { disabled: true };
    m.reply(`✅ Plugin "${target}" has been disabled.`);
  } else {
    // action === 'enable'
    if (!plugin.disabled) {
      return m.reply(`Plugin "${target}" is already enabled.`);
    }
    plugin.disabled = false;
    settings.plugins[target] = { disabled: false };
    m.reply(`✅ Plugin "${target}" has been enabled.`);
  }
};

handler.help = ['plugin <enable|disable|list> [pluginName]'];
handler.tags = ['owner'];
handler.command = /^(plugin)$/i;
handler.rowner = true; // real owner only

export default handler;