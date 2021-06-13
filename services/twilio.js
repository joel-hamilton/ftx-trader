let Twilio = require('twilio')
var twilio = new Twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

async function sendSms(to = ['15197772459'], body) {
    for (number of to) {
        console.log(`SENDING: ${body}`)
        // Send message using promise
        var promise = twilio.messages.create({
            from: '12267818520',
            to: number,
            body
        });

        promise.then(function (message) {
            console.log(`Sent message. SID: ${message.sid}`);
        });
    }
}

module.exports = {
    sendSms,
}