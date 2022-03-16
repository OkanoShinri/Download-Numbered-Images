browser.runtime.onMessage.addListener(notify);

function notify(message) {
  browser.downloads.download({
    url: message.url,
    filename: message.title + "/" + message.filename,
  });
}
