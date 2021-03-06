'use strict';

let findTargetTemperature = function (aDevice, opts) {
    let targetTemp = opts && opts.target_temperature ? opts.target_temperature : undefined;
    if (!targetTemp) {
        targetTemp = aDevice.getCapabilityValue('target_temperature');
    }
    if (!targetTemp) {
        aDevice.log('no target_temperature defined');
    } else {
        aDevice.log('target temperature', targetTemp);
    }
    return targetTemp;
};

let findTemperature = async function (aDevice, zoneId, devices) {
    let sumTemp = 0;
    let numTemp = 0;
    for (let device in devices) {
        let d = devices[device];
        if (d.zone === zoneId &&
            d.class === 'sensor' &&
            d.capabilitiesObj &&
            d.capabilitiesObj.measure_temperature) {
            sumTemp += d.capabilitiesObj.measure_temperature.value;
            numTemp++;
        }
    }
    if (numTemp === 0) {
        await aDevice.setCapabilityValue('measure_temperature', null).catch(console.error);
        aDevice.log('no temperature sensor in zone', zoneId);
        return;
    }
    let temperature = sumTemp / numTemp;
    let currentTemperature = aDevice.getCapabilityValue('measure_temperature');
    if (currentTemperature === undefined || currentTemperature === null || currentTemperature !== temperature) {
        await aDevice.setCapabilityValue('measure_temperature', temperature).catch(console.error);
        aDevice.log('trigged temperature change', temperature);
    }
    aDevice.log('temperature', temperature);
    return temperature;
};

let switchHeaterDevices = async function (aDevice, zoneId, devices, onoff) {
    if (onoff !== undefined) {
        if (aDevice.getCapabilityValue('vt_onoff') !== onoff) {
            try {
                aDevice.setCapabilityValue('vt_onoff', onoff);
            } catch (error) {
                aDevice.log('error setting vt_onoff', error);
            }
            if (onoff) {
                aDevice._turnedOnTrigger.trigger(aDevice);
                aDevice.log('trigged thermostat turned on');
            } else {
                aDevice._turnedOffTrigger.trigger(aDevice);
                aDevice.log('trigged thermostat turned off');
            }
        }

        try {
            for (let device in devices) {
                let d = devices[device];
                if (d.zone === zoneId &&
                    (d.class === 'heater' || d.virtualClass === 'heater') &&
                    d.capabilitiesObj &&
                    d.capabilitiesObj.onoff.value !== onoff) {
                    d.setCapabilityValue('onoff', onoff)
                        .then(resp => {
                            aDevice.log(`${d.name} set to ${onoff}`);
                        })
                        .catch(err => {
                            aDevice.log(`${d.name}: error switching`, err);
                        });
                }
            }
        } catch (error2) {
            aDevice.log(`error switching`, error2);
        }
    }
    return {
        onoff: onoff,
        device: aDevice
    };
};

let hasContactAlarm = function (aDevice, zoneId, devices, settings) {
    if (settings.contact_alarm === true) {
        for (let device in devices) {
            let d = devices[device];
            if (d.zone === zoneId &&
                (d.class === 'sensor') &&
                d.capabilitiesObj &&
                d.capabilitiesObj.alarm_contact &&
                d.capabilitiesObj.alarm_contact.value === true) {
                return true;
            }
        }
    }
    return false;
};

let resolveOnoff = function (aDevice, temperature, targetTemp, settings, opts, contactAlarm) {
    let mainOnoff = aDevice.hasCapability('onoff') ?
        (opts && opts.onoff !== undefined ? opts.onoff : aDevice.getCapabilityValue('onoff')) : true;

    let onoff = undefined;
    if (contactAlarm || !mainOnoff) {
        onoff = aDevice.getCapabilityValue('vt_onoff') === true ? false : undefined;
    } else {
        let hysteresis = settings.hysteresis || 0.5;
        let invert = settings.invert;
        if (temperature > (targetTemp + hysteresis)) {
            onoff = invert === true;
        } else if (temperature < (targetTemp - hysteresis)) {
            onoff = invert !== true;
        }
    }
    return onoff;
};

module.exports = {
    findTargetTemperature: findTargetTemperature,
    findTemperature: findTemperature,
    hasContactAlarm: hasContactAlarm,
    switchHeaterDevices: switchHeaterDevices,
    resolveOnoff: resolveOnoff
};
