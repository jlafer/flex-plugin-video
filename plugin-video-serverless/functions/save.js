/**
Be sure to set
TWILIO_API_KEY_SID
TWILIO_API_KEY_SECRET
**/
const {corsResponse} = require('jlafer-twilio-runtime-util');

exports.handler = function(context, event, callback) {
  try {
    const response = corsResponse();
    console.log(`flexvideotokenizer: called with:`, event);
    console.log(`flexvideotokenizer: context:`, context);
    const AccessToken = require('twilio').jwt.AccessToken;
    const VideoGrant = AccessToken.VideoGrant;
  
    // Create an access token which we will sign and return to the client,
    // containing the grant we just created
    const token = new AccessToken(
      context.ACCOUNT_SID,
      context.TWILIO_API_KEY_SID,
      context.TWILIO_API_KEY_SECRET
    );
  
    // Assign identity to the token
    token.identity = event.Identity || 'identity';
  
    // Grant the access token Twilio Video capabilities
    const grant = new VideoGrant();
    token.addGrant(grant);
  
    // Serialize the token to a JWT string
    response.appendHeader('Content-Type', 'application/json');
    response.setBody({
      token: token.toJwt(),
      identity: token.identity
    });
    callback(null, response);
  }
  catch (err) {
    console.log('flexvideotokenizer: threw error:', err.stack);
    response.appendHeader('Content-Type', 'plain/text');
    response.setBody(err.message);
    callback(null, response);
  }
};
