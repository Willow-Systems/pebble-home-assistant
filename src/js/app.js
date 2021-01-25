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
	enableIcons: true,
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

//Global light details page variables
brightnessMenuActiveItem = 0;
brightnessUI = {};

//Find a better solution to this PLEASE
brightnessUpEntityID = null;

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
	// 		"min_mireds": 153,
	// 		"color_temp": 326
  //   },
  //   "context": {
  //     "id": "7d71eeccfb694746a658acf3a1b63776",
  //     "parent_id": null,
  //     "user_id": null
  //   },
  //   "entity_id": "light.wills_office",
  //   "last_changed": "2021-01-23T10:13:49.081544+00:00",
  //   "last_updated": "2021-01-23T10:13:49.081544+00:00",
  //   "state": "on"
  // });


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

function calcBrightnessRectPosition(bri) {
	var res = [144,168];
	var out = {
		x: 0,
		w: res[0]
	};
	out.y = Math.floor(res[1] - ((res[1] / 100) * bri));
	out.h = Math.floor(res[1] - out.y);
	return out
}
function updateBrightness(entity, brightness) {
	//Do a call and use this code in the callback eventually
	var bri_abs = (255 / 100) * brightness
	if (bri_abs > 254) { bri_abs = 255 }

	brightnessUpEntityID = entity.entity_id
	console.log("Calling hass to update brightness for " + brightnessUpEntityID);
	hass.setLightBrightness(entity, bri_abs, function(entities) {
		console.log("Brightness up callback running");
		//We get a list of entities back, find ours.
		for (var i = 0; i < entities.length; i++) {
			var entity = entities[i];
			if (entity.entity_id == brightnessUpEntityID) {
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

	//Hack
	entity.attributes.color_temp	= colorTemp
	refreshLightDetailUI(entity)
}
function refreshLightDetailUI(state) {
	if (! state.attributes.hasOwnProperty("brightness")) { state.attributes.brightness = 0; }

	//Turn absolute brightness back into %
	var bri_perc = Math.ceil((100 / 255) * parseInt(state.attributes.brightness));

	state.meta = {}
	state.meta.supportsRGB = state.attributes.hasOwnProperty("rgb_color");
	state.meta.supportsTemperature = state.attributes.hasOwnProperty("max_mireds");

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

	//Line colours
	brightnessUI.line_brightness.strokeColor(lineColour[0]);
	var tempLineColours = {
		0: "#00AAFF",
		1: "#00FFFF",
		2: "#AAFFFF",
		3: "#FFFFFF",
		4: "#FFFFAA",
		5: "#FFFF55",
		6: "#FFAA55",
		7: "#FFAA00",
	}
	var tempX = 15
	for (var i = 0; i < 8; i++) {
		var lc = "black"
		if (brightnessMenuActiveItem == 1) { lc = Feature.color(tempLineColours[i], "black")	}
		brightnessUI["line_temperature_" + i].strokeColor(lc)
	}

	brightnessUI.tick_brightness.image(indicator[0])
	brightnessUI.tick_temperature.image(indicator[1])

	//Calc position for slider for brightness
	var tickLeft = 10 + ((125 / 100) * bri_perc);
	brightnessUI.tick_brightness.animate({position: new Vector(tickLeft,74)})

	if (state.attributes.hasOwnProperty("max_mireds")) {
		//Calc ticker position for colour temp
		var tickWidth = state.attributes.max_mireds - state.attributes.min_mireds
		// console.log("Calc colourtemp left. Colour space with is " + tickWidth)
		tickLeft = ((state.attributes.color_temp - state.attributes.min_mireds) / tickWidth) * 100;
		// console.log("Therefore, % of color space for " + state.attributes.color_temp + " is " + tickLeft)
		tickLeft = 10 + ((125 / 100) * tickLeft);
		// console.log("Therefore, absolute left is " + tickLeft)
		brightnessUI.tick_temperature.animate({position: new Vector(tickLeft,94)})
	}


	//Update active pointer
	// var pos = {};
	// if (brightnessMenuActiveItem == 0) { pos = brightnessUI.tick_brightness.position() }
	// if (brightnessMenuActiveItem == 1) { pos = brightnessUI.tick_temperature.position() }
	// brightnessUI.active_ticker.animate({
	// 	position: pos
	// },200)


	//Hide indicator tick for active item, update subtitle
	// brightnessUI.tick_brightness.compositing("set");
	// brightnessUI.tick_temperature.compositing("set");
	if (brightnessMenuActiveItem == 0) {
		brightnessUI.lblpercentage.text(bri_perc + "%");
		// brightnessUI.tick_brightness.compositing("and");
	} else if (brightnessMenuActiveItem == 1) {
		//mireds to kelvin
		var kelv = Math.ceil(1000000 / state.attributes.color_temp)
		brightnessUI.lblpercentage.text(kelv + "K");
		// brightnessUI.tick_temperature.compositing("and");
	}

}
function showLightDetailWindow(entity) {

	console.log("=============")
	console.log(JSON.stringify(entity))
	console.log("=============")

	entity.meta = {}
	entity.meta.supportsRGB = entity.attributes.hasOwnProperty("rgb_color");
	entity.meta.supportsTemperature = entity.attributes.hasOwnProperty("max_mireds");

	var brightnessPerc = 75
	//for brightnessMenuActiveItem: 0 = brightness, 1 = temperature, 2 = colour

	wind_lightDetail = new UI.Window({
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

	var bgp = calcBrightnessRectPosition(brightnessPerc);
	console.log(JSON.stringify(bgp));
	brightnessUI.brightnessRect = new UI.Rect({
		backgroundColor: Feature.color(colour.highlight, "#AAAAAA"),
		position: new Vector(bgp.x, bgp.y),
		size: new Vector(bgp.w, bgp.h)
	});

	var title = "Wills Office"
	var titleFont = "gothic_24_bold"
	if (title.length > 17) { titleFont = "gothic_14_bold" }
	var lightName = new UI.Text({
		text: title,
		color: Feature.color(colour.highlight, "Black"),
		font: titleFont,
		position: new Vector(5,3),
		size: new Vector(139,30)
	});

	if (config.enableIcons) {
		var y = 8;
		if (title.length > 17) { y = 33 }
		brightnessUI.icon = new UI.Image({
  		position: new Vector(115, y),
  		size: new Vector(25,25),
			compositing: "set",
    	backgroundColor: 'transparent',
  		image: "IMAGE_ICON_BULB"
		});
	}

	brightnessUI.lblpercentage = new UI.Text({
		text: "75%",
		color: "Black",
		font: "gothic_14_bold",
		position: new Vector(6,32),
		size: new Vector(139,30)
	});

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


	brightnessUI.line_brightness = new UI.Line({
  	position: new Vector(15, 80),
  	position2: new Vector(140, 80),
  	strokeColor: lineColour[0],
		strokeWidth: 2
	});
	brightnessUI.tick_brightness = new UI.Image({
		position: new Vector(62, 74),
	 	size: new Vector(9,5),
		compositing: "set",
	  backgroundColor: 'transparent',
	 	image: indicator[0]
	});
	brightnessUI.icon_brightness = new UI.Image({
		position: new Vector(2, 75),
	 	size: new Vector(10,10),
		compositing: "set",
	  backgroundColor: 'transparent',
	 	image: "IMAGE_MICRO_BRIGHTNESS"
	});


	var tempLineColours = {
		0: "#00AAFF",
		1: "#00FFFF",
		2: "#AAFFFF",
		3: "#FFFFFF",
		4: "#FFFFAA",
		5: "#FFFF55",
		6: "#FFAA55",
		7: "#FFAA00",
	}
	var tempX = 15
	for (var i = 0; i < 8; i++) {
		var lc = "black"
		if (brightnessMenuActiveItem == 1) { lc = Feature.color(tempLineColours[i], "black") }

		brightnessUI["line_temperature_" + i] = new UI.Line({
			position: new Vector(tempX, 100),
			position2: new Vector(tempX + 15.625, 100),
			strokeColor: lc,
			strokeWidth: 2
		});

		tempX += 15.625;
	}

	brightnessUI.tick_temperature = new UI.Image({
		position: new Vector(62, 94),
	 	size: new Vector(9,5),
		compositing: "set",
	  backgroundColor: 'transparent',
	 	image: indicator[1]
	});
	brightnessUI.icon_temperature = new UI.Image({
		position: new Vector(2, 95),
	 	size: new Vector(10,10),
		compositing: "set",
	  backgroundColor: 'transparent',
	 	image: "IMAGE_MICRO_TEMP"
	});

	// brightnessUI.active_ticker = new UI.Image({
	// 	position: new Vector(62, 74),
	// 	size: new Vector(9,6),
	// 	compositing: "set",
	// 	backgroundColor: 'transparent',
	// 	image: "IMAGE_MICRO_TICK_ACTIVE"
	// })


	// brightnessUI.opt_brightness = new UI.Text({
	// 	text: "> Change Brightness",
	// 	color: "Black",
	// 	font: "gothic_14_bold",
	// 	position: new Vector(5,55),
	// 	size: new Vector(139,30)
	// });
	//
	// brightnessUI.opt_temperature = new UI.Text({
	// 	text: "   Change Temperature",
	// 	color: "Black",
	// 	font: "gothic_14",
	// 	position: new Vector(5,75),
	// 	size: new Vector(139,30)
	// });
	//
	// brightnessUI.opt_colour = new UI.Text({
	// 	text: "   Change Colour",
	// 	color: "Black",
	// 	font: "gothic_14",
	// 	position: new Vector(5,95),
	// 	size: new Vector(139,30)
	// });
	//
	brightnessUI.ux_explain = new UI.Text({
		text: "(Press select to cycle)",
		color: "Black",
		font: "gothic_14",
		position: new Vector(15,133),
		size: new Vector(139,30)
	});

	wind_lightDetail.add(windowBg);
	// wind_lightDetail.add(brightnessUI.brightnessRect);
	if (config.enableIcons) { wind_lightDetail.add(brightnessUI.icon); }
	wind_lightDetail.add(lightName);
	wind_lightDetail.add(brightnessUI.lblpercentage);
	wind_lightDetail.add(brightnessUI.line_brightness);
	wind_lightDetail.add(brightnessUI.tick_brightness);
	wind_lightDetail.add(brightnessUI.icon_brightness);
	for (var i = 0; i < 8; i++) {
		wind_lightDetail.add(brightnessUI["line_temperature_" + i]);
	}
	wind_lightDetail.add(brightnessUI.tick_temperature);
	wind_lightDetail.add(brightnessUI.icon_temperature);
	// wind_lightDetail.add(brightnessUI.opt_brightness);
	// wind_lightDetail.add(brightnessUI.opt_temperature);
	// wind_lightDetail.add(brightnessUI.opt_colour);
	if (config.ux.hasChangedLightOperationsBefore == false) { wind_lightDetail.add(brightnessUI.ux_explain) }
	// wind_lightDetail.add(brightnessUI.active_ticker);
	wind_lightDetail.show();
	refreshLightDetailUI(entity);

	wind_lightDetail.on('click', 'up', function() {
  	if (brightnessMenuActiveItem == 0) {
			//Affecting brightness
			brightnessPerc += 20;
			if (brightnessPerc > 100) { brightnessPerc = 100 }
			updateBrightness(entity, brightnessPerc);

		} else if (brightnessMenuActiveItem == 1) {
			//Affecting colour temp
			var ct = entity.attributes.color_temp
			ct += 30;
			console.log("CT: " + ct)
			console.log("Mmr: " + entity.attributes.max_mireds)
			if (ct > entity.attributes.max_mireds) { ct = entity.attributes.max_mireds }
			updateTemperature(entity, ct);

		}
	});
	wind_lightDetail.on('longClick', 'up', function() {
  	if (brightnessMenuActiveItem == 0) {
			//Affecting brightness
			brightnessPerc += 50;
			if (brightnessPerc > 100) { brightnessPerc = 100 }
			updateBrightness(entity, brightnessPerc);
		} else if (brightnessMenuActiveItem == 1) {
			var ct = entity.attributes.color_temp
			ct += 40;
			if (ct > entity.attributes.max_mireds) { ct = entity.attributes.max_mireds }
			updateTemperature(entity, ct);
		}
	});

	wind_lightDetail.on('click', 'down', function() {
  	if (brightnessMenuActiveItem == 0) {
			//Affecting brightness
			brightnessPerc -= 20;
			if (brightnessPerc < 0) { brightnessPerc = 0 }
			updateBrightness(entity, brightnessPerc);
		} else if (brightnessMenuActiveItem == 1) {
			var ct = entity.attributes.color_temp
			ct -= 20;
			if (ct < entity.attributes.min_mireds) { ct = entity.attributes.min_mireds }
			updateTemperature(entity, ct);
		}
	});
	wind_lightDetail.on('longClick', 'down', function() {
  	if (brightnessMenuActiveItem == 0) {
			//Affecting brightness
			brightnessPerc -= 50;
			if (brightnessPerc < 0) { brightnessPerc = 0 }
			updateBrightness(entity, brightnessPerc);
		} else if (brightnessMenuActiveItem == 1) {
			var ct = entity.attributes.color_temp
			ct -= 40;
			if (ct < entity.attributes.min_mireds) { ct = entity.attributes.min_mireds }
			updateTemperature(entity, ct);
		}
	});

	wind_lightDetail.on('click', 'select', function() {
  	brightnessMenuActiveItem += 1;
		if (entity.meta.supportsTemperature == false && brightnessMenuActiveItem > 0) { brightnessMenuActiveItem = 0}
		if (entity.meta.supportsRGB == false && brightnessMenuActiveItem > 1) { brightnessMenuActiveItem = 0}
		if (brightnessMenuActiveItem > 2) { brightnessMenuActiveItem = 0 }
		if (config.ux.hasChangedLightOperationsBefore == false) {
			config.ux.hasChangedLightOperationsBefore = true;
			brightnessUI.ux_explain.animate({
				position: new Vector(15,170)
			}, 1000)
		}
		refreshLightDetailUI(entity);
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
