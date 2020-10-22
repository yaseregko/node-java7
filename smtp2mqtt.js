'use strict'

const fs           = require('fs');
const {SMTPServer} = require('smtp-server');
const simpleParser = require('mailparser').simpleParser;
const mqtt         = require('mqtt');
const config       = JSON.parse(fs.readFileSync('/data/options.json', 'utf8'));

const mqtt_url       = config.mqtt_url || 'mqtt://core-mosquitto:1883';
const mqtt_options   =  {
                        clientId: config.mqtt_clientId || 'smtp2mqtt',
                        username: config.mqtt_username,
                        password: config.mqtt_password
                        }
const smtp_port      = config.smtp_port || 25;
const smtp_host      = config.smtp_host || '0.0.0.0';
//const smtp_port      = config.smtp_username || 'username';
//const smtp_host      = config.smtp_password || 'password';
const media_path     = config.media_path || '/media';

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

smtp.listen(smtp_port, smtp_host, () => {
    console.log('Mail server started at %s:%s', smtp_host, smtp_port);
    /* Регистрация в топике доступности
    let mqttClient = mqtt.connect(mqtt_url, mqtt_clientId, mqtt_username, mqtt_password);
    mqttClient.on('connect', function () {
        mqttClient.publish('homeassistant/state', 'Connect', { qos: 0 });
        mqttClient.end();
    });*/
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
                let fileName = media_path + '/' + attachment.filename;
                fs.writeFile(fileName, data, function(error) { 
                    if(error) console.log('An error occurred:', error);
                    //callback(new Error(`Writing file with error: ${error}`));
                    console.log("Somebody bell in door. Photo saved in file:", fileName);
                    //console.log("Размер: ",  attachment.size);
                });
                let messageData = {
                    filename: fileName, 
                    content: data
                };
                let mqttClient = mqtt.connect(mqtt_url, mqtt_options)
                mqttClient.on('connect', function() {
                    console.log('Sending messages in mqtt.');
                    mqttClient.publish('smtp2mail/binary_sensor/doorbell/state', 'on', { qos: 0 });
                    mqttClient.publish('smtp2mail/camera/doorbell/picture', JSON.stringify(messageData), { qos: 0 });
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
      return callback(null, { user: 123 });
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
