document.onselectstart = () => {
  noticeSelectStart();
};
document.onselectionchange = () => {
  noticeSelectRemoved(document);
};

//frame内documentにいつか対応させてやる
/*
let iframe_elements = document.getElementsByTagName("iframe");
for (let j = 0; j < iframe_elements.length; j++) {
  try {
    var iframe_document = iframe_elements[j].contentDocument;
  } catch (error) {
    console.error(error);
    continue;
  }
  if (iframe_document === null) {
    continue;
  }
  iframe_document.onselectstart = () => {
    noticeSelectStart();
  };

  iframe_document.onselectionchange = () => {
    noticeSelectRemoved(iframe_document);
  };
}
*/

//frame内document
let frame_elements = document.getElementsByTagName("frame");
for (let j = 0; j < frame_elements.length; j++) {
  try {
    var frame_document = frame_elements[j].contentDocument;
  } catch (error) {
    console.error(error);
    continue;
  }
  if (frame_document === null) {
    continue;
  }
  frame_document.onselectstart = () => {
    noticeSelectStart();
  };

  frame_document.onselectionchange = () => {
    noticeSelectRemoved(frame_document);
  };
}

function noticeSelectStart() {
  browser.runtime.sendMessage({
    command: "select_start",
    text: "テキストが選択されました",
  });
}

function noticeSelectRemoved(document) {
  if (document.getSelection().type !== "Range") {
    browser.runtime.sendMessage({
      command: "select_remove",
      text: "選択が解除されました",
    });
  }
}
