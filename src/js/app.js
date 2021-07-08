var UI = require('ui');
var ajax = require('ajax');
var Wakeup = require('wakeup');
var Settings = require('settings');
var Vector = require('vector2');
var Feature = require('platform/feature');
var Platform = require('platform');
var hass = require('./hass.js');

setSettingsToDefaultIfRequired();

var entityTypeWhitelist = ["light"];
var entityBlacklist = [
    "light.configuration_tool_1",
    "light.wut",
    "switch.boathouse_lamp",
    "light.bedroom_2",
    "input_boolean.alarm_is_activated",
    "input_boolean.arm_alarm_via_wills_phone_charge",
    "input_boolean.cat_flap_open",
    "input_boolean.weather_warning",
    "input_boolean.use_motion_sensors",
];

var config = {
    showLights: Settings.data("ui_show_lights"),
    showSwitches: Settings.data('ui_show_switches'),
    showSensors: Settings.data('ui_show_sensors'),
    showAutomations: Settings.data('ui_show_automations'),
    showMediaPlayers: Settings.data('ui_show_mediaplayers'),
    enableIcons: true,
    hideUnavailable: true,
    ux: {
        hasChangedLightOperationsBefore: false
    }
}

var sensorConfig = {
    blacklist: [],
    excludeCertificates: true,
    enableWhitelist: true,
    whitelist: [
        "sensor.landing_sensor_temperature",
        "sensor.hallway_sensor_temperature",
        "sensor.loft_temperature",
        "sensor.multi_sensor",
        "sensor.multi_sensor_2",
        "binary_sensor.front_door",
        "binary_sensor.back_door",
        "sensor.minecraft_server_players_online",
        "sensor.nextbintype"
    ],
    invertSubtitle: false
}

var colour = {
    highlight: Feature.color("#00AAFF", "#000000")
}

function setSettingsToDefaultIfRequired() {
    console.log("Internal settings unset. Setting to default")
    if (Settings.data('ui_show_lights') == null) {
        Settings.data('ui_show_lights', true);
        Settings.data('ui_show_switches', true);
        Settings.data('ui_show_sensors', true);
        Settings.data('ui_show_automations', false);
        Settings.data('ui_show_mediaplayers', true);
    }
}


mainMenu = new UI.Menu({
    backgroundColor: 'white',
    textColor: 'black',
    highlightBackgroundColor: colour.highlight,
    highlightTextColor: 'white'
});

homeMenu = new UI.Menu({
    backgroundColor: 'white',
    textColor: 'black',
    highlightBackgroundColor: colour.highlight,
    highlightTextColor: 'white'
});

//Reused global variables
wind_sensorDetail = null;
menuPosToEntity = [];
itemIndex = 0;

//Global light details page variables
brightnessMenuActiveItem = 0;
brightnessUI = {};

//Hacky callback stuff we can do because it's a watch
brightnessUpEntityID = null;

var wayBack = {
    brightnessChange: null,
    temperatureChange: null
}

function getEntityClass(entity_id) {
    return entity_id.split(".")[0];
}


//Pebble.addEventListener('ready', function() {
console.log("Lets Go!");
go();

// showLightDetailWindow({
//   "attributes": {
// 		"brightness": "150",
//     "friendly_name": "Wills Office",
//     "supported_features": 41,
// 		"max_mireds": 500,
// 		"min_mireds": 153
//   },
//   "context": {
//     "id": "7d71eeccfb694746a658acf3a1b63776",
//     "parent_id": null,
//     "user_id": null
//   },
//   "entity_id": "light.lounge_l",
//   "last_changed": "2021-01-23T10:13:49.081544+00:00",
//   "last_updated": "2021-01-23T10:13:49.081544+00:00",
//   "state": "on"
// });

// showSensorDetailWindow("Test Sensor Long","100","IMAGE_ICON_SENSOR","ExtraEntry: ExtraValue");


function go() {

    if (Platform.version() == "aplite") {
        console.log("Platform is aplite and icons make it sad. Disabling")
        config.enableIcons = false;
    }

    var homeItems = [];
    if (config.showLights) { homeItems.push({ title: "Lights" }) }
    if (config.showSwitches) { homeItems.push({ title: "Switches" }) }
    if (config.showSensors) { homeItems.push({ title: "Sensors" }) }
    // if (config.showMediaPlayers) { homeItems.push({ title: "Media Players" }) }
    if (config.showAutomations) { homeItems.push({ title: "Automations" }) }

    homeMenu.section(0, {
        items: homeItems
    });
    homeMenu.show();
    homeMenu.on('select', function(e) {
        if (e.item.title.toLowerCase() == "lights") {
            hass.getStates(renderStatesMenu, "light");
        } else if (e.item.title.toLowerCase() == "switches") {
            hass.getStates(renderStatesMenu, "switch");
        } else if (e.item.title.toLowerCase() == "sensors") {
            hass.getStates(renderStatesMenu, "sensor");
        } else if (e.item.title.toLowerCase() == "media players") {
            hass.getStates(renderStatesMenu, "media_player");
        } else if (e.item.title.toLowerCase() == "automations") {
            hass.getStates(renderStatesMenu, "automation");
        }
    });

}
//});

function renderStatesMenu(data, filter) {
    console.log("Filter: " + filter);
    menuPosToEntity = [];
    var menuItemArray = [];

    for (var i = 0; i < data.length; i++) {

        var entity = data[i];
        entity.type = getEntityClass(entity.entity_id);

        //The almighty entity parser

        var entityType = entity.type;
        //Treat covers as switches here
        entityType = entityType.replace("cover", "switch");
        entityType = entityType.replace("input_boolean", "switch")
        entityType = entityType.replace("media_player", "switch")

        if (entityType.indexOf(filter) != -1 && entityBlacklist.indexOf(entity.entity_id) == -1 && (config.hideUnavailable == false || entity.state != "unavailable")) {

            //White/Blacklist stuff
            if (filter == "sensor") {
                if (sensorConfig.blacklist.indexOf(entity.entity_id) != -1) {
                    continue;
                }
                if (entity.entity_id.indexOf("cert_expiry") != -1 && sensorConfig.excludeCertificates) {
                    continue;
                }

                if (sensorConfig.enableWhitelist) {
                    if (sensorConfig.whitelist.indexOf(entity.entity_id) == -1) {
                        continue
                    }
                }
            }

            var icon = "IMAGE_ICON_UNKNOWN";
            var subtitle = entity.state;
            var title = entity.attributes.friendly_name

            if (entity.type == "light") {

                icon = "IMAGE_ICON_BULB"
                if (entity.state == "on") { icon = "IMAGE_ICON_BULB_ON" }
                subtitle = entity.state
                if (entity.state == "on" && entity.attributes.hasOwnProperty("brightness")) {
                    var bri = parseInt(entity.attributes.brightness);
                    bri = bri / 255 * 100;
                    subtitle += " (" + Math.ceil(bri) + "%)"
                }

            } else if (entity.type == "switch" || entity.type == "input_boolean") {

                icon = "IMAGE_ICON_SWITCH_OFF"
                if (entity.state == "on") { icon = "IMAGE_ICON_SWITCH_ON" }
                subtitle = entity.state

            } else if (entity.type == "cover") {

                icon = "IMAGE_ICON_BLIND_CLOSED"
                if (entity.state == "open") { icon = "IMAGE_ICON_BLIND_OPEN" }
                subtitle = entity.state

            } else if (entity.type == "sensor") {

                icon = "IMAGE_ICON_SENSOR"
                subtitle = entity.state

                if (entity.attributes.hasOwnProperty("device_class") && entity.attributes.device_class == "temperature") {
                    icon = "IMAGE_ICON_TEMP"
                }

                if (entity.attributes.hasOwnProperty("unit_of_measurement")) {
                    subtitle += " " + entity.attributes.unit_of_measurement
                }

            } else if (entity.type == "binary_sensor") {

                icon = "IMAGE_ICON_SENSOR"
                subtitle = getCleanedState(entity)

                if (entity.attributes.hasOwnProperty("device_class")) {
                    if (entity.attributes.device_class == "opening") {
                        icon = {
                            "on": "IMAGE_ICON_DOOR_OPEN",
                            "off": "IMAGE_ICON_DOOR_CLOSED",
                            "unavailable": "IMAGE_ICON_UNAVAILABLE"
                        }[entity.state]
                    }
                }

            } else if (entity.type == "automation") {

                subtitle = ""
                if (title.length > 11) {
                    title = entity.attributes.friendly_name.substr(0, 11)
                    subtitle = entity.attributes.friendly_name.substr(11)
                }
                icon = {
                    "on": "IMAGE_ICON_AUTO_ON",
                    "off": "IMAGE_ICON_AUTO_OFF",
                    "unavailable": "IMAGE_ICON_UNAVAILABLE"
                }[entity.state]

            } else if (entity.type == "media_player") {

                subtitle = ""
                if (title.length > 11) {
                    title = entity.attributes.friendly_name.substr(0, 11)
                    subtitle = entity.attributes.friendly_name.substr(11)
                }
                icon = {
                    "on": "IMAGE_ICON_MEDIA",
                    "off": "IMAGE_ICON_MEDIA",
                    "unavailable": "IMAGE_ICON_UNAVAILABLE"
                }[entity.state]

            } else {
                console.log(JSON.stringify(entity))
            }

            if (entity.state == "unavailable") { icon = "IMAGE_ICON_UNAVAILABLE" }

            if (filter == "sensor" && sensorConfig.invertSubtitle) {
                title = subtitle
                subtitle = entity.attributes.friendly_name
            }

            console.log("Add entity '" + entity.attributes.friendly_name + "' to list")
            menuPosToEntity.push(entity);

            var o = {
                title: title,
                subtitle: subtitle,
            }
            if (config.enableIcons) { o.icon = icon }
            menuItemArray.push(o);

        }

    }

    mainMenu = new UI.Menu({
        backgroundColor: 'white',
        textColor: 'black',
        highlightBackgroundColor: colour.highlight,
        highlightTextColor: 'white'
    });

    mainMenu.section(0, {
        // title: 'Home Assistant',
        items: menuItemArray
    });

    mainMenu.on('select', function(e) {
        console.log('Short Pressed item #' + e.itemIndex + ' of section #' + e.sectionIndex);
        console.log('Resolved to entity ID ' + menuPosToEntity[e.itemIndex].entity_id);
        itemIndex = e.itemIndex
        var originalSubtitle = e.item.subtitle

        //Entities to NOT replace subtitle with ... on click
        var noElipsis = ["media_player"]
        if (noElipsis.indexOf(getEntityClass(menuPosToEntity[e.itemIndex].entity_id)) == -1) {
            mainMenu.item(0, e.itemIndex, { title: e.item.title, subtitle: '...' });
        }

        //cover, input_boolean, media_player and switch all have filter=switch. Now we need cover to be 'cover' again
        //input_boolean stays as 'switch'
        if (getEntityClass(menuPosToEntity[e.itemIndex].entity_id) == "cover") { filter = "cover" }
        if (getEntityClass(menuPosToEntity[e.itemIndex].entity_id) == "media_player") { filter = "media_player" }


        if (["light", "switch"].indexOf(filter) != -1) {

            hass.toggle(menuPosToEntity[e.itemIndex], function(data, itemIndex) {

                console.log("Got this back: " + JSON.stringify(data))
                for (var i = 0; i < data.length; i++) {
                    var entity = data[i];
                    if (getEntityClass(entity.entity_id) != "group" && entity.entity_id == menuPosToEntity[e.itemIndex].entity_id) {
                        // && entity.entity_id == menuPosToEntity[e.itemIndex]
                        //console.log("Does " + entity.entity_id + " match " + menuPosToEntity[e.itemIndex].entity_id)
                        data = entity;
                        break;
                    }
                }


                var subtitle = data.state
                var icon = e.item.icon
                console.log("---------------------")
                console.log(data)
                if (entity.state == "on" && data.attributes.hasOwnProperty("brightness")) {
                    var bri = parseInt(data.attributes.brightness);
                    bri = bri / 255 * 100;
                    subtitle += " (" + Math.ceil(bri) + "%)"
                }
                if (getEntityClass(entity.entity_id) == "light") {
                    if (entity.state == "on") { icon = "IMAGE_ICON_BULB_ON" }
                    if (entity.state == "off") { icon = "IMAGE_ICON_BULB" }
                }
                if (["switch", "input_boolean"].indexOf(getEntityClass(entity.entity_id)) != -1) {
                    if (entity.state == "on") { icon = "IMAGE_ICON_SWITCH_ON" }
                    if (entity.state == "off") { icon = "IMAGE_ICON_SWITCH_OFF" }
                }

                var o = { title: e.item.title, subtitle: subtitle }
                if (config.enableIcons) { o.icon = icon }
                mainMenu.item(0, e.itemIndex, o);

            }, e.itemIndex)

        } else if (filter == "cover") {

            //Cover returns nothing, so we have to fudge it
            hass.toggle(menuPosToEntity[e.itemIndex], function(data, itemIndex) {
                console.log("Special cover handler")
                console.log("Got this back: " + JSON.stringify(data))

                originalSubtitle = originalSubtitle.toLowerCase();

                if (originalSubtitle == "open") {
                    var subtitle = "closed"
                } else {
                    var subtitle = "open"
                }
                if (subtitle == "open") { icon = "IMAGE_ICON_BLIND_OPEN" }
                if (subtitle == "closed") { icon = "IMAGE_ICON_BLIND_CLOSED" }

                var o = { title: e.item.title, subtitle: subtitle }
                if (config.enableIcons) { o.icon = icon }
                mainMenu.item(0, e.itemIndex, o);

            }, e.itemIndex)

        } else if (filter == "sensor") {

            hass.refresh(menuPosToEntity[e.itemIndex], function(data) {

                console.log("Got this back: " + JSON.stringify(data))
                    //Update cache
                menuPosToEntity[itemIndex] = data
                console.log("Update cache @ " + itemIndex)

                //This code repeats and that's terrible. I should feel bad. Need to fix this later
                var icon = "IMAGE_ICON_SENSOR"
                var subtitle = data.state
                if (data.attributes.hasOwnProperty("device_class") && data.attributes.device_class == "temperature") {
                    icon = "IMAGE_ICON_TEMP"
                }
                if (data.attributes.hasOwnProperty("unit_of_measurement")) {
                    subtitle += " " + data.attributes.unit_of_measurement
                }
                if (data.attributes.hasOwnProperty("device_class")) {
                    if (data.attributes.device_class == "opening") {
                        subtitle = {
                            "on": "Open",
                            "off": "Closed"
                        }[data.state]
                        icon = {
                            "on": "IMAGE_ICON_DOOR_OPEN",
                            "off": "IMAGE_ICON_DOOR_CLOSED"
                        }[data.state]
                    }
                }

                var title = data.attributes.friendly_name

                if (sensorConfig.invertSubtitle) {
                    title = subtitle
                    subtitle = data.attributes.friendly_name
                }

                var o = { title: e.item.title, subtitle: subtitle }
                if (config.enableIcons) { o.icon = icon }
                mainMenu.item(0, e.itemIndex, o);

            })
        } else if (filter == "media_player") {
            console.log("Short press media player")

            showMediaControllerWindow(menuPosToEntity[e.itemIndex])            

        }

    });

    mainMenu.on('longSelect', function(e) {
        if (["cover", "sensor", "switch", "media_player"].indexOf(filter) != -1) {
            var s = menuPosToEntity[e.itemIndex];
            console.log("Cached state: " + JSON.stringify(s))

            //Get non-standard attributes to create the extra data field
            var extraData = "";
            var attrs = s.attributes;
            var standardAttrs = ["friendly_name", "icon", "unit_of_measurement", "device_class", "supported_features", "editable"];
            for (var key in attrs) {
                var value = attrs[key];
                console.log("Check k:" + key + "  v:" + value)

                if (standardAttrs.indexOf(key) == -1) {
                    console.log("OK")

                    var t = typeof value
                    console.log(t)

                    if (["string", "number", "boolean"].indexOf(t) != -1) {
                        extraData += key.replace(/_/g, " ") + ": " + value
                    } else if (t == "object") {
                        //Not sure we'll ever get an object object, so only check for arrays
                        if (Array.isArray(value)) {
                            extraData += key.replace(/_/g, " ") + ": " + value.join(",");
                        }
                    }

                    extraData += "\n"
                    console.log("ed: " + extraData)
                }


            }

            if (s.hasOwnProperty("last_changed")) {
                // extraData += "last changed: " + s.last_changed.split(".")[0].replace("T"," ")
                extraData += "\n" + friendlyLastChanged(s.last_changed)
            }

            var state = getCleanedState(s);
            if (attrs.hasOwnProperty("unit_of_measurement")) { state += " " + attrs.unit_of_measurement }

            showSensorDetailWindow(attrs.friendly_name, state, e.item.icon, extraData);

        } else if (filter == "light") {
            var s = menuPosToEntity[e.itemIndex];
            showLightDetailWindow(s);
        } else {
            console.log("Unimplemented");
        }
    });

    mainMenu.show()

    mainMenu.selection(0, 0);

}

function updateMainMenuEntity(entity) {
    //Call this function when returning to the mainMenu to update the entity state of a specific item
    console.log("Update state of mainMenu entity " + entity.entity_id)
    for (var i = 0; i < menuPosToEntity.length; i++) {
        if (menuPosToEntity[i].entity_id == entity.entity_id) {
            //We have located the position in the menu of the entity to update
            //Determine the data format based on entity type
            console.log("Located menu position of " + entity.entity_id + ": " + i)

            var updateObj = {};
            var etype = getEntityClass(entity.entity_id)

            if (etype == "light") {

                updateObj = {
                    title: entity.attributes.friendly_name,
                    subtitle: entity.state
                }
                if (entity.state == "on" && entity.attributes.hasOwnProperty("brightness")) {
                    var bri = parseInt(entity.attributes.brightness);
                    bri = bri / 255 * 100;
                    updateObj.subtitle += " (" + Math.ceil(bri) + "%)"
                }
                if (config.enableIcons) {
                    if (entity.state == "on") {
                        updateObj.icon = "IMAGE_ICON_BULB_ON"
                    } else {
                        updateObj.icon = "IMAGE_ICON_BULB"
                    }
                }

            }

            //Update menu
            console.log("Update mainMenu index " + i + " to " + JSON.stringify(updateObj))
            mainMenu.item(0, i, updateObj);
            break;

        }
    }
}

function showSensorDetailWindow(_title, _value, _icon, _extraData) {
    wind_sensorDetail = new UI.Window({
        status: {
            color: 'black',
            backgroundColor: 'white',
            seperator: "dotted"
        },
        backgroundColor: "white"
    });

    var titleFont = "gothic_24_bold"
    var titleY = 3
    if (_title.length > 17) {
        titleFont = "gothic_14_bold"
        titleY = 6
    }
    var sensorName = new UI.Text({
        text: _title,
        color: Feature.color(colour.highlight, "black"),
        font: titleFont,
        position: Feature.round(new Vector(10, titleY), new Vector(5, titleY)),
        size: Feature.round(new Vector(160, 30), new Vector(139, 30)),
        textAlign: Feature.round("center", "left")
    });

    if (config.enableIcons) {
        var y = 18;
        if (_title.length > 10) { y = 33 }
        var sensorIcon = new UI.Image({
            position: new Vector(96, y),
            size: new Vector(25, 25),
            compositing: "set",
            backgroundColor: 'transparent',
            image: _icon
        });
    }

    var sensorValue = new UI.Text({
        text: _value,
        color: "black",
        font: Feature.round("gothic_24_bold", "gothic_18_bold"),
        position: Feature.round(new Vector(10, 29), new Vector(5, 30)),
        size: Feature.round(new Vector(160, 25), new Vector(100, 25)),
        textAlign: Feature.round("center", "left")
    });

    if (_extraData != null && _extraData != "") {
        var sensorExtraDeets = new UI.Text({
            text: _extraData,
            color: "black",
            font: "gothic_14",
            position: Feature.round(new Vector(10, 65), new Vector(5, 60)),
            size: Feature.round(new Vector(160, 100), new Vector(139, 100)),
            textAlign: Feature.round("center", "left")
        });
    }

    if (config.enableIcons && Feature.rectangle()) { wind_sensorDetail.add(sensorIcon); }
    if (_extraData != null && _extraData != "") { wind_sensorDetail.add(sensorExtraDeets); }
    wind_sensorDetail.add(sensorValue);
    wind_sensorDetail.add(sensorName);
    wind_sensorDetail.show();
}

function showMediaControllerWindow(mediaPlayer) {

        var is_muted = mediaPlayer.attributes.is_volume_muted

        wind_mediaControl = new UI.Window({
            status: {
                color: 'black',
                backgroundColor: 'white',
                seperator: "dotted"
            },
            backgroundColor: "white",
            action: {
                up: "IMAGE_ICON_VOLUME_UP",
                select: "IMAGE_ICON_PLAYPAUSE",
                down: "IMAGE_ICON_VOLUME_DOWN",
            }
        });
    
        var titleFont = "gothic_24_bold"
        var titleY = 3
        if (mediaPlayer.attributes.friendly_name.length > 17) {
            titleFont = "gothic_14_bold"
            titleY = 6
        }
        var mediaName = new UI.Text({
            text: mediaPlayer.attributes.friendly_name,
            color: Feature.color(colour.highlight, "black"),
            font: titleFont,
            position: Feature.round(new Vector(10, titleY), new Vector(5, titleY)),
            size: Feature.round(new Vector(160, 30), new Vector(129, 30)),
            textAlign: Feature.round("center", "left")
        });
    
        var mediaIcon = new UI.Image({
            position: new Vector(6, 115),
            size: new Vector(25, 25),
            compositing: "set",
            backgroundColor: 'transparent',
            image: "IMAGE_ICON_MEDIA"
        });
        var muteIcon = new UI.Image({
            position: new Vector(9, 80),
            size: new Vector(25, 25),
            compositing: "set",
            backgroundColor: 'transparent',
            image: "IMAGE_ICON_UNMUTED"
        });
        if (mediaPlayer.attributes.is_volume_muted) {
            muteIcon.image("IMAGE_ICON_MUTED");
        }

        var volumePercentLbl = new UI.Text({
            text: "%",
            color: "black",
            font: "gothic_14",
            position: new Vector(Feature.resolution().x - Feature.actionBarWidth() - 30, 80),
            size: new Vector(30,30),
            textAlign: Feature.round("center", "left")
        });

        var progress_bg = new UI.Line({
            position: new Vector(10, 105),
            position2: new Vector(134 - Feature.actionBarWidth(), 105),
            strokeColor: 'black',
            strokeWidth: 5,
        });
        var progress_bg_inner = new UI.Line({
            position: new Vector(10, 105),
            position2: new Vector(134 - Feature.actionBarWidth(), 105),
            strokeColor: 'white',
            strokeWidth: 3,
        });
        var progress_fg = new UI.Line({
            position: new Vector(10, 105),
            position2: new Vector(10, 105),
            strokeColor: 'black',
            strokeWidth: 3,
        });
        progress_fg.maxWidth = 134 - Feature.actionBarWidth()
          

        wind_mediaControl.on('click', 'select', function(e) {
            hass.playPause(mediaPlayer);
        });

        wind_mediaControl.on('longClick', 'select', function(e) {
            hass.toggle(mediaPlayer, function(d) {
                console.log(d)
            })
        });

        wind_mediaControl.on('click', 'up', function(e) {
            hass.volume_up(mediaPlayer, function(d) {
                if (d[0] != null) {
                    refreshMediaProgress(volumePercentLbl, progress_fg, muteIcon, d[0]);
                }
            })
        });

        wind_mediaControl.on('click', 'down', function(e) {
            hass.volume_down(mediaPlayer, function(d) {

                if (d[0] != null) {
                    refreshMediaProgress(volumePercentLbl, progress_fg, muteIcon, d[0]);
                }

            })
        });

        wind_mediaControl.on('longClick', 'down', function(e) {

            console.log("Is muted: " + mediaPlayer.attributes.is_volume_muted)

            if (is_muted) {

                hass.unmute(mediaPlayer, function(d) {
                    if (d[0] != null) {
                        refreshMediaProgress(volumePercentLbl, progress_fg, muteIcon, d[0]);
                    }
                    is_muted = false

                })

            } else {

                
                hass.mute(mediaPlayer, function(d) {
                    if (d[0] != null) {
                        refreshMediaProgress(volumePercentLbl, progress_fg, muteIcon, d[0]);
                    }
                    is_muted = true
                })
            }

        });
    
        
        if (config.enableIcons && Feature.rectangle()) { 
            wind_mediaControl.add(mediaIcon); 
            wind_mediaControl.add(muteIcon)
        }
        // if (extraData != null && extraData != "") { wind_mediaControl.add(mediaExtraDeets); }
        // wind_mediaControl.add(sensorValue);
        wind_mediaControl.add(progress_bg);
        wind_mediaControl.add(progress_bg_inner);
        wind_mediaControl.add(progress_fg);
        wind_mediaControl.add(volumePercentLbl);
        wind_mediaControl.add(mediaName);
        wind_mediaControl.show();
        refreshMediaProgress(volumePercentLbl, progress_fg, muteIcon, mediaPlayer);
}
function refreshMediaProgress(textbox, progress, muteIcon, mediaPlayer) {

    if (mediaPlayer == null) { return }
    
    var x2 = progress.position().x + (parseInt(progress.maxWidth) * parseFloat(mediaPlayer.attributes.volume_level))
    progress.animate('position2', new Vector(x2, progress.position2().y), 500)

    if (mediaPlayer.attributes.is_volume_muted) {
        muteIcon.image("IMAGE_ICON_MUTED");
        textbox.text("");
    } else {
        muteIcon.image("IMAGE_ICON_UNMUTED");
        textbox.text(mediaPlayer.attributes.volume_level.toFixed(2).toString().split(".")[1] + "%");
    }
}


function updateBrightness(entity, brightness) {
    //Do a call and use this code in the callback eventually
    var bri_abs = (255 / 100) * brightness
    if (bri_abs > 254) { bri_abs = 255 }

    wayBack.brightnessChange = entity.entity_id
    console.log("Calling hass to update brightness for " + wayBack.brightnessChange);
    hass.setLightBrightness(entity, bri_abs, function(entities) {
            console.log("Brightness up callback running");
            //We get a list of entities back, find ours.
            for (var i = 0; i < entities.length; i++) {
                var entity = entities[i];
                if (entity.entity_id == wayBack.brightnessChange) {
                    refreshLightDetailUI(entity);
                    break;
                }
            }
        })
        //Hack
        // entity.attributes.brightness = bri_abs

}

function updateTemperature(entity, colorTemp) {
    //Do a call and use this code in the callback eventually
    console.log("Update colour temp to " + colorTemp)
    wayBack.temperatureChange = entity.entity_id

    hass.setLightTemperature(entity, colorTemp, function(entities) {
        console.log("Light temperature change callback running");
        //We get a list of entities back, find ours.
        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            if (entity.entity_id == wayBack.temperatureChange) {
                refreshLightDetailUI(entity);
                break;
            }
        }
    });

    //Hack
    // entity.attributes.color_temp	= colorTemp
    // refreshLightDetailUI(entity)
}

function refreshLightDetailUI(state) {
    console.log("Refresh UI based on state: " + JSON.stringify(state))

    if (!state.attributes.hasOwnProperty("brightness")) { state.attributes.brightness = 0; }


    //Turn absolute brightness back into %
    var bri_perc = Math.ceil((100 / 255) * parseInt(state.attributes.brightness));

    state.meta = {}
    state.meta.supportsRGB = state.attributes.hasOwnProperty("rgb_color");
    state.meta.supportsTemperature = (state.state == "on" && state.attributes.hasOwnProperty("max_mireds"));

    if (state.state == "unavailable") {
        console.log("Entity unavailable")
        state.meta.supportsRGB = false;
        state.meta.supportsTemperature = false;
        state.brightness = 0;
        bri_perc = 0;
        if (config.enableIcons) {
            brightnessUI.icon.image("IMAGE_ICON_UNAVAILABLE");
        }
    } else if (config.enableIcons && state.state == "on") {
        brightnessUI.icon.image("IMAGE_ICON_BULB_ON");
    } else {
        brightnessUI.icon.image("IMAGE_ICON_BULB");
    }

    //The mired range can be huge, we need to calculate 10% for shortclick, 30% for longclick
    if (state.meta.supportsTemperature) {
        var miredRange = state.attributes.max_mireds - state.attributes.min_mireds
        state.meta.miredJumpSmall = Math.floor((miredRange / 100) * 10);
        state.meta.miredJumpLarge = Math.floor((miredRange / 100) * 30);
    }

    //Although lights that support temp always return min/max temp, they don't always return the current temp. Set to 50% space if so.
    if (state.state == "on" && state.meta.supportsTemperature && !state.attributes.hasOwnProperty("color_temp")) {
        state.attributes.color_temp = state.attributes.max_mireds - ((state.attributes.max_mireds - state.attributes.min_mireds) / 2)
    }

    var indicator = {
        0: "IMAGE_MICRO_TICK",
        1: "IMAGE_MICRO_TICK",
        2: "IMAGE_MICRO_TICK"
    }
    indicator[brightnessMenuActiveItem] = "IMAGE_MICRO_TICK_ACTIVE"

    var lineColour = {
        0: "black",
        1: "black",
        2: "black"
    }
    lineColour[brightnessMenuActiveItem] = Feature.color(colour.highlight, "black")

    if (Feature.round()) {
        //Radials
        if (brightnessMenuActiveItem == 0) {
            brightnessUI.radial_brightness.angle2(percentageToRadialAngle(bri_perc))
            brightnessUI.radial_brightness.backgroundColor(colour.highlight)
        } else if (brightnessMenuActiveItem == 1) {
            var tempLineColours = {
                0: "#00AAFF",
                1: "#00AAFF",
                2: "#00FFFF",
                3: "#AAFFFF",
                4: "#FFFFAA",
                5: "#FFFF55",
                6: "#FFFF00",
                7: "#FFAA55"
            }
            var cSpaceW = state.attributes.max_mireds - state.attributes.min_mireds
            var percentageThroughSpace = ((state.attributes.color_temp - state.attributes.min_mireds) / cSpaceW) * 100;
            var bgColorPosition = Math.round(percentageThroughSpace * 0.07)

            brightnessUI.radial_brightness.angle2(percentageToRadialAngle(percentageThroughSpace))
            brightnessUI.radial_brightness.backgroundColor(tempLineColours[bgColorPosition])
        }

        if (state.meta.supportsTemperature) {
            //Unhide control if hidden
            brightnessUI.hide_temperature.backgroundColor("transparent");
            brightnessUI.tick_brightness.compositing("set");
        } else {
            //Hide temperature control. Entity doesn't support it
            brightnessUI.hide_temperature.backgroundColor("white");
            brightnessUI.tick_brightness.compositing("clear");
        }
    } else {
        //Line colours
        brightnessUI.line_brightness.strokeColor(lineColour[0]);
        var tempLineColours = {
            0: "#00AAFF",
            1: "#00FFFF",
            2: "#AAFFFF",
            3: "#FFFFFF",
            4: "#FFFFAA",
            5: "#FFFF55",
            6: "#FFFF00",
            7: "#FFAA55",
        }
        var tempX = 15
        for (var i = 0; i < 8; i++) {
            var lc = "black"
            if (brightnessMenuActiveItem == 1) { lc = Feature.color(tempLineColours[i], "black") }
            brightnessUI["line_temperature_" + i].strokeColor(lc)
        }

        //Update ticks
        brightnessUI.tick_brightness.image(indicator[0])
        brightnessUI.tick_temperature.image(indicator[1])

        //Calc position for slider for brightness
        var tickLeft = 10 + ((125 / 100) * bri_perc);
        brightnessUI.tick_brightness.animate({ position: new Vector(tickLeft, 74) })

        if (state.meta.supportsTemperature) {
            //Unhide control if hidden
            brightnessUI.hide_temperature.backgroundColor("transparent");
            //Calc ticker position for colour temp
            var tickWidth = state.attributes.max_mireds - state.attributes.min_mireds
                // console.log("Calc colourtemp left. Colour space with is " + tickWidth)
            tickLeft = ((state.attributes.color_temp - state.attributes.min_mireds) / tickWidth) * 100;
            // console.log("Therefore, % of color space for " + state.attributes.color_temp + " is " + tickLeft)
            tickLeft = 10 + ((125 / 100) * tickLeft);
            // console.log("Therefore, absolute left is " + tickLeft)
            brightnessUI.tick_temperature.animate({ position: new Vector(tickLeft, 94) })
        } else {
            //Hide temperature control. Entity doesn't support it
            brightnessUI.hide_temperature.backgroundColor("white");
        }

    }

    if (brightnessMenuActiveItem == 0) {
        if (state.state == "unavailable") {
            brightnessUI.lblSelectedState.text("Unavailable");
        } else if (bri_perc < 1 || state.state == "off") {
            brightnessUI.lblSelectedState.text("Off");
        } else {
            brightnessUI.lblSelectedState.text(bri_perc + "%");
        }
        if (Feature.round()) { brightnessUI.tick_brightness.animate({ position: new Vector(70, 147) }) }
    } else if (brightnessMenuActiveItem == 1) {
        //mireds to kelvin
        var kelv = Math.ceil(1000000 / state.attributes.color_temp)
        brightnessUI.lblSelectedState.text(kelv + "K");
        if (Feature.round()) { brightnessUI.tick_brightness.animate({ position: new Vector(102, 147) }) }
    }

    brightnessUI.activeEntity = state
}

function showLightDetailWindow(entity) {

    console.log("=============")
    console.log(JSON.stringify(entity))
    console.log("=============")

    entity.meta = {}
    entity.meta.supportsRGB = entity.attributes.hasOwnProperty("rgb_color");
    entity.meta.supportsTemperature = (entity.state == "on" && entity.attributes.hasOwnProperty("max_mireds"));

    if (entity.state == "unavailable") {
        entity.meta.supportsRGB = false;
        entity.meta.supportsTemperature = false;
        entity.brightness = 0;
    }

    //The mired range can be huge, we need to calculate 10% for shortclick, 30% for longclick
    if (entity.meta.supportsTemperature) {
        var miredRange = entity.attributes.max_mireds - entity.attributes.min_mireds
        entity.meta.miredJumpSmall = Math.floor((miredRange / 100) * 10);
        entity.meta.miredJumpLarge = Math.floor((miredRange / 100) * 30);
    }

    //If it's off we don't get brightness data, so set to zero
    if (!entity.attributes.hasOwnProperty("brightness")) { entity.attributes.brightness = 0; }
    //Turn brightness / 255 into a %
    var brightnessPerc = Math.ceil((100 / 255) * parseInt(entity.attributes.brightness));

    //for brightnessMenuActiveItem: 0 = brightness, 1 = temperature, 2 = colour

    brightnessUI.activeEntity = entity;

    wind_lightDetail = new UI.Window({
        status: Feature.round(false, {
            color: 'black',
            backgroundColor: 'white',
            seperator: "dotted"
        }),
        backgroundColor: "white"
    });

    var windowBg = new UI.Rect({
        backgroundColor: "white",
        position: new Vector(0, 0),
        size: new Vector(144, 168)
    });

    var title = entity.attributes.friendly_name
    var titleFont = "gothic_24_bold"
    if (title.length > 17) { titleFont = "gothic_14_bold" }
    var lightName = new UI.Text({
        text: title,
        color: Feature.color(colour.highlight, "Black"),
        font: titleFont,
        position: new Vector(5, 3),
        size: new Vector(139, 30)
    });
    if (Feature.round()) {
        lightName.position(new Vector(10, 75));
        lightName.size(new Vector(160, 30));
        lightName.textAlign("center")
    }

    if (config.enableIcons) {
        var y = 8;
        if (title.length > 17) { y = 33 }
        brightnessUI.icon = new UI.Image({
            position: new Vector(115, y),
            size: new Vector(25, 25),
            compositing: "set",
            backgroundColor: 'transparent',
            image: "IMAGE_ICON_BULB"
        });
        if (Feature.round()) { brightnessUI.icon.position(new Vector(77.5, 50)) }
    }

    brightnessUI.lblSelectedState = new UI.Text({
        text: "0",
        color: "Black",
        font: "gothic_24_bold",
        position: new Vector(6, 25),
        size: new Vector(139, 30)
    });
    if (Feature.round()) {
        brightnessUI.lblSelectedState.position(new Vector(10, 100))
        brightnessUI.lblSelectedState.size(new Vector(160, 30));
        brightnessUI.lblSelectedState.textAlign("center")
    }


    var indicator = {
        0: "IMAGE_MICRO_TICK",
        1: "IMAGE_MICRO_TICK",
        2: "IMAGE_MICRO_TICK"
    }
    indicator[brightnessMenuActiveItem] = "IMAGE_MICRO_TICK_ACTIVE"

    var lineColour = {
        0: "black",
        1: "black",
        2: "black"
    }
    lineColour[brightnessMenuActiveItem] = Feature.color(colour.highlight, "black")


    if (Feature.round()) {
        brightnessUI.radial_brightness = new UI.Radial({
            position: new Vector(10, 10),
            radius: 5,
            angle: -120,
            angle2: 120,
            // borderColor: 'red',
            // borderWidth: 4,
            backgroundColor: colour.highlight,
            color: 'black',
            size: new Vector(160, 160)
        });
        brightnessUI.tick_brightness = new UI.Image({
            position: new Vector(70, 147),
            size: new Vector(9, 5),
            compositing: "set",
            backgroundColor: 'transparent',
            image: "IMAGE_MICRO_TICK_CHALK"
        });
    } else {
        brightnessUI.line_brightness = new UI.Line({
            position: new Vector(15, 80),
            position2: new Vector(140, 80),
            strokeColor: lineColour[0],
            strokeWidth: 6
        });
        brightnessUI.tick_brightness = new UI.Image({
            position: new Vector(62, 74),
            size: new Vector(9, 5),
            compositing: "set",
            backgroundColor: 'transparent',
            image: indicator[0]
        });
    }

    if (Feature.round()) {

    } else {

        var tempLineColours = {
            0: "#00AAFF",
            1: "#00FFFF",
            2: "#AAFFFF",
            3: "#FFFFFF",
            4: "#FFFFAA",
            5: "#FFFF55",
            6: "#FFFF00",
            7: "#FFAA55",
        }
        var tempX = 15
        for (var i = 0; i < 8; i++) {
            var lc = "black"
            if (brightnessMenuActiveItem == 1) { lc = Feature.color(tempLineColours[i], "black") }

            brightnessUI["line_temperature_" + i] = new UI.Line({
                position: new Vector(tempX, 100),
                position2: new Vector(tempX + 15.625, 100),
                strokeColor: lc,
                strokeWidth: 6
            });

            tempX += 15.625;
        }

        brightnessUI.tick_temperature = new UI.Image({
            position: new Vector(62, 94),
            size: new Vector(9, 5),
            compositing: "set",
            backgroundColor: 'transparent',
            image: indicator[1]
        });

    }

    brightnessUI.icon_brightness = new UI.Image({
        position: Feature.round(new Vector(70, 135), new Vector(2, 75)),
        size: new Vector(10, 10),
        compositing: "set",
        backgroundColor: 'transparent',
        image: "IMAGE_MICRO_BRIGHTNESS"
    });
    brightnessUI.icon_temperature = new UI.Image({
        position: Feature.round(new Vector(100, 135), new Vector(2, 95)),
        size: new Vector(10, 10),
        compositing: "set",
        backgroundColor: 'transparent',
        image: "IMAGE_MICRO_TEMP"
    });
    brightnessUI.hide_temperature = new UI.Rect({
        position: Feature.round(new Vector(60, 125), new Vector(0, 90)),
        size: Feature.round(new Vector(52, 22), new Vector(144, 20))
    });

    brightnessUI.ux_explain = new UI.Text({
        text: Feature.round("(Select to cycle)", "(Press select to cycle)"),
        color: "Black",
        font: "gothic_14",
        position: Feature.round(new Vector(0, 150), new Vector(15, 133)),
        textAlign: Feature.round("center", "left"),
        size: new Vector(180, 30)
    });

    //Add to window
    if (config.enableIcons) { wind_lightDetail.add(brightnessUI.icon); }
    wind_lightDetail.add(lightName);
    wind_lightDetail.add(brightnessUI.lblSelectedState);
    wind_lightDetail.add(brightnessUI.icon_brightness);
    wind_lightDetail.add(brightnessUI.icon_temperature);
    wind_lightDetail.add(brightnessUI.tick_brightness);

    if (Feature.round()) {
        wind_lightDetail.add(brightnessUI.radial_brightness);
    } else {
        wind_lightDetail.add(brightnessUI.line_brightness);
        for (var i = 0; i < 8; i++) {
            wind_lightDetail.add(brightnessUI["line_temperature_" + i]);
        }
        wind_lightDetail.add(brightnessUI.tick_temperature);
    }

    wind_lightDetail.add(brightnessUI.hide_temperature);


    if (config.ux.hasChangedLightOperationsBefore == false && (entity.meta.supportsTemperature)) { wind_lightDetail.add(brightnessUI.ux_explain) }
    wind_lightDetail.show();

    //Get fresh data
    hass.refresh(entity, refreshLightDetailUI);

    //Setup keybindings
    wind_lightDetail.on('click', 'up', function() {
        if (brightnessMenuActiveItem == 0) {
            //Affecting brightness

            var brightnessPerc = Math.ceil((100 / 255) * parseInt(brightnessUI.activeEntity.attributes.brightness));
            brightnessPerc += 20;
            if (brightnessPerc > 100) { brightnessPerc = 100 }
            updateBrightness(entity, brightnessPerc);

        } else if (brightnessMenuActiveItem == 1) {
            //Affecting colour temp

            var ct = brightnessUI.activeEntity.attributes.color_temp
            ct += brightnessUI.activeEntity.meta.miredJumpSmall;
            if (ct > brightnessUI.activeEntity.attributes.max_mireds) { ct = brightnessUI.activeEntity.attributes.max_mireds }
            updateTemperature(entity, ct);

        }
    });
    wind_lightDetail.on('longClick', 'up', function() {
        if (brightnessMenuActiveItem == 0) {
            //Affecting brightness
            var brightnessPerc = Math.ceil((100 / 255) * parseInt(brightnessUI.activeEntity.attributes.brightness));
            brightnessPerc += 50;
            if (brightnessPerc > 100) { brightnessPerc = 100 }
            updateBrightness(entity, brightnessPerc);
        } else if (brightnessMenuActiveItem == 1) {
            var ct = brightnessUI.activeEntity.attributes.color_temp
            ct += brightnessUI.activeEntity.meta.miredJumpLarge;
            if (ct > brightnessUI.activeEntity.attributes.max_mireds) { ct = brightnessUI.activeEntity.attributes.max_mireds }
            updateTemperature(entity, ct);
        }
    });

    wind_lightDetail.on('click', 'down', function() {

        if (brightnessMenuActiveItem == 0) {
            //Affecting brightness

            var brightnessPerc = Math.ceil((100 / 255) * parseInt(brightnessUI.activeEntity.attributes.brightness));
            brightnessPerc -= 20;
            if (brightnessPerc < 0) { brightnessPerc = 0 }
            updateBrightness(entity, brightnessPerc);

        } else if (brightnessMenuActiveItem == 1) {

            console.log("1")
            var ct = brightnessUI.activeEntity.attributes.color_temp
            console.log("2. CT: " + ct)
            console.log("3. mjs: " + brightnessUI.activeEntity.meta.miredJumpSmall)
            ct -= brightnessUI.activeEntity.meta.miredJumpSmall;
            console.log("4")
            if (ct < brightnessUI.activeEntity.attributes.min_mireds) { ct = brightnessUI.activeEntity.attributes.min_mireds }
            console.log("5")
            updateTemperature(entity, ct);

        }
    });
    wind_lightDetail.on('longClick', 'down', function() {

        if (brightnessMenuActiveItem == 0) {
            //Affecting brightness

            var brightnessPerc = Math.ceil((100 / 255) * parseInt(brightnessUI.activeEntity.attributes.brightness));
            brightnessPerc -= 50;
            if (brightnessPerc < 0) { brightnessPerc = 0 }
            updateBrightness(entity, brightnessPerc);

        } else if (brightnessMenuActiveItem == 1) {

            var ct = brightnessUI.activeEntity.attributes.color_temp
            ct -= brightnessUI.activeEntity.meta.miredJumpLarge;
            if (ct < brightnessUI.activeEntity.attributes.min_mireds) { ct = brightnessUI.activeEntity.attributes.min_mireds }
            updateTemperature(entity, ct);

        }
    });

    wind_lightDetail.on('click', 'select', function() {
        brightnessMenuActiveItem += 1;
        if (brightnessUI.activeEntity.meta.supportsTemperature == false && brightnessMenuActiveItem > 0) { brightnessMenuActiveItem = 2 }
        if (brightnessUI.activeEntity.meta.supportsRGB == false && brightnessMenuActiveItem > 1) { brightnessMenuActiveItem = 0 }
        if (brightnessMenuActiveItem > 2) { brightnessMenuActiveItem = 0 }
        if (config.ux.hasChangedLightOperationsBefore == false && brightnessUI.activeEntity.meta.supportsTemperature) {
            config.ux.hasChangedLightOperationsBefore = true;
            brightnessUI.ux_explain.animate({
                position: new Vector(brightnessUI.ux_explain.position()[0], 200)
            }, 1000)
        }
        hass.refresh(entity, refreshLightDetailUI);
    });
    wind_lightDetail.on('longClick', 'select', function() {
        wayBack.toggle = entity.entity_id
        brightnessMenuActiveItem = 0;
        hass.toggle(entity, function(entities) {
                console.log("Toggle callback running");
                //We get a list of entities back, find ours.
                for (var i = 0; i < entities.length; i++) {
                    var entity = entities[i];
                    if (entity.entity_id == wayBack.toggle) {
                        refreshLightDetailUI(entity);
                        break;
                    }
                }
            })
            //Hack);
    });
    wind_lightDetail.on('click', 'back', function() {
        console.log("Back button pressed. Refresh selected entity");
        brightnessMenuActiveItem = 0;
        hass.refresh(entity, updateMainMenuEntity);
        wind_lightDetail.hide();
    });
}

function getCleanedState(entity) {
    var state = entity.state
    if (entity.attributes.hasOwnProperty("device_class")) {
        if (entity.attributes.device_class == "opening") {
            state = {
                "on": "Open",
                "off": "Closed"
            }[entity.state]
        }
    }
    return state
}

function friendlyLastChanged(lc) {
    var then = new Date(lc);
    var now = new Date();
    var delta = now - then;
    var out = 99;
    var units = "??";
    delta = delta / 1000;
    if (delta < 60) {
        out = Math.floor(delta);
        units = "seconds"
    } else if (delta < 3600) {
        out = Math.floor(delta / 60);
        units = "minutes"
        if (out < 2) { units = "minute" }
    } else {
        out = Math.floor(delta / 3600)
        units = "hours"
        if (out < 2) { units = "hour" }
    }
    return out + " " + units + " ago";
}

function percentageToRadialAngle(perc) {
    const totalAngleWidth = 240
    var angleWidth = (totalAngleWidth / 100) * perc
    console.log("AW: " + angleWidth)
    if (angleWidth < 2) { angleWidth = 2 }
    return (-120 + angleWidth)
}