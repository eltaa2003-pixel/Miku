let handler = async (m, { text }) => {
  if (!text) throw 'Please provide a command name to search for.'
  
  const search = text.toLowerCase()
  const commands = Object.values(global.plugins)
    .flatMap(plugin => Array.isArray(plugin.command) ? plugin.command : [plugin.command])
    .filter(command => command instanceof RegExp ? command.test(search) : typeof command === 'string' && command.toLowerCase().includes(search))

  if (commands.length === 0) {
    return m.reply('No commands found.')
  }

  const results = commands.map(command => {
    if (command instanceof RegExp) {
      return command.toString()
    }
    return command
  }).join('\n')

  m.reply(`*Found Commands:*\n${results}`)
}

handler.command = /^(searchcmd|findcmd)$/i
handler.help = ['searchcmd']
handler.tags = ['tools']

export default handler