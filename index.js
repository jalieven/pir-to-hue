const Gpio = require('onoff').Gpio;
const Hue = require('node-hue-api').v4;
const { discovery, api } = Hue;

const pir = new Gpio(4, 'in', 'both');

const appName = 'pir-to-hue';
const deviceName = 'c3po';

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

async function discoverAndCreateUser() {
  const ipAddress = await discoverBridge();

  // Create an unauthenticated instance of the Hue API so that we can create a new user
  const unauthenticatedApi = await api.createLocal(ipAddress).connect();

  let createdUser;
  try {
    createdUser = await unauthenticatedApi.users.createUser(appName, deviceName);
    console.log('*******************************************************************************\n');
    console.log('User has been created on the Hue Bridge. The following username can be used to\n' +
                'authenticate with the Bridge and provide full local access to the Hue Bridge.\n' +
                'YOU SHOULD TREAT THIS LIKE A PASSWORD\n');
    console.log(`Hue Bridge User: ${createdUser.username}`);
    console.log(`Hue Bridge User Client Key: ${createdUser.clientkey}`);
    console.log('*******************************************************************************\n');

    // Create a new API instance that is authenticated with the new user we created
    const authenticatedApi = await api.createLocal(ipAddress).connect(createdUser.username);

    // Do something with the authenticated user/api
    const bridgeConfig = await authenticatedApi.configuration.get();
    console.log(`Connected to Hue Bridge: ${bridgeConfig.name} :: ${bridgeConfig.ipaddress}`);

    const allGroups = await authenticatedApi.groups.getAll();
    allGroups.forEach(group => {
        console.log(group.toStringDetailed());
    });

    pir.watch(function(err, value) {
        if (value == 1) {
            console.log('Motion detected');
            // const groupState = new GroupLightState().on().brightness(20).saturation(50);
            // await authenticatedApi.groups.setGroupState(GROUP_ID, groupState);
        } else {
            console.log('Motion stopped');
            // const groupState = new GroupLightState().off();
            // await authenticatedApi.groups.setGroupState(GROUP_ID, groupState);
        }
    });

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