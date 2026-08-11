/* RunnerBear v8.1.4 compatibility shim · v10.2 stabilization
   The old file embedded a very large base64 home-screen icon and no longer parsed.
   Home-screen/favicons are now owned by index.html + site.webmanifest, while newer
   RunnerBear layers own flexible activity UI. Keeping this file as a valid no-op
   preserves the historical script reference without reintroducing obsolete logic.
*/
(function(){
  'use strict';
  document.documentElement.dataset.runnerbearV25='compat';
})();
