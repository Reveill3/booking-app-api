const axios = require("axios");

module.exports = async (eventName, description, channel) => {
  const request_config = {
    method: "POST",
    url: "https://api.logsnag.com/v1/log",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LOGSNAG_KEY}`,
    },
    data: JSON.stringify({
      project: "revrentals",
      channel: channel,
      event: eventName,
      description: description,
    }),
  };

  await axios(request_config);
  return;
};
