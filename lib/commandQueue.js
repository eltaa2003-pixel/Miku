const MAX_CONCURRENT_COMMANDS = 5;
const commandQueue = [];
let currentlyExecuting = 0;

async function processQueue(conn) {
    if (currentlyExecuting >= MAX_CONCURRENT_COMMANDS) {
        return;
    }

    const commandTask = commandQueue.shift();
    if (!commandTask) {
        return;
    }

    currentlyExecuting++;
    const { m, plugin, extra } = commandTask;

    try {
        if (plugin && typeof plugin.call === 'function') {
            await plugin.call(conn, m, extra);
        }
    } catch (error) {
        console.error(`Error executing command: ${error}`);
        m.reply('An error occurred while executing the command.');
    } finally {
        currentlyExecuting--;
        // print(`Finished command. Currently executing: ${currentlyExecuting}`);
        processQueue(conn);
    }
}

export function addToQueue(m, plugin, extra) {
    commandQueue.push({ m, plugin, extra });
    // print(`Command added to queue. Queue size: ${commandQueue.length}`);
}

export function startQueue(conn) {
    setInterval(() => processQueue(conn), 1000);
}