'use strict'

const fs            = require('fs');
const {SMTPServer}  = require('smtp-server');
const simpleParser  = require('mailparser').simpleParser;
const mqtt          = require('mqtt');
const config        = JSON.parse(fs.readFileSync('/data/options.json', 'utf8'));
const deviceId      = config.device_id || '0';
const mqttUrl       = config.mqtt_url || 'mqtt://core-mosquitto:1883';
const mqttOptions   = {
                       clientId: config.mqtt_clientId || 'smtp2mqtt',
                       username: config.mqtt_username,
                       password: config.mqtt_password
                      }
const smtpPort      = config.smtp_port || 25;
const smtpHost      = config.smtp_host || '0.0.0.0';
//const smtp_username      = config.smtp_username || 'username';
//const smtp_password      = config.smtp_password || 'password';
const mediaPath     = config.media_path || '/media';
const deviceInfo    = { "name": "Yoosee Doorbell SD-05",                                    
                        "manufacturer": "Yoosee", 
                        "model": "SD-05",
                        "identifiers": deviceId, 
                        "sw_version": "13.0.5"
                      };

const smtp = new SMTPServer({
    secure: false,
    disabledCommands: ['STARTTLS'],
    //onConnect,
    onAuth,
    //onMailFrom,
    //onRcptTo,
    onData,
    //onClose,
    authOptional: true
});

smtp.listen(smtpPort, smtpHost, () => {
    console.log('Mail server started at %s:%s', smtpHost, smtpPort);
    // mqtt discovery
    let mqttClient = mqtt.connect(mqttUrl, mqttOptions);
    mqttClient.on('connect', function () {
        var doorbellButton = {
                              "name": "Doorbell Button",
                              "unique_id": "doorbell_" + deviceId,
                              "device": deviceInfo,
                              "state_topic": "smtp2mqtt/doorbell/" + deviceId + "/state",
                              "off_dly": "5",
                              "pl_on": "ON",
                              "pl_off": "OFF",
                              "value_template": "{{ value_json.bell }}"
                              };
        mqttClient.publish('homeassistant/binary_sensor/doorbell/' + deviceId + '/config', JSON.stringify(doorbellButton), { qos:0, retain: true });
        var doorbellFilename = {
                              "name": "Doorbell Snapshot Filename",
                              "unique_id": "doorbell_" + deviceId,
                              "device": deviceInfo,
                              "state_topic": "smtp2mqtt/doorbell/" + deviceId + "/state",
                              "value_template": "{{ value_json.filename }}"
                              };
        mqttClient.publish('homeassistant/sensor/doorbell/' + deviceId + '/config', JSON.stringify(doorbellFilename), { qos:0, retain: true });
        var doorbellCamera = {
                              "name": "Doorbell Camera Snapshot",
                              "unique_id": "doorbell_" + deviceId,
                              "topic": "smtp2mqtt/doorbell/" + deviceId + "/snapshot",
                              "device": deviceInfo
                              };
        mqttClient.publish('homeassistant/camera/doorbell/' + deviceId + '/config', JSON.stringify(doorbellCamera), { qos: 0, retain: true });
        mqttClient.end();
    });
});

// Обработка данных письма
function onData(stream, session, callback) {
    simpleParser(stream).then(function(mail_object) {
        //console.log("From:", mail_object.from.value);
        //console.log("Subject:", mail_object.subject);
        for (let i in mail_object.attachments) {
            let attachment = mail_object.attachments[i];
            if(attachment.size !== 0){
                let fileName = mediaPath + '/' + attachment.filename;
                fs.writeFile(fileName, attachment.content, function(error) {
                    if(error) console.log('An error occurred:', error);
                    //callback(new Error(`Writing file with error: ${error}`));
                    console.log("Somebody bell in door. Picture saved in file:", fileName);
                });
                var mqttSensorData = {
                                      "bell": "ON",
                                      "filename": attachment.filename
                                      };
                var mqttCameraData = Buffer.from(attachment.content, 'utf-8'); // В буфере изображение 
                let mqttClient = mqtt.connect(mqttUrl, mqttOptions);
                mqttClient.on('connect', function() {
                    mqttClient.publish('smtp2mqtt/doorbell/' + deviceId + '/state', JSON.stringify(mqttSensorData), { qos: 0 });
                    mqttClient.publish('smtp2mqtt/doorbell/' + deviceId + '/snapshot', mqttCameraData, { qos: 0 });
                    mqttClient.end();
                });
            }
        }
    }).catch(function(error) {
        console.log('An error occurred:', error.message);
    });
    callback();
};

// Проверка авторизации
function onAuth(auth, session, callback) {
/*  Будет реализована в следующих релизах
    if (config.anonymous === true && (auth.username !== smtp_username || auth.password !== smtp_password)) {
      return callback(new Error("Invalid username or password"));
    }*/
      return callback(null, { user: 123 /* auth.username */ });
  }

// Валидация получателя. Для каждого адреса функция вызывается отдельно.
function onRcptTo({address}, session, callback) {
    if (address.startsWith('mqtt@')) {
        callback(new Error(`Address ${address} is not allowed receiver`));
    }
    else {
        callback();
    }
}

// Валидация отправителя
function onMailFrom({address}, session, callback) {
    if (address.startsWith('doorbell@')) {
        callback();
    }
    else {
        callback(new Error(`Address ${address} is not allowed.`));
    }
}

// Подключаемся к mqtt при коннекте к smtp
function onConnect(session, callback) {
        callback();
    };
