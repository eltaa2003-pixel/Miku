export function cleanAnswerText(text) {
  return String(text || '')
    .trim()
    .replace(/^[.\u2026]+/, '')
    .trim();
}

export function isExactCommand(text, commands) {
  const cleaned = String(text || '').trim();
  return commands.some(command => cleaned === `.${command}`);
}
