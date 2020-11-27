const {corsResponse} = require('jlafer-twilio-runtime-util');
const fnName = 'dialAndAddToRoom';

exports.handler = async function(context, event, callback) {
  const response = corsResponse();
  try {
    console.log(`${fnName}: context:`, context);
    console.log(`${fnName}: called with:`, event);
    const {roomName, number} = event;
    const client = context.getTwilioClient();
    const call = await client.calls
    .create({
       twiml: `<Response><Connect><Room participantIdentity="${number}">${roomName}</Room></Connect></Response>`,
       to: `+1${number}`,
       from: '+12052367574'
     });
    console.log(`${fnName}: created call: ${call.sid}`);
    response.appendHeader('Content-Type', 'application/json');
    response.setBody(call);
    callback(null, response);
  }
  catch (err) {
    console.log(`${fnName}: error:`, err);
    response.appendHeader('Content-Type', 'plain/text');
    response.setBody(err.message);
    callback(null, response);
  }
};
