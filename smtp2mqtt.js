'use strict'

const deviceId      = '18483494' // Uniq device id, change it!!!
const fs            = require('fs');
const {SMTPServer}  = require('smtp-server');
const simpleParser  = require('mailparser').simpleParser;
const mqtt          = require('mqtt');
const config        = JSON.parse(fs.readFileSync('/data/options.json', 'utf8'));
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
const networkInfo   = { "mac": "00:00:00"
                      };
const deviceInfo     = { "name": "Yoosee Doorbell SD-05".                                      
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
        var doorbellButton = {"name": "Doorbell Button",
                              "unique_id": "doorbell_" + deviceId,
                              "device": deviceInfo,
                              "state_topic": "smtp2mail/binary_sensor/doorbell/" + deviceId + "/state",
                              "off_dly": 5,
                              "pl_on": "bell",
                              "pl_off": "idle"
                              };
        console.log(doorbellButton);
        var doorbellCamera = {
                           "name": "Doorbell Camera Capture",
                           "topic": "smtp2mqtt/camera/doorbell/" + deviceId + "/capture",
                           "unique_id": "doorbell_" + deviceId,
                           "device": deviceInfo
                           };
        console.log(doorbellCamera);
        mqttClient.publish('homeassistant/binary_sensor/doorbell/' + deviceId + '/config', JSON.stringify(doorbellButton), { qos: 0 });
        mqttClient.publish('homeassistant/camera/doorbell/' + deviceId + '/config', JSON.stringify(doorbellCamera), { qos: 0 });
        mqttClient.end();
        console.log('mqtt discovery send.');
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
                let data = attachment.content;
                let fileName = mediaPath + '/' + attachment.filename;
                fs.writeFile(fileName, data, function(error) {
                    if(error) console.log('An error occurred:', error);
                    //callback(new Error(`Writing file with error: ${error}`));
                    console.log("Somebody bell in door. Photo saved in file:", fileName);
                });
                var buff = Buffer.from(data, 'utf-8');
                //let base64Data = buff.toString('base64');
                //console.log(base64Data);
                let mqttClient = mqtt.connect(mqttUrl, mqttOptions);
                mqttClient.on('connect', function() {
                    //console.log('Sending messages in mqtt.');
                    mqttClient.publish('smtp2mqtt/binary_sensor/doorbell/' + deviceId + '/state', 'bell', { qos: 0 });
                    mqttClient.publish('smtp2mqtt/camera/doorbell/' + deviceId + '/capture', buff, { qos: 0 });
                    mqttClient.end();
                    //console.log('End Sending.');
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
