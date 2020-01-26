const _ = require('lodash');
const Gpio = require('onoff').Gpio;
const v3 = require('node-hue-api').v3, discovery = v3.discovery , hueApi = v3.api, GroupLightState = v3.lightStates.GroupLightState;
const moment = require('moment');
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async/dynamic');

const config = require('./config');

const pir = new Gpio(4, 'in', 'both');

const pirCache = {
    detected: moment(),
};

async function discoverBridge() {
  const discoveryResults = await discovery.nupnpSearch();

  if (discoveryResults.length === 0) {
    console.error('Failed to resolve any Hue Bridges');
    return null;
  } else {
    // Ignoring that you could have more than one Hue Bridge on a network as this is unlikely in 99.9% of users situations
    return discoveryResults[0].ipaddress;
  }
}

async function decideHueLight(args) {
    const { authenticatedApi, kitchen } = args;
    const pirDetected = pir.readSync();
    console.log('PIR state: ' + pirDetected);
    if (pirDetected) {
        pirCache.detected = moment();
    }
    const future = pirCache.detected.clone().add(config.cacheValue, config.cacheUnit);
    if (future.isAfter(moment())) {
        const groupState = new GroupLightState().on().ct(400).brightness(100).transition(config.transitionTime);
        await authenticatedApi.groups.setGroupState(kitchen.id, groupState);
    } else {
        const groupState = new GroupLightState().off().transition(config.transitionTime);
        await authenticatedApi.groups.setGroupState(kitchen.id, groupState);
    }
}

async function discoverAndCreateUser() {
  const ipAddress = await discoverBridge();
  try {
    // Create a new API instance that is authenticated with the new user we created
    const authenticatedApi = await hueApi.createLocal(ipAddress).connect(config.hueUsername);

    // Do something with the authenticated user/api
    const bridgeConfig = await authenticatedApi.configuration.getConfiguration();
    console.log(`Connected to Hue Bridge: ${bridgeConfig.name} :: ${bridgeConfig.ipaddress}`);

    const allGroups = await authenticatedApi.groups.getAll();
    const kitchen = _.find(allGroups, group => group.name === 'Kitchen');
    // pir.watch(async function(err, value) {
    //     if (value == 1) {
    //         console.log('Motion detected');
    //         pirCache.detected = moment();
    //     }
    // });
    setIntervalAsync(async function decide() {
        await decideHueLight({ authenticatedApi, kitchen });
    }, 1000);
  } catch(err) {
    if (err.getHueErrorType() === 101) {
      console.error('The Link button on the bridge was not pressed. Please press the Link button and try again.');
    } else {
      console.error(`Unexpected Error: ${err.message}`);
    }
  }
}

// Invoke the discovery and create user code
discoverAndCreateUser();