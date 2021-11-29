/* global a2a*/
(function (Drupal) {
  'use strict';

  Drupal.behaviors.addToAny = {
    attach: function (context, settings) {
      // If not the full document (it's probably AJAX), and window.a2a exists
      if (context !== document && window.a2a) {
        a2a.init_all(); // Init all uninitiated AddToAny instances
      }
    }
  };

})(Drupal);
;
(function (Drupal) {
  Drupal.behaviors.amaOneTwitterShare = {
    attach: function (context, settings) {
      var shareMessageText = "${title} ${link} (via @AmerMedicalAssn)";

      // Get configured twitter hash tags
      var customHashtagElement = document.querySelector("meta[name='a1-twitter-hashtags']");
      var customHashtags = customHashtagElement ? customHashtagElement.getAttribute("content") : null;

      // Check for custom twitter share message and replace if needed
      var customMssgElement = document.querySelector("meta[name='a1-twitter-custom-message']");
      if(customMssgElement){
        shareMessageText = customMssgElement.getAttribute("content") + " ${link} (via @AmerMedicalAssn)";
      }

      // a2a_config variable is already defined and addtoany is a dependency for this module, however check for it anyway.
      if (a2a_config) {
        a2a_config.templates.twitter = {
          text: shareMessageText,
          hashtags: customHashtags
        };
      }
    }
  };
})(Drupal);

;
