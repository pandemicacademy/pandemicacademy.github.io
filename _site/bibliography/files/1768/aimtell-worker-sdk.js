/**
 * Service Worker For Push Notifications
 */

var _aimtellDB;
var _aimtellVersion = 2.44;
var _aimtellWL = false;


self.addEventListener('error', function(e) {
    var error_message = e.message + " (line: " + e.lineno + ")";
    //post any uncaught errors
    var params = {};
    params.error_msg = error_message;
    _aimtellConsoleOutput("Uncaught Error." + error_message)
    _aimtellLogError(0, "[v"+_aimtellVersion+"] uncaught error", params);

});

//auto update service workers
self.addEventListener('install', function(event) {
    _aimtellConsoleOutput("Installing v"+_aimtellVersion);
    event.waitUntil(self.skipWaiting());
});

//auto update service workers
self.addEventListener('activate', function(event) {
    _aimtellConsoleOutput("Activating v"+_aimtellVersion);
    event.waitUntil(self.clients.claim());
    _aimtellDBInit(null);
});

self.addEventListener('pushsubscriptionchange', function(event) {
    fetch('https://analytics.aimtell.com/validate/subscription-change').then(function(response) {});
});



//forgiving console ouput  
function _aimtellConsoleOutput(message) {

    try {

        if (self.location.pathname == "/aimtell-worker.js") {
            console.log("[Aimtell] " + message)
        }

    } catch (err) {
        console.log(err);
    }



}


function _aimtellDBInit(callback) {

    if (!indexedDB) {
        return false;
    }


    var _aimtellDBOpenRequest = indexedDB.open('_aimtellDatabase', 1);

    _aimtellDBOpenRequest.onupgradeneeded = function(e) {
        var _aimtellDB = e.target.result;
        if (!_aimtellDB.objectStoreNames.contains('store')) {
            var storeOS = _aimtellDB.createObjectStore('store', {
                keyPath: 'name'
            });
        }
        if (callback !== null) {
            callback(true);
        }
    };
    _aimtellDBOpenRequest.onsuccess = function(e) {
        _aimtellDB = e.target.result;
        if (callback !== null) {
            callback(true);
        }
    };
    _aimtellDBOpenRequest.onerror = function(e) {

        if (callback !== null) {
            callback(false);
        }
    };


}


function _aimtellDBGet(key, callback) {

    _aimtellDBInit(function(result) {

        //if it failed, we need to log
        if (result === false) {
            _aimtellLogError(0, "Failed to initialize DB", null);
            return false;
        }

        //open teh db
        var transaction = _aimtellDB.transaction(['store'], 'readwrite');
        var store = transaction.objectStore('store');

        request = store.get(key);

        request.onerror = function(e) {
            if (callback !== null) {
                callback(e.target.result);
            }
        };
        request.onsuccess = function(e) {
            if (callback !== null) {
                callback(e.target.result);
            }
        };


    });



}


function _aimtellDBAdd(subscriber_uid, id_site) {

    if (subscriber_uid === null || id_site === null) {
        return false;
    }

    _aimtellDBInit(function(result) {
        //if it failed, we need to log
        if (result === false) {
            _aimtellLogError(0, "Failed to initialize DB", null);
            return false;
        }

        var transaction = _aimtellDB.transaction(['store'], 'readwrite');
        var store = transaction.objectStore('store');

        var item = {
            name: "subscriber_uid",
            subscriber_uid: subscriber_uid,
            id_site: id_site,
            created: new Date().getTime()
        };

        var request = store.put(item);

        request.onerror = function(e) {};
        request.onsuccess = function(e) {};


    });



}



function _aimtellMissingEndpoint(endpoint, http_status) {

    //see if we can get some additional information on who this 
    _aimtellDBGet("subscriber_uid", function(response) {

        //either use the databse info or just an empty object
        var dbinfo = response || {};

        //additional info
        var params = {};
        params.endpoint = endpoint;
        params.http_status = http_status;
        params.subscriber_uid = dbinfo.subscriber_uid || "N/A";

        var id_site = dbinfo.id_site || 0;
        _aimtellLogError(id_site, "missing endpoint", params);

    });

}



function _aimtellLogError(id_site, name, params) {

    //prepare the url
    var url_params = "?type=worker";
    url_params += "&website_id=" + id_site;
    url_params += "&body=" + name;

    var postPayload = params || {};
    postPayload.version = _aimtellVersion;

    //fire off the request
    fetch('https://log.aimtell.com/error' + url_params, {
        method: 'post',
        body: JSON.stringify(postPayload),
        headers: {
            'content-type': 'application/json'
        }
    }).then(function(response) {
        //
    });




}

function fetchPayloadFromAimtell(event, settings, subscription) {

    return new Promise(function(resolve, reject) {

        //grab the endpoint, it contains entire url string
        var endpoint = subscription.endpoint;

        //url encode the endpoint 
        endpoint = encodeURIComponent(endpoint);

        //grab endpoint to ftech
        var endpointFetchURL = settings.endpoint;

        //pass the endpoint to the server to extract uid and run remaining logic.
        //service worker logic/caching is to unpredictable at this point
        fetch(endpointFetchURL + "" + endpoint).then(function(response) {

            if (response.status !== 200) {
                _aimtellMissingEndpoint(endpoint, response.status);
                reject('Bad Status Code For Endpoint');
            }

            // Examine the text in the response  
            response.json().then(function(data) {


                if (data.error || data.errorMessage) {
                    _aimtellConsoleOutput("An API Error Has Occured.");
                    reject()
                }

                //additional support for silent fail
                if (Object.keys(data).length === 0) {
                    _aimtellConsoleOutput("Notification Content Empty. Suppressing.");
                    reject();
                }

                resolve(data);


            })
                .
            catch (function(data) {
                _aimtellConsoleOutput(data);
            });

        });

    });

}



function fetchParseContents(event, settings, subscription) {

    //assume legacy remote
    var source = "Aimtell-Remote";

    //extract the source
    if (event.data !== null && typeof event.data.json().source !== "undefined") {
        source = event.data.json().source;
    }

    _aimtellConsoleOutput("Source is " + source);

    return new Promise(function(resolve, reject) {

        var payload = {};

        switch (source) {

            //the data was passed with it
            case "Aimtell":
                var content = event.data.json().content;
                payload.title = content.title || null;
                payload.message = content.message || null;
                payload.icon = content.icon || null;
                payload.image = content.image || null;
                payload.actions = content.actions || [];
                payload.data = content.data || {};
                payload.actions_data = null;
                resolve(payload);
                break;
            case "Aimtell-Remote":
                fetchPayloadFromAimtell(event, settings, subscription).then(function(fetched) {
                    payload.title = fetched.title || null;
                    payload.message = fetched.message || null;
                    payload.icon = fetched.icon || null;
                    payload.image = fetched.image || null;
                    payload.actions = fetched.actions || [];
                    payload.data = fetched.data || {};
                    payload.actions_data = fetched.data.actions || null;
                    resolve(payload);
                });

                break;
             case "Aimtell-Network":
                var json = event.data.json();
                var src = json.source_vars.src;
                var url = json.source_vars.url;

                //this is passed direct
                payload.data = json.content.data;

                fetch("https://network.aimtell.com/?u="+url+"&s="+src).then(function(response) {

                    //parse json
                    response.json().then(function(data) {
                        payload.title = data.title;
                        payload.message = data.message;
                        payload.icon = data.icon;

                        //override the link with what we received
                        payload.data.link = data.link;
                        
                        resolve(payload);
                    })
                    
                });


                

                break;
                //the data is remote
            default:

                break;
        }


    });




}


function _aimtellSendWebhook(url, id_site, campaign_id, subscriber_uid){
    var first_type = (url.includes("?")) ? "&" : "?";
    url += first_type + "id_site=" + id_site;
    url += "&campaign_id=" + campaign_id;
    url += "&subscriber_uid=" + subscriber_uid;

    //if whitelabel, don't put aimtell information
    if(!_aimtellWL){
        url += "&push_source=aimtell.com";    
    }
    

    _aimtellConsoleOutput("Webhook sent " + url);

    fetch(url, {method: 'POST', mode: 'no-cors', redirect: 'follow'});    
}



function autoHideNotifications() {

    self.registration.getNotifications().then(function(notifications) {

        _aimtellConsoleOutput("Checking Notifications");

        var shown = [];
        var shown_title = [];
        var shown_body = [];

        notifications.forEach(function(element) {

            if (shown_title.includes(element.title) && shown_body.includes(element.body)) {
                _aimtellConsoleOutput("Already Showing Notification, Discarding");
                element.close();
                return false;
            }


            //add to the array
            shown_title.push(element.title);
            shown_body.push(element.body);

            //if this has a custom timeout
            if (element.data != null && element.data.auto_hide != null) {
                setTimeout(function() {
                    element.close();
                }, element.data.auto_hide * 1000);
            }

        });

    });
}

//push received
self.addEventListener('push', function(event) {


    //if aimtell flag is found or there was no data payload assume aimtell
    if (event.data === null || typeof event.data.json().isAimtell != "undefined") {
        isAimtellPush = true;
    } else {
        isAimtellPush = false;
    }

    //grab the user subscription/registration information 
    event.waitUntil(self.registration.pushManager.getSubscription().then(function(subscription) {

        _aimtellConsoleOutput("Receiving Push.");

        if (isAimtellPush === false) {
            _aimtellConsoleOutput("Discarding External Sourced Push.")
            return null;
        }


        return fetch("https://s3.amazonaws.com/cdn.aimtell.com/pushdata/push_data_settings.json?v=" + _aimtellVersion).then(function(response) {

            return response.json().then(function(settings) {

                _aimtellConsoleOutput("Checking Settings");


                //check to see if the push contents was passed
                return fetchParseContents(event, settings, subscription).then(function(payload) {


                    var id_site = payload.data.id_site || null;
                    var campaign_id = payload.data.campaign_id || null;
                    var subscriber_uid = payload.data.subscriber_uid || null;

                    //impression tracking
                    //if they requested a webhook
                    if(!typeof payload.data.webhooks != "undefined" && payload.data.webhooks != null && payload.data.webhooks.notification_impression != null && payload.data.webhooks.notification_impression.length > 0){
                        var i;
                        for (i = 0; i <  payload.data.webhooks.notification_impression.length; i++) {
                            _aimtellSendWebhook(payload.data.webhooks.notification_impression[i], id_site, campaign_id, subscriber_uid);
                        }

                    }


                    //show notification
                    return self.registration.showNotification(payload.title, {
                        body: payload.message,
                        icon: payload.icon,
                        image: payload.image,
                        requireInteraction: true,
                        actions: payload.actions,
                        data: {
                            link: payload.data.link,
                            logid: payload.data.logid,
                            subscriber_uid: subscriber_uid,
                            auto_hide: payload.data.auto_hide,
                            actions: payload.data.actions,
                            id_site: id_site,
                            campaign_id: campaign_id,
                            webhooks: payload.data.webhooks || []
                        }
                    })
                    .then(function() {
                        autoHideNotifications();
                    });
                });


            });


        });
        //end fetch settings
        //
    }));
    //end waitUntil
});


//notification click
self.addEventListener('notificationclick', function(event) {

    // Force close - android doesn't close the notification when you click on it  
    event.notification.close();

    _aimtellConsoleOutput("Notification clicked.");

    //grab details
    var atlink = event.notification.data.link;
    var logid = event.notification.data.logid;
    var id_site = event.notification.data.id_site;
    var campaign_id = event.notification.data.campaign_id;
    var webhooks = event.notification.data.webhooks;

    //add additional information in payload
    var postPayload = {};
    postPayload.subscriber_uid = event.notification.data.subscriber_uid || null;
    postPayload.logid = logid;

    //if an action exists, add to analytics payload and update link
    if (event.action === 'a01') {
        postPayload.action = 'a01';
        atlink = event.notification.data.actions.a01.link;
    } else if (event.action === 'a02') {
        postPayload.action = 'a02';
        atlink = event.notification.data.actions.a02.link;
    }

    //log click
    fetch('https://api.aimtell.com/prod/push/click/' + logid, {
        method: 'post',
        body: JSON.stringify(postPayload)
    });

    //log click v2
    fetch('https://analytics.aimtell.com/push-click', {
        method: 'post',
        body: JSON.stringify(postPayload)
    });

    //if they requested a webhook for click
    if(!typeof webhooks != "undefined" && webhooks != null && webhooks.notification_click != null && webhooks.notification_click.length > 0){
        var i;
        for (i = 0; i <  webhooks.notification_click.length; i++) {
            _aimtellSendWebhook(webhooks.notification_click[i], id_site, campaign_id,  postPayload.subscriber_uid);
        }

    }

    //make sure its proper link format (sometimes http missing)
    if (!/^https?:\/\//i.test(atlink)) {
        atlink = 'http://' + atlink;
    }

    //open link
    return clients.openWindow(atlink);



});

//postMessage
self.addEventListener('message', function(event) {

    switch (event.data.command) {
        //service worker receiving registration call
        case 'register':

            //store the subscriberID
            subscriber_uid = event.data.uid;

            // event.ports[0] corresponds to the MessagePort that was transferred as part of the controlled page's
            // call to controller.postMessage(). Therefore, event.ports[0].postMessage() will trigger the onmessage
            // handler from the controlled page.
            event.ports[0].postMessage({
                error: null,
                type: "register",
                subscriber_uid: subscriber_uid
            });

            break;

        case 'store':

            var subscriber_uid = event.data.subscriber_uid;
            var id_site = event.data.id_site;

            //add and callback
            _aimtellDBAdd(subscriber_uid, id_site);

            break;
            //lets revalidate and make sure our database has some accurate information
        case 'validate':

            //grab the full endpoint for push token
            self.registration.pushManager.getSubscription().then(function(subscription) {
                endpoint = subscription.endpoint;

                //grab some additional information we want to process
                subscriber_uid = event.data.subscriber_uid;
                id_site = event.data.id_site;

                var validatePayload = {};
                validatePayload.subscriber_uid = subscriber_uid;
                validatePayload.id_site = id_site;
                validatePayload.endpoint = endpoint;
                validatePayload.worker_version = _aimtellVersion;

                //send a call to our db to verify we are using these same credentials
                fetch('https://analytics.aimtell.com/validate', {
                    method: 'POST',
                    body: JSON.stringify(validatePayload)
                }).then(function(response) {
                    //
                });


            });

            break;
        default:
            // This will be handled by the outer .catch().
            //throw '[Aimtell] Unknown command: ' + event.data.command;
    }

});