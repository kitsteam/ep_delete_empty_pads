const log4js = require('ep_etherpad-lite/node_modules/log4js');
const logger = log4js.getLogger('ep_delete_empty_pads');

var PadManager = require('ep_etherpad-lite/node/db/PadManager'),
    asyncM     = require('ep_etherpad-lite/node_modules/async');

const getPad = callbackify2(PadManager.getPad);
const doesPadExists = callbackify1(PadManager.doesPadExists);
const listAllPads = callbackify0(PadManager.listAllPads);

// Check if we need to delete the pad each time a user leaves
exports.deletePadAtLeave = (hook, session, cb) => {
    if (session == null) return cb();
    var pad = session.padId;
    doesPadExists(pad, (err, exists) => {
        if (err || !exists) return;
        getPad(pad, null, (err, pad) => {
            if (err || pad.getHeadRevisionNumber() !== 0) return;
            logger.info('Deleting '+session.padId+' when user leaved since empty');
            var remove = getRemoveFun(pad)
            remove(() => {});
        });
    });
    return cb(); // No need to wait for completion before calling the callback.
};

// Delete empty pads at startup
exports.deletePadsAtStart = (hook_name, args, cb) => {
    // Deletion queue (avoids max stack size error), 2 workers
    var q = asyncM.queue((pad, callback) => {
        var remove = getRemoveFun(pad)
        remove(callback);
    }, 2);
    // Emptyness test queue
    var p = asyncM.queue((padId, callback) => {
        getPad(padId, null, (err, pad) => {
            if (err || pad.getHeadRevisionNumber() !== 0) return callback(err);
            q.push(pad, (err) => {
                if (err) return;
                logger.info('Deleting '+pad.id+' at startup since empty');
            });
            callback();
        });
    }, 1);

    listAllPads((err, data) => {
        if (err) return;
        for (var i = 0; i < data.padIDs.length; i++) {
            var padId = data.padIDs[i];
            p.push(padId);
        }
    });
    return cb(); // No need to wait for completion before calling the callback.
};

function wrapPromise (p, cb) {
  return p.then((result) => cb(null, result), (err) => cb(err));
}

function callbackify0 (fun) {
  return (cb) => {
    return wrapPromise(fun(), cb);
  };
};

function callbackify1 (fun) {
  return (arg1, cb) => {
    return wrapPromise(fun(arg1), cb);
  };
};

function callbackify2 (fun) {
  return (arg1, arg2, cb) => {
    return wrapPromise(fun(arg1, arg2), cb);
  };
};

function getRemoveFun (pad) {
  var fun = pad.remove.bind(pad)
  return callbackify0(fun);
}
