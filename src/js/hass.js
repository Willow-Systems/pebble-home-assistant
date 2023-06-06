var ajax = require('ajax');
var UI = require('ui');

var env = {
    token: "",
    serverAddress: ""
}

function init(url, token) {
    console.log("Init hass runtime, using instance @ " + url)
    env.serverAddress = url
    env.token = token
}

function log(text, verboseOnly) {
    console.log(text)
}

function _url() {
    var a = env.serverAddress;
    return a
}

function makeGetRequest(path, cb, cbo) {
    var headers = {
        "Authorization": "Bearer " + env.token
    }
    ajax({ url: _url() + "/api" + path, type: 'json', headers: headers }, function(data) {
        cb(data, cbo)
    }, genericNetworkFail);
}

function makePostRequest(path, data, cb) {
    var headers = {
        "Authorization": "Bearer " + env.token
    }
    console.log("[hass] Posting '" + JSON.stringify(data) + "' to " + path)
    ajax({ url: _url() + "/api" + path, type: 'json', headers: headers, data: data, method: "post" }, cb, genericNetworkFail);
}

function genericNetworkFail(e) {
    var ohno = new UI.Card({
        title: 'Uh Oh',
        body: 'Failed to talk to Home Assistant at ' + env.serverAddress + ". \nCheck address & token in settings.",
        style: "small",
        scrollable: false
    });
    console.log("oh no occured")
    console.log(e)
    console.log(JSON.stringify(e))
    ohno.show();
}

function getStates(cb, filter) {
    log("Getting states", true);
    makeGetRequest("/states", cb, filter)
}
function getState(entity_id, cb) {
    log("Getting state for " + entity_id, true);
    makeGetRequest("/states/" + entity_id, cb)
}

function setLightBrightness(entity, brightness, cb) {
    var postData = {
        entity_id: entity.entity_id,
        brightness: brightness
    }
    console.log("Making post request to brightness up");
    makePostRequest("/services/light/turn_on", postData, function(d) {
        cb_intercept(entity, cb, d)
    })
}

function setLightTemperature(entity, temp, cb) {
    var postData = {
        entity_id: entity.entity_id,
        color_temp: temp
    }
    console.log("Making post request to change temp");
    makePostRequest("/services/light/turn_on", postData, function(d) {
        cb_intercept(entity, cb, d)
    })
}

function playPause(entity, cb) {
    console.log("[hass] Playpause device " + entity.entity_id)

    var data = {
        entity_id: entity.entity_id
    };
    var path = "/services/media_player/media_play_pause"

    makePostRequest(path, data, cb)
}

function volume_up(entity, cb) {
    var data = {
        entity_id: entity.entity_id
    };
    var path = "/services/media_player/volume_up"

    makePostRequest(path, data, cb)
}
function volume_down(entity, cb) {
    var data = {
        entity_id: entity.entity_id
    };
    var path = "/services/media_player/volume_down"

    makePostRequest(path, data, cb)
}
function mute(entity, cb) {
    var data = {
        entity_id: entity.entity_id,
        is_volume_muted: true
    };
    var path = "/services/media_player/volume_mute"

    makePostRequest(path, data, cb)
}
function unmute(entity, cb) {
    var data = {
        entity_id: entity.entity_id,
        is_volume_muted: false
    };
    var path = "/services/media_player/volume_mute"

    makePostRequest(path, data, cb)
}

function timer_play(entity, cb) {
    var data = {
        entity_id: entity.entity_id
    };
    var path = "/services/timer/start"

    makePostRequest(path, data, cb)
}
function timer_pause(entity, cb) {
    var data = {
        entity_id: entity.entity_id
    };
    var path = "/services/timer/pause"

    makePostRequest(path, data, cb)
    
}
function timer_stop(entity, cb) {
    var data = {
        entity_id: entity.entity_id
    };
    var path = "/services/timer/finish"

    makePostRequest(path, data, cb)
    
}
function timer_cancel(entity, cb) {
    var data = {
        entity_id: entity.entity_id
    };
    var path = "/services/timer/cancel"

    makePostRequest(path, data, cb)
}

function vacuum_start(entity, cb) {
    var data = {
        entity_id: entity.entity_id
    };
    var path = "/services/vacuum/start"

    makePostRequest(path, data, cb)
}
function vacuum_pause(entity, cb) {
    var data = {
        entity_id: entity.entity_id
    };
    var path = "/services/vacuum/pause"

    makePostRequest(path, data, cb)
}
function vacuum_return_to_base(entity, cb) {
    var data = {
        entity_id: entity.entity_id
    };
    var path = "/services/vacuum/return_to_base"

    makePostRequest(path, data, cb)
}

function scene_activate(entity, cb) {
    var data = {
        entity_id: entity.entity_id
    };
    var path = "/services/scene/turn_on"

    makePostRequest(path, data, cb)
}

function process_voice_intent(text, cb) {

    console.log("[hass] Process intent: " )
    var data = {
        text: text
    };
    var path = "/conversation/process"

    makePostRequest(path, data, cb)
}

function lock(entity, cb) {

    console.log("[hass] Lock device " + entity.entity_id)

    var data = {
        entity_id: entity.entity_id
    };
    entity.type = entity.entity_id.split(".")[0];
    var path = "/services/" + entity.type + "/lock"

    makePostRequest(path, data, function(d) {
        cb_intercept(entity, cb, d)
    })
    // cb()

}
function unlock(entity, cb) {

    console.log("[hass] Unlock device " + entity.entity_id)

    var data = {
        entity_id: entity.entity_id
    };
    entity.type = entity.entity_id.split(".")[0];
    var path = "/services/" + entity.type + "/unlock"

    makePostRequest(path, data, function(d) {
        cb_intercept(entity, cb, d)
    })
    // cb()

}
function cust_toggle_lock(entity, cb) {
    //Toggling a lock isn't a thing. We'll make it a thing

    console.log("[hass] Custom toggle lock for device " + entity.entity_id)

    makeGetRequest('/states/' + entity.entity_id, function(data) {

        console.log("Current status: " + data.state)
        if (data.state == "unlocked") {
            lock(entity, cb)
        } else if (data.state == "locked") {
            unlock(entity, cb)
        } else {
            console.log("!=!=!=!=!=!=!=!=!=!")
            console.log("[hass] Something went wrong")
            console.log("[hass] Tried to toggle lock " + entity + " but current state is neither 'locked' nor 'unlocked'")
            cb(entity)
        }

    })
}

function toggle(entity, cb) {

    console.log("[hass] Toggle device " + entity.entity_id)

    var data = {
        entity_id: entity.entity_id
    };
    entity.type = entity.entity_id.split(".")[0];
    var path = "/services/" + entity.type + "/toggle"

    makePostRequest(path, data, function(d) {
        cb_intercept(entity, cb, d)
    })
    // cb()

}
function cb_intercept(entity, cb, d) {
    //Okay so what _should_ happen is makePostRequest in toggle() should just pass a callback
    //But recently home assistant stopped returning the changed state for some reason
    //So instead we come here first, and if we don't have the changed state, request the state and THEN go to the original cb()
    console.log("toggle_cb_intercept( entity:" + JSON.stringify(entity) + " d: " + JSON.stringify(d))

    if (JSON.stringify(d) == "[]") {
        //We need to get the state
        console.log("Manually get new state for " + entity.entity_id)
        makeGetRequest("/states/" + entity.entity_id, cb, null)
    } else {
        cb(d)
    }
}

function refresh(entity, cb) {

    console.log("[hass] Refresh entity " + entity.entity_id);
    var path = "/states/" + entity.entity_id;

    makeGetRequest(path, cb)

}

module.exports.init = init
module.exports.getStates = getStates;
module.exports.getState = getState;
module.exports.toggle = toggle;
module.exports.refresh = refresh;
module.exports.setLightBrightness = setLightBrightness;
module.exports.setLightTemperature = setLightTemperature;
module.exports.playPause = playPause
module.exports.volume_up = volume_up
module.exports.volume_down = volume_down
module.exports.mute = mute
module.exports.unmute = unmute
module.exports.timer_play = timer_play
module.exports.timer_pause = timer_pause
module.exports.timer_stop = timer_stop
module.exports.timer_cancel = timer_cancel
module.exports.vacuum_start = vacuum_start
module.exports.vacuum_pause = vacuum_pause
module.exports.vacuum_return_to_base = vacuum_return_to_base
module.exports.scene_activate = scene_activate
module.exports.process_voice_intent = process_voice_intent
module.exports.lock = lock
module.exports.unlock = unlock
module.exports.toggle_lock = cust_toggle_lock