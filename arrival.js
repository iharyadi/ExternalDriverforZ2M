const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const e = exposes.presets;
const reporting = require('zigbee-herdsman-converters/lib/reporting');

const {
    precisionRound, mapNumberRange, isLegacyEnabled, toLocalISOString, 
    numberWithinRange, hasAlreadyProcessedMessage,
    calibrateAndPrecisionRoundOptions, addActionGroup, postfixWithEndpointName, 
    getKey,batteryVoltageToPercentage, getMetaValue,
} = require('zigbee-herdsman-converters/lib/utils');
const tuya = require('zigbee-herdsman-converters/lib/tuya');
const globalStore = require('zigbee-herdsman-converters/lib/store');
const constants = require('zigbee-herdsman-converters/lib/constants');
const libColor = require('zigbee-herdsman-converters/lib/color');
const utils = require('zigbee-herdsman-converters/lib/utils');

const myoptions = {
	options:{
	presence_timeout_dc: () => { return exposes.numeric('presence_timeout_dc').withValueMin(60).withDescription('Time in seconds after which presence is cleared after detecting it (default 60 seconds) while in DC.');},
	 presence_timeout_battery: () => { return exposes.numeric('presence_timeout_battery').withValueMin(120).withDescription('Time in seconds after which presence is cleared after detecting it (default 420 seconds) while in Battery.');},
	},
};

function handlePresence(model, msg, publish, options, meta) {
        const useOptionsTimeout_battery = options && options.hasOwnProperty('presence_timeout_battery');
        const timeout_battery = useOptionsTimeout_battery ? options.presence_timeout_battery : 420; // 100 seconds by default

        const useOptionsTimeout_dc = options && options.hasOwnProperty('presence_timeout_dc');
        const timeout_dc = useOptionsTimeout_dc ? options.presence_timeout_dc : 60;

        const mode = meta.state? meta.state['power_state'] : false;

        const timeout =  mode ?  timeout_dc : timeout_battery;
            // Stop existing timer because motion is detected and set a new one.
        clearTimeout(globalStore.getValue(msg.endpoint, 'timer'));
        const timer = setTimeout(() => publish({presence: false}), timeout * 1000);
        globalStore.putValue(msg.endpoint, 'timer', timer);

	return {presence:true};
};

const myconverters = {
    STS_PRS_251_binary_input: {
        cluster: 'genBinaryInput',
        type: ['attributeReport', 'readResponse'],
        convert: (model, msg, publish, options, meta) => {
	    const payload = handlePresence(model, msg, publish, options, meta);
            if (msg.data.hasOwnProperty('presentValue')) {
              const presentValue =  msg.data['presentValue']
              payload.power_state = (presentValue & 0x01)> 0;
              payload.occupancy = (presentValue & 0x04) > 0;
              payload.vibration = (presentValue & 0x02) > 0;
	    }
	    return payload;
	},
    },
    STS_PRS_251_power_presence: {
        cluster: 'genPowerCfg',
        type: ['attributeReport', 'readResponse'],
        options: [myoptions.options.presence_timeout_dc(),myoptions.options.presence_timeout_battery()],
        convert: (model, msg, publish, options, meta) => {
            const payload = handlePresence(model, msg, publish, options, meta);
	    if (msg.data.hasOwnProperty('batteryVoltage')) {
                // Deprecated: voltage is = mV now but should be V
                payload.voltage = msg.data['batteryVoltage'] * 100;

                if (model.meta && model.meta.battery && model.meta.battery.voltageToPercentage) {
                    payload.battery = batteryVoltageToPercentage(payload.voltage, model.meta.battery.voltageToPercentage);
                }
            }
            return payload;
        },
    },
};


const device = {
	zigbeeModel: ['tagv1'],
        model: 'KMPCIL-tag-001',
        vendor: 'KMPCIL',
        description: 'Arrival sensor',
        fromZigbee: [myconverters.STS_PRS_251_power_presence, myconverters.STS_PRS_251_binary_input, fz.temperature],
        exposes: [e.battery(), e.presence(), exposes.binary('power_state',exposes.access.STATE,true,false), e.occupancy(), e.vibration(), e.temperature()],
        toZigbee: [],
        meta: {battery: {voltageToPercentage: '3V_1500_2800'},},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            for (const cluster of ['msTemperatureMeasurement','genPowerCfg', 'genBinaryInput']){
               await utils.sleep(2000);
               await endpoint.bind(cluster, coordinatorEndpoint);
            }

            await utils.sleep(1000);
	    const p = reporting.payload('batteryVoltage', 0, 10, 1);
            await endpoint.configureReporting('genPowerCfg', p);	    
           
            await utils.sleep(1000);
            const p2 = reporting.payload('presentValue', 0, 300, 1);
            await endpoint.configureReporting('genBinaryInput', p2);
            
            await utils.sleep(1000);
	    await reporting.temperature(endpoint);
	    await endpoint.read('genBinaryInput', ['presentValue']);
        },
};

module.exports = device;
