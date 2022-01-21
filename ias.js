const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const e = exposes.presets;
const reporting = require('zigbee-herdsman-converters/lib/reporting');

const device = {
    zigbeeModel: ['IAS001'],
    model: 'Gas Stove Detector',
    vendor: 'KMPCIL',
    description: 'Gas Stove ON/OFF Detector',
    fromZigbee: [fz.ias_smoke_alarm_1, fz.temperature, fz.battery],
    toZigbee: [],
    meta: {disableDefaultResponse: true},
    exposes: [e.smoke(), e.battery_low(), e.temperature(), e.battery()],
    configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(11);
            const binds = ['genPowerCfg', 'msTemperatureMeasurement', 'ssIasZone'];
            await reporting.bind(endpoint, coordinatorEndpoint, binds);
            await reporting.temperature(endpoint);
            const payloadBattery = [{
                attribute: 'batteryPercentageRemaining', minimumReportInterval: 60, maximumReportInterval: 1800, reportableChange: 4}];
            await endpoint.configureReporting('genPowerCfg', payloadBattery);
        },
};

module.exports = device;
