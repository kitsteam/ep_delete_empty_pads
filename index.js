const PadManager = require('ep_etherpad-lite/node/db/PadManager');
const log4js = require('ep_etherpad-lite/node_modules/log4js');

const logger = log4js.getLogger('ep_delete_empty_pads');

// Check if we need to delete the pad each time a user leaves
exports.deletePadAtLeave = (hook, session, cb) => {
    (async () => {
        if (session == null) return;
        if (!(await PadManager.doesPadExist(session.padId))) return;
        const pad = await PadManager.getPad(session.padId);
        if (typeof(pad) !== 'undefined' && typeof(pad.id) !== 'undefined') {
            if (pad.getHeadRevisionNumber() !== 0) return;
            logger.info(`Deleting ${session.padId} when user leaved since empty`);
            await pad.remove();
        }
        PadManager.unloadPad(session.padId)
    })();
    return cb(); // No need to wait for completion before calling the callback.
};

// Delete empty pads at startup
exports.deletePadsAtStart = (hook_name, args, cb) => {
    (async () => {
        const {padIDs} = await PadManager.listAllPads();
        // Process pads one at a time to avoid putting too much load on the system.
        for (const padId of padIDs) {
            const pad = await PadManager.getPad(padId);
            if (typeof(pad) !== 'undefined' && typeof(pad.id) !== 'undefined') {
                if (pad.getHeadRevisionNumber() !== 0) continue;
                logger.info(`Deleting ${pad.id} at startup since empty`);
                await pad.remove();
                PadManager.unloadPad(padId)
            }
            PadManager.unloadPad(padId)
        }
    })();
    return cb(); // No need to wait for completion before calling the callback.
};
