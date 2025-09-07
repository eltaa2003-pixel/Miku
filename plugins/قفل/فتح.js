let handler = async (m, { conn, command }) => {
  // Map the Arabic commands directly to group setting actions
  let isClose = command === 'قفل' ? 'announcement' : command === 'فتح' ? 'not_announcement' : ''

  if (!isClose) throw new Error('Invalid command') // Failsafe, should not trigger

  // Update the group setting based on the command
  await conn.groupSettingUpdate(m.chat, isClose).catch(error => {
    console.error('Error updating group setting:', error);
    throw new Error('Failed to update group setting');
  });
}

handler.help = ['group *فتح/قفل*'] // Only Arabic commands in help
handler.tags = ['group']
handler.command = ['قفل', 'فتح'] // Arabic commands only
handler.admin = true
handler.botAdmin = true

export default handler
