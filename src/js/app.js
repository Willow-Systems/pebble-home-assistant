var UI = require('ui');
var ajax = require('ajax');
var Wakeup = require('wakeup');
var Settings = require('settings');
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

function getEntityClass(entity_id) {
	return entity_id.split(".")[0];
}


//Pebble.addEventListener('ready', function() {
	console.log("Lets Go!");

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

//});

function renderStatesMenu(data, filter) {
	console.log("Filter: " + filter);
	var menuPosToID = [];
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
				subtitle = entity.state

				if (entity.attributes.hasOwnProperty("device_class")) {
					if (entity.attributes.device_class == "opening") {
						subtitle = {
							"on": "Open",
							"off": "Closed"
						}[entity.state]

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
			menuPosToID.push(entity);

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
  	console.log('Long Pressed item #' + e.itemIndex + ' of section #' + e.sectionIndex);
  	console.log('The item is titled "' + e.item.title + '"');
		console.log('Resolved to entity ID ' + menuPosToID[e.itemIndex].entity_id);
		mainMenu.item(0, e.itemIndex, { title: e.item.title, subtitle: '...' });

		if (["light","switch"].indexOf(filter) != -1) {

			hass.toggle(menuPosToID[e.itemIndex], function(data, itemIndex) {

				console.log("Got this back: " + JSON.stringify(data))
				for (var i = 0; i < data.length; i++) {
				var entity = data[i];
				if (getEntityClass(entity.entity_id) != "group" && entity.entity_id == menuPosToID[e.itemIndex].entity_id) {
					// && entity.entity_id == menuPosToID[e.itemIndex]
					// console.log("Does " + entity.entity_id + " match " + menuPosToID[e.itemIndex].entity_id)
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

			hass.refresh(menuPosToID[e.itemIndex], function(data, itemIndex) {

				console.log("Got this back: " + JSON.stringify(data))

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

			}, e.itemIndex)
		}

	});

	mainMenu.on('longSelect', function(e) {
		console.log("Unimplemented");
	});

	mainMenu.show()

	mainMenu.selection(0, 0);

}
