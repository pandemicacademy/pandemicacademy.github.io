// serves as jsonp callback for ipify
// @see ip-tracking in ama_analytics.libraries
function getIp(json) {
  gaDataLayer[0].ip_address = json.ip;
};
