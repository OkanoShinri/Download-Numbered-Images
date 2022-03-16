function listenForClicks() {
  document.addEventListener("click", (e) => {

    function notifyDownloadToContent(tabs) {
      let is_serialized = document.getElementById("serialize_check").checked;
      browser.tabs.sendMessage(tabs[0].id, {
        command: "download",
        is_serialized: is_serialized,
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
  });
}

function reportExecuteScriptError(error) {
  document.querySelector("#popup-content").classList.add("hidden");
  document.querySelector("#error-content").classList.remove("hidden");
  console.error(`Failed to download: ${error.message}`);
}

browser.tabs
  .executeScript({ file: "/content_scripts/content.js" })
  .then(listenForClicks)
  .catch(reportExecuteScriptError);
