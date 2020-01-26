const Gpio = require('onoff').Gpio;

const pir = new Gpio(4, 'in', 'both');

pir.watch(function(err, value) {
    if (value == 1) {
        console.log('Motion detected');
    } else {
        console.log('Motion stopped');
    }
});