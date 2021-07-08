var ajax = require('ajax');
var UI = require('ui');
var tempAuth = require("./hackyTempAuth");

var env = {
    token: "",
    serverAddress: "https://ha.will0.id",
    serverPort: 443
}

//Here until I get settings up and running:
env.token = tempAuth.issue()

function log(text, verboseOnly) {
    console.log(text)
}

function _url() {
    var a = env.serverAddress;
    // if ({
    //   "http": 80,
    //   "https": 443
    // }[env.serverAddress.substr(0,6)] != serverPort) {
    //   a += env.serverPort
    // }
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
        body: 'Failed to talk to Home Assistant',
        style: "small",
        scrollable: false
    });
    console.log("oh no occured")
    console.log(e)
    ohno.show();
}

function getStates(cb, filter) {
    log("Getting states", true);
    makeGetRequest("/states", cb, filter)
}

function setLightBrightness(entity, brightness, cb) {
    var postData = {
        entity_id: entity.entity_id,
        brightness: brightness
    }
    console.log("Making post request to brightness up");
    makePostRequest("/services/light/turn_on", postData, cb)
}

function setLightTemperature(entity, temp, cb) {
    var postData = {
        entity_id: entity.entity_id,
        color_temp: temp
    }
    console.log("Making post request to change temp");
    makePostRequest("/services/light/turn_on", postData, cb)
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




function toggle(entity, cb) {

    console.log("[hass] Toggle device " + entity.entity_id)

    var data = {
        entity_id: entity.entity_id
    };
    entity.type = entity.entity_id.split(".")[0];
    var path = "/services/" + entity.type + "/toggle"

    makePostRequest(path, data, cb)
    cb()

}

function refresh(entity, cb) {

    console.log("[hass] Refresh entity " + entity.entity_id);
    var path = "/states/" + entity.entity_id;

    makeGetRequest(path, cb)

}

module.exports.getStates = getStates;
module.exports.toggle = toggle;
module.exports.refresh = refresh;
module.exports.setLightBrightness = setLightBrightness;
module.exports.setLightTemperature = setLightTemperature;
module.exports.playPause = playPause
module.exports.volume_up = volume_up
module.exports.volume_down = volume_down
module.exports.mute = mute
module.exports.unmute = unmute
