function listenForClicks() {
  document.addEventListener("click", (e) => {
    function notifyDownloadToContent(tabs) {
      let is_serialized = document.getElementById("serialize_check").checked;
      let is_only_main_images =
        document.getElementById("only_main_images").checked;
      browser.tabs.sendMessage(tabs[0].id, {
        command: "download",
        is_serialized: is_serialized,
        is_only_main_images: is_only_main_images,
      });
    }

    function reportError(error) {
      console.error(`Could not beastify: ${error}`);
    }

    if (e.target.classList.contains("button")) {
      browser.tabs
        .query({ active: true, currentWindow: true })
        .then(notifyDownloadToContent)
        .catch(reportError);
    }
    if (e.target.classList.contains("option")) {
      browser.runtime.openOptionsPage();
    }
  });
}

function reportExecuteScriptError(error) {
  document.getElementById("download-button").classList.add("hidden");
  document.getElementById("error-content").classList.remove("hidden");
  console.error(`Failed : ${error.message}`);
}

browser.tabs
  .executeScript({ file: "/content_scripts/content.js" })
  .then(listenForClicks)
  .catch(reportExecuteScriptError);
