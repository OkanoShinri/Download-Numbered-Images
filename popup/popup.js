// Store the currently selected settings using browser.storage.local.
function storeSettings() {
  let is_serialized = document.getElementById("serialize_check").checked;
  let is_only_main_images = document.getElementById("only_main_images").checked;
  browser.storage.local.set({
    is_serialized: is_serialized,
    is_only_main_images: is_only_main_images,
  });
}

// Update the options UI with the settings values retrieved from storage,
// or the default settings if the stored settings are empty.
function updateUI(restoredSettings) {
  document.getElementById("serialize_check").checked =
    restoredSettings.is_serialized;
  document.getElementById("only_main_images").checked =
    restoredSettings.is_only_main_images;
}

function onError(e) {
  console.error(e);
}

// On opening the options page, fetch stored settings and update the UI with them.
browser.storage.local.get().then(updateUI, onError);

// Whenever the contents of the textarea changes, save the new values
document
  .getElementById("serialize_check")
  .addEventListener("change", storeSettings);
document
  .getElementById("only_main_images")
  .addEventListener("change", storeSettings);
