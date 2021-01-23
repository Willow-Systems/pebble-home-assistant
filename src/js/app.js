var UI = require('ui');
var ajax = require('ajax');
var Wakeup = require('wakeup');
var Settings = require('settings');
var Vector = require('vector2');
var Feature = require('platform/feature');
var Platform = require('platform');
var hass = require('./hass.js');

var entityTypeWhitelist = ["light"];
var entityBlacklist = [
	"light.configuration_tool_1",
	"light.wut",
	"switch.boathouse_lamp",
	"light.bedroom_2"
];

var config = {
	showLights: true,
	showSwitches: true,
	showSensors: true,
	showAutomations: false,
	enableIcons: true
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
		"sensor.minecraft_server_players_online"
	],
	invertSubtitle: false
}

var colour = {
	highlight: Feature.color("#00AAFF","#AAAAAA")
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


function getEntityClass(entity_id) {
	return entity_id.split(".")[0];
}


//Pebble.addEventListener('ready', function() {
	console.log("Lets Go!");
	go();


function go() {

	if (Platform.version() == "aplite") {
		console.log("Platform is aplite and icons make it sad. Disabling")
		config.enableIcons = false;
	}

	var homeItems = [];
	if (config.showLights) { homeItems.push({ title: "Lights" }) }
	if (config.showSwitches) { homeItems.push({ title: "Switches" }) }
	if (config.showSensors) { homeItems.push({ title: "Sensors" }) }
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

	// console.log(JSON.stringify(data))

	for (var i = 0; i < data.length; i++) {

		var entity = data[i];
		entity.type = getEntityClass(entity.entity_id);

		//The almighty entity parser

		if (entity.type.indexOf(filter) != -1 && entityBlacklist.indexOf(entity.entity_id) == -1) {

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
					subtitle += " (" + Math.floor(bri) + "%)"
				}

			} else if (entity.type == "switch") {

				icon = "IMAGE_ICON_SWITCH_OFF"
				if (entity.state == "on") { icon = "IMAGE_ICON_SWITCH_ON" }
				subtitle = entity.state

			}	else if (entity.type == "sensor") {

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

			} else {
				console.log(JSON.stringify(entity))
			}


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
			if (config.enableIcons) {	o.icon = icon	}
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
		mainMenu.item(0, e.itemIndex, { title: e.item.title, subtitle: '...' });

		if (["light","switch"].indexOf(filter) != -1) {

			hass.toggle(menuPosToEntity[e.itemIndex], function(data, itemIndex) {

				console.log("Got this back: " + JSON.stringify(data))
				for (var i = 0; i < data.length; i++) {
				var entity = data[i];
				if (getEntityClass(entity.entity_id) != "group" && entity.entity_id == menuPosToEntity[e.itemIndex].entity_id) {
					// && entity.entity_id == menuPosToEntity[e.itemIndex]
					// console.log("Does " + entity.entity_id + " match " + menuPosToEntity[e.itemIndex].entity_id)
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
				subtitle += " (" + Math.floor(bri) + "%)"
			}
				if (getEntityClass(entity.entity_id) == "light") {
				if (entity.state == "on") { icon = "IMAGE_ICON_BULB_ON" }
				if (entity.state == "off") { icon = "IMAGE_ICON_BULB" }
			}
				if (getEntityClass(entity.entity_id) == "switch") {
				if (entity.state == "on") { icon = "IMAGE_ICON_SWITCH_ON" }
				if (entity.state == "off") { icon = "IMAGE_ICON_SWITCH_OFF" }
			}

				var o = { title: e.item.title, subtitle: subtitle }
				if (config.enableIcons) {	o.icon = icon	}
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
				if (config.enableIcons) {	o.icon = icon	}
				mainMenu.item(0, e.itemIndex, o);

			})
		}

	});

	mainMenu.on('longSelect', function(e) {
		if (filter == "sensor") {
			var s = menuPosToEntity[e.itemIndex];
			console.log("Cached state: " + JSON.stringify(s))

			//Get non-standard attributes to create the extra data field
			var extraData = "";
			var attrs = s.attributes;
			var standardAttrs = ["friendly_name","icon","unit_of_measurement","device_class"];
			for (var key in attrs) {
				var value = attrs[key];
				console.log("Check k:" + key + "  v:" + value)

				if (standardAttrs.indexOf(key) == -1) {
					console.log("OK")

					var t = typeof value
					console.log(t)

					if (["string","number","boolean"].indexOf(t) != -1) {
						extraData += key.replace(/_/g," ") + ": " + value
					} else if (t == "object") {
						//Not sure we'll ever get an object object, so only check for arrays
						if (Array.isArray(value)) {
							extraData += key.replace(/_/g," ") + ": " + value.join(",");
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

		} else {
			console.log("Unimplemented");
		}
	});

	mainMenu.show()

	mainMenu.selection(0, 0);

}

function showSensorDetailWindow(_title, _value, _icon, _extraData) {
	wind_sensorDetail = new UI.Window({
		status: {
	    color: 'black',
    	backgroundColor: 'white',
			seperator: "dotted"
  	}
	});
	var windowBg = new UI.Rect({
		backgroundColor: "white",
		position: new Vector(0,0),
		size: new Vector(144,168)
	});

	var titleFont = "gothic_24_bold"
	if (_title.length > 17) { titleFont = "gothic_14_bold" }
	var sensorName = new UI.Text({
		text: _title,
		color: Feature.color(colour.highlight, "black"),
		font: titleFont,
		position: new Vector(5,3),
		size: new Vector(139,30)
	});

	if (config.enableIcons) {
		var y = 18;
		if (_title.length > 11) { y = 33 }
		var sensorIcon = new UI.Image({
  		position: new Vector(96, y),
  		size: new Vector(25,25),
			compositing: "set",
    	backgroundColor: 'transparent',
  		image: _icon
		});
	}

	var sensorValue = new UI.Text({
		text: _value,
		color: "black",
		font: "gothic_18_bold",
		position: new Vector(5,30),
		size: new Vector(100,25)
	});

	if (_extraData != null && _extraData != "") {
		var sensorExtraDeets = new UI.Text({
			text: _extraData,
			color: "black",
			font: "gothic_14",
			position: new Vector(5,60),
			size: new Vector(139,100)
		});
	}

	wind_sensorDetail.add(windowBg);
	if (config.enableIcons) { wind_sensorDetail.add(sensorIcon); }
	if (_extraData != null && _extraData != "") { wind_sensorDetail.add(sensorExtraDeets); }
	wind_sensorDetail.add(sensorValue);
	wind_sensorDetail.add(sensorName);
	wind_sensorDetail.show();
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
	var out = 99;	var units = "??";
	delta = delta / 1000;
	if (delta < 60) {
		out = Math.floor(delta);
		units = "seconds"
	} else if (delta < 3600) {
		out = Math.floor(delta / 60);
		units = "minutes"
		if (out < 2) { units = "minute"	}
	} else {
		out = Math.floor(delta / 3600)
		units = "hours"
		if (out < 2) { units = "hour" }
	}
	return out + " " + units + " ago";
}
