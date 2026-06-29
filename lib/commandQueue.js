const MAX_CONCURRENT_COMMANDS = 5;
const commandQueue = [];
let currentlyExecuting = 0;
let activeConn = null;

async function processQueue(conn) {
    activeConn = conn || activeConn;

    while (currentlyExecuting < MAX_CONCURRENT_COMMANDS && commandQueue.length > 0) {
        const commandTask = commandQueue.shift();
        currentlyExecuting++;
        runCommand(activeConn, commandTask);
    }
}

async function runCommand(conn, commandTask) {
    const { m, plugin, extra, resolve, reject } = commandTask;

    try {
        if (plugin && typeof plugin.call === 'function') {
            await plugin.call(conn, m, extra);
        }
        resolve();
    } catch (error) {
        console.error(`Error executing command: ${error}`);
        await m.reply('An error occurred while executing the command.').catch(() => {});
        reject(error);
    } finally {
        currentlyExecuting--;
        processQueue(conn);
    }
}

export async function addToQueue(m, plugin, extra) {
    return new Promise((resolve, reject) => {
        commandQueue.push({ m, plugin, extra, resolve, reject });
        processQueue(activeConn);
    });
}

export function startQueue(conn) {
    activeConn = conn;
    if (global.queueStarted) return;
    global.queueStarted = true;
    setInterval(() => processQueue(conn), 1000);
}
