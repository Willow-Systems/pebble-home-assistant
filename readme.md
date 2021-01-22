# Rain Alert
![](https://img.shields.io/badge/Release_Status-Early_Alpha-cc4444.svg)    

Creates timeline pins just as the rain is about to pour

## About
Rain alert runs once an hour and checks the rain for the rest of the day. If it's due to rain later Rain Alert will create a timeline pin at that point

## Beta roadmap checklist

- [x] Get location of pebble
- [x] Get weather information from darkSkyApi
- [x] Parse weather to work out when pins are needed
- [x] Create a wakeup event an hour later to check again
- [ ] Actually create the timeline pin (This will be done last to avoid spamming pins)
- [ ] Programatically create the timeline pin id per-user (based on pebble serial and time)
- [X] Make the UI nicer
- [ ] Implement settings page (for API Key and location override)
- [ ] Add a first run screen
- [X] Only run the weather-pin-check when the app is started from a wakeup event
- [X] Add toggle when the app is opened from the app menu

## Build the Alpha

The only way to install *Rain Alert* at the moment is to compile it youself with your darksky api key. No timeline pins will actually be created.

Clone the git repo and set the value of the variable `darkSkyApiKey` to your API key. Then build locally using the `pebble build` command and side load to your watch.

## Authors

Idea by @Wowfunhappy   
Code by @Wowfunhappy & @Will0
