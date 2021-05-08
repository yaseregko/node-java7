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
const device        = {
                        'name': 'Yoosee Doorbell SD-05',
                        'dev': {
                                'cns':  [[ 'mac', '02:1b:22:78:25:14']],
                                'ids': 	deviceId,
                                'name': 'doorbell',
                                'mf': 	'Yoosee',
                                'mdl':	'sd-05',
                                'sw': 	'13.0.5'
                                },
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
        let doorbellButton = new Map(Object.entries(device));
        doorbellButton.set('device_class', 'binary_sensor')
                      .set('off_dly', 5)
                      .set('state_topic', 'smtp2mqtt/binary_sensor/doorbell/' + deviceId + '/state')
                      .set('pl_on', 'bell')
                      .set('pl_off', 'idle')
                      .set('unique_id', deviceId + '-doorbell-button')
                      .set('discovery_hash', ('binary_sensor', 'doorbell_button'));

        let doorbellCamera = new Map(Object.entries(device));
        doorbellCamera.set('device_class', 'camera')
                      .set('topic', 'smtp2mqtt/camera/doorbell/' + deviceId + '/snapshot')
                      .set('unique_id', deviceId + '-doorbell-snapshot')
                      .set('discovery_hash', ('camera', 'doorbell_snapshot'));

        mqttClient.publish('homeassistant/binary_sensor/doorbell/' + deviceId + '/config', doorbellButton, { qos: 0 });
        mqttClient.publish('homeassistant/camera/doorbell/' + deviceId + '/config', doorbellCamera, { qos: 0 });
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
                const buff = Buffer.from(data, 'utf-8');
                const base64Data = buff.toString('base64');
                let mqttClient = mqtt.connect(mqttUrl, mqttOptions);
                mqttClient.on('connect', function() {
                    console.log('Sending messages in mqtt.');
                    mqttClient.publish('smtp2mqtt/binary_sensor/doorbell/' + deviceId + '/state', 'bell', { qos: 0 });
                    mqttClient.publish('smtp2mqtt/camera/doorbell/' + deviceId + '/snapshot', base64Data, { qos: 0 });
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
