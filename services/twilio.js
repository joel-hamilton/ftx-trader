let Twilio = require('twilio')
var twilio = new Twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

async function sendSms(body) {
    console.log(`SENDING: ${body}`)
    // Send message using promise
    var promise = twilio.messages.create({
        from: '12267818520',
        to: '15197772459',
        body
    });

    promise.then(function(message) {
        console.log(`Sent message. SID: ${message.sid}`);
    });
}

module.exports = {
    sendSms,
}