const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const e = exposes.presets;
const reporting = require('zigbee-herdsman-converters/lib/reporting');

const device = {
    zigbeeModel: ['RTD100'],
    model: 'Fireplace Switch',
    vendor: 'KMPCIL',
    description: 'to control milivolt fireplace',
    fromZigbee: [fz.on_off, fz.battery, fz.temperature],
    toZigbee: [tz.on_off],
    meta: {disableDefaultResponse: true},
    exposes: [e.switch(),e.battery(), e.temperature()],
    configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(10);
            const binds = ['genPowerCfg', 'msTemperatureMeasurement', 'genOnOff'];
            await reporting.bind(endpoint, coordinatorEndpoint, binds);
            await reporting.temperature(endpoint);
            const payloadBattery = [{
                attribute: 'batteryPercentageRemaining', minimumReportInterval: 60, maximumReportInterval: 1800, reportableChange: 4}];
            await endpoint.configureReporting('genPowerCfg', payloadBattery);
            await reporting.onOff(endpoint);
        },
};

module.exports = device;
