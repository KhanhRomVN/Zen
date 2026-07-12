/// <reference types="@welldone-software/why-did-you-render" />
import React from "react";

const whyDidYouRender = require("@welldone-software/why-did-you-render");

whyDidYouRender(React, {
  // Chỉ track các components được đánh dấu whyDidYouRender = true
  trackAllPureComponents: false,

  // Track hooks re-renders
  trackHooks: true,

  // Hiển thị chi tiết về thay đổi props/state
  logOnDifferentValues: true,

  // Các options tùy chỉnh cho VSCode webview
  collapseGroups: true,

  // Tắt notify để tránh spam console
  notifier: (notification: any) => {
    console.groupCollapsed(
      `%c[WDYR] ${notification.Component.displayName || notification.Component.name}`,
      "color: #FF6B6B; font-weight: bold;",
    );
    console.log("Reason:", notification.reason);

    if (notification.hookName) {
      console.log("Hook:", notification.hookName);
    }

    if (notification.propsDifferences) {
      console.log("Props changes:", notification.propsDifferences);
    }

    if (notification.stateDifferences) {
      console.log("State changes:", notification.stateDifferences);
    }

    if (notification.hookDifferences) {
      console.log("Hook dependencies changes:", notification.hookDifferences);
    }

    console.groupEnd();
  },
});

console.log(
  "%c[WDYR] Why Did You Render is enabled. Mark components with 'whyDidYouRender = true' to track them.",
  "color: #51CF66; font-weight: bold;",
);
