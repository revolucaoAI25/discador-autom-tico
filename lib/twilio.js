const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

function getClient() {
  if (!accountSid || !authToken) {
    throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
  }
  return twilio(accountSid, authToken);
}

function generateToken(identity) {
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const token = new AccessToken(
    accountSid,
    process.env.TWILIO_API_KEY || accountSid,
    process.env.TWILIO_API_SECRET || authToken,
    { identity }
  );

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: process.env.TWILIO_APP_SID,
    incomingAllow: true,
  });

  token.addGrant(voiceGrant);
  return token.toJwt();
}

module.exports = { getClient, generateToken };
