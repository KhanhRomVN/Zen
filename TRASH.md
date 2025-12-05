người dùng nhập "hello" và gửi đi và chờ đợi.
```
[WSConnection] 📨 Message received from Zen: 
Object { connectionId: "ws-1764924201875-3554", dataLength: 41, timestamp: 1764924246887 }
serviceWorker.js:1:3919
[WSConnection] ========== HANDLE MESSAGE START ========== serviceWorker.js:1:5153
[WSConnection] 📥 RAW MESSAGE RECEIVED: 
Object { connectionId: "ws-1764924201875-3554", connectionStatus: "connected", wsReadyState: 1, dataLength: 41, dataPreview: '{"type":"ping","timestamp":1764924246886}', timestamp: 1764924246891 }
serviceWorker.js:1:5226
[WSConnection] ✅ JSON PARSED in 0ms serviceWorker.js:1:5498
[WSConnection] 🔍 PARSED MESSAGE STRUCTURE: 
Object { type: "ping", hasTabId: false, tabId: undefined, hasRequestId: false, requestId: undefined, timestamp: 1764924246886, messageAge: 5, allKeys: (2) […] }
serviceWorker.js:1:5552
[WSConnection] 📊 MESSAGE TYPE: ping serviceWorker.js:1:5795
[WSConnection] 📨 Message received from Zen: 
Object { connectionId: "ws-1764924201875-3554", dataLength: 166, timestamp: 1764924276411 }
serviceWorker.js:1:3919
[WSConnection] ========== HANDLE MESSAGE START ========== serviceWorker.js:1:5153
[WSConnection] 📥 RAW MESSAGE RECEIVED: 
Object { connectionId: "ws-1764924201875-3554", connectionStatus: "connected", wsReadyState: 1, dataLength: 166, dataPreview: '{"type":"sendPrompt","tabId":2,"systemPrompt":null,"userPrompt":"hello","requestId":"req-1764924276399","isNewTask":false,"folderPath":null,"timestamp":1764924276399}', timestamp: 1764924276413 }
serviceWorker.js:1:5226
[WSConnection] ✅ JSON PARSED in 0ms serviceWorker.js:1:5498
[WSConnection] 🔍 PARSED MESSAGE STRUCTURE: 
Object { type: "sendPrompt", hasTabId: true, tabId: 2, hasRequestId: true, requestId: "req-1764924276399", timestamp: 1764924276399, messageAge: 14, allKeys: (8) […] }
serviceWorker.js:1:5552
[WSConnection] 📊 MESSAGE TYPE: sendPrompt serviceWorker.js:1:5795
[WSConnection] 🎯 SEND PROMPT MESSAGE DETAILS: 
Object { tabId: 2, requestId: "req-1764924276399", userPromptLength: 5, userPreview: "hello", systemPromptLength: 0, isNewTask: false, folderPath: null, hasFolderPath: false }
serviceWorker.js:1:5875
[WSConnection] ⏱️ Message timestamp check: 
Object { messageTimestamp: 1764924276399, currentTime: 1764924276415, messageAge: 16, maxAge: 60000, willSkip: false }
serviceWorker.js:1:9541
[WSConnection] 💾 Saving message to storage: 
Object { connectionId: "ws-1764924201875-3554", messageType: "sendPrompt", requestId: "req-1764924276399" }
serviceWorker.js:1:9859
[WSConnection] 📊 Current wsMessages: 
Object { connectionCount: 1, hasThisConnection: true, thisConnectionMessageCount: 2 }
serviceWorker.js:1:10061
[WSConnection] 🔍 Checking for duplicates: 
Object { requestId: "req-1764924276399", existingRequestIds: (2) […] }
serviceWorker.js:1:10377
[WSConnection] ✅ Message passed duplicate check: 
Object { type: "sendPrompt", requestId: "req-1764924276399", hasRequestId: true, willSave: true }
serviceWorker.js:1:10753
[WSConnection] ✅ Message saved to storage: 
Object { requestId: "req-1764924276399", type: "sendPrompt", connectionId: "ws-1764924201875-3554", totalMessages: 3 }
serviceWorker.js:1:11238
[WSConnection] ✅ VERIFIED: Message saved successfully serviceWorker.js:1:11516
[ServiceWorker] 📦 Storage changed: 
Object { area: "local", hasWsMessages: true, hasWsIncomingRequest: false, changeKeys: (1) […] }
serviceWorker.js:4000:3260
[ServiceWorker] ==================== WS MESSAGES CHANGED ==================== serviceWorker.js:4000:3494
[ServiceWorker] 📨 New messages count: 3 serviceWorker.js:4000:3587
[ServiceWorker] 📨 Old messages count: 2 serviceWorker.js:4000:3689
[ServiceWorker] 📨 Connections: 
Array [ "ws-1764924201875-3554" ]
serviceWorker.js:4000:3791
[ServiceWorker] 📨 Connection ws-1764924201875-3554: 3 messages serviceWorker.js:4000:3899
[ServiceWorker]   [0] connection-established - no-request-id - 2025-12-05T08:43:21.940Z serviceWorker.js:4000:3989
[ServiceWorker]   [1] focusedTabsUpdate - no-request-id - 2025-12-05T08:43:22.444Z serviceWorker.js:4000:3989
[ServiceWorker]   [2] sendPrompt - req-1764924276399 - 2025-12-05T08:44:36.417Z serviceWorker.js:4000:3989
[ServiceWorker] 🔍 Processing connection ws-1764924201875-3554: 
Object { totalMessages: 3, messageTypes: (3) […], requestIds: (1) […] }
serviceWorker.js:4000:4374
[ServiceWorker] ⏱️ Recent messages filter: 
Object { totalMessages: 3, recentMessages: 3, filteredOut: 0, oldestAge: 74480 }
serviceWorker.js:4000:4606
[ServiceWorker] 📬 Latest message: 
Object { type: "sendPrompt", requestId: "req-1764924276399", age: 3, hasTabId: true, hasUserPrompt: true }
serviceWorker.js:4000:4934
[ServiceWorker] ==================================================== serviceWorker.js:4000:5153
[ServiceWorker] ========== SEND PROMPT DETECTED ========== serviceWorker.js:4000:5237
[ServiceWorker] ⏱️ Detection time: 1764924276420 serviceWorker.js:4000:5311
[ServiceWorker] 🔍 MESSAGE DETAILS: 
Object { connectionId: "ws-1764924201875-3554", messageIndex: 2, totalRecentMessages: 3, messageAge: 3 }
serviceWorker.js:4000:5366
[ServiceWorker] 🎯 MESSAGE PAYLOAD: 
Object { requestId: "req-1764924276399", tabId: 2, hasUserPrompt: true, userPromptLength: 5, userPromptPreview: "hello", hasSystemPrompt: false, systemPromptLength: 0, systemPromptPreview: undefined, isNewTask: false, folderPath: null, … }
serviceWorker.js:4000:5512
[ServiceWorker] 📊 CONNECTION INFO: 
Object { connectionId: "ws-1764924201875-3554", totalConnections: 1, allConnectionIds: (1) […], thisConnectionMessageCount: 3 }
serviceWorker.js:4000:6062
[ServiceWorker] 🔍 PARSED FIELDS: 
Object { tabId: 2, requestId: "req-1764924276399", userPromptLength: 5, systemPromptLength: 0, isNewTask: false, folderPath: null, hasAllRequiredFields: true, missingFields: {…} }
serviceWorker.js:4000:6327
[ServiceWorker] 🔍 User prompt preview: "hello" serviceWorker.js:4000:6570
[ServiceWorker] 🔍 Parsed fields: 
Object { tabId: 2, requestId: "req-1764924276399", userPromptLength: 5, systemPromptLength: 0, isNewTask: false, folderPath: null }
serviceWorker.js:4000:6666
[ServiceWorker] 🔍 sendPrompt validation: 
Object { hasTabId: true, tabIdValue: 2, hasUserPrompt: true, userPromptLength: 5, hasRequestId: true, requestIdValue: "req-1764924276399", hasSystemPrompt: false, hasFolderPath: false, isNewTask: false }
serviceWorker.js:4000:6824
[ServiceWorker] ✅ sendPrompt validation passed, processing... serviceWorker.js:4000:7290
[ServiceWorker] 🔍 Checking if request already processed: 
Object { requestKey: "processed_req-1764924276399", requestId: "req-1764924276399" }
serviceWorker.js:4000:7407
[DeepSeekController] 🎯 sendPrompt() ENTRY POINT serviceWorker.js:4000:840
[DeepSeekController] 📊 Raw arguments: 
Object { tabId: 2, promptOrSystemPrompt_type: "object", promptOrSystemPrompt_length: 0, userPromptOrRequestId_type: "string", userPromptOrRequestId_value: "hello", requestIdOrIsNewTask_type: "string", requestIdOrIsNewTask_value: "req-1764924276399", isNewTask_type: "boolean", isNewTask_value: false }
serviceWorker.js:4000:904
[DeepSeekController] 🔀 Using Overload 2 (systemPrompt + userPrompt) serviceWorker.js:4000:1253
[DeepSeekController] 🔍 Parsed arguments: 
Object { tabId: 2, systemPrompt: "null", userPrompt: "hello", requestId: "req-1764924276399", isNewTask: false }
serviceWorker.js:4000:1337
[DeepSeekController] 📞 Calling PromptController.sendPrompt()... serviceWorker.js:4000:1500
[PromptController] 🚀 ========== SEND PROMPT START ========== serviceWorker.js:3321:5202
[PromptController] 📍 Entry timestamp: 1764924276421 serviceWorker.js:3321:5279
[PromptController] 📊 Raw arguments: 
Object { tabId: 2, promptOrSystemPrompt_type: "object", promptOrSystemPrompt_length: 0, promptOrSystemPrompt_preview: undefined, userPromptOrRequestId_type: "string", userPromptOrRequestId_value: "hello", requestIdOrIsNewTask_type: "string", requestIdOrIsNewTask_value: "req-1764924276399", isNewTask_type: "boolean", isNewTask_value: false }
serviceWorker.js:3321:5347
[PromptController] 🔍 Determining overload type... serviceWorker.js:3321:5757
[PromptController] 🔀 OVERLOAD 2: systemPrompt + userPrompt serviceWorker.js:3321:5843
[PromptController] 📝 Parsed values: 
Object { systemPrompt_length: 0, systemPrompt_preview: undefined, userPrompt_length: 5, userPrompt_preview: "hello", requestId: "req-1764924276399", isNewTaskFlag: false }
serviceWorker.js:3321:5945
[PromptController] 🔧 Building final prompt... serviceWorker.js:3321:6171
[PromptController] ✅ Final prompt built: 5 chars serviceWorker.js:3321:6262
[PromptController] ✅ Argument parsing complete serviceWorker.js:3321:6575
[PromptController] 📊 Final values: 
Object { tabId: 2, requestId: "req-1764924276399", finalPrompt_length: 5, isNewTaskFlag: false }
serviceWorker.js:3321:6637
[PromptController] 🔍 STEP 1: Validating tab 2... serviceWorker.js:3321:6754
[PromptController] ⏱️ Validation start time: 1764924276422 serviceWorker.js:3321:6822
[PromptController] 🔍 VALIDATE TAB START - tabId: 2 serviceWorker.js:3321:45
[PromptController] ⏱️ Validation timestamp: 1764924276422 serviceWorker.js:3321:115
[PromptController] 📌 STEP 1: Calling browserAPI.tabs.get(2)... serviceWorker.js:3321:204
[PromptController] 💡 Current time: 1764924276422 serviceWorker.js:3321:286
[PromptController] 🟡 Promise started at: 1764924276422, tabId: 2 serviceWorker.js:3321:404
[ServiceWorker] ✅ Request not processed yet, marking as processed serviceWorker.js:4000:7718
[PromptController] 🔵 tabs.get callback called after 0ms serviceWorker.js:3321:520
[PromptController] ✅ TAB 2 INFO RETRIEVED: 
Object { tabId: 2, url: "https://chat.deepseek.com/", urlShort: "https://chat.deepseek.com/", title: "DeepSeek - Into the Unknown", titleShort: "DeepSeek - Into the Unknown", status: "complete", active: true, discarded: false, loading: false, windowId: 1, … }
serviceWorker.js:3321:1009
[PromptController] 🔍 Tab 2 URL check: ✅ DeepSeek URL serviceWorker.js:3321:1343
[PromptController] ✅ STEP 1 COMPLETE - Got tab 2 serviceWorker.js:3321:1493
[PromptController] ⏱️ Step 1 duration: 100ms serviceWorker.js:3321:1560
```

```
[ChatPanel] 📤 User sending message: {content: 'hello', contentLength: 5, selectedTabId: 2, folderPath: null, canAccept: true, …}
webview.js:2 [ChatPanel] 🔄 Posting message to window: {command: 'sendWebSocketMessage', messageType: 'sendPrompt', requestId: 'req-1764924276399', tabId: 2}
webview.js:2 [ChatPanel] 📦 Full message payload: {type: 'sendPrompt', tabId: 2, systemPrompt: null, userPrompt: 'hello', requestId: 'req-1764924276399', …}
webview.js:2 [ChatPanel] 🔍 Message size: 166 bytes
webview.js:2 [ChatPanel] 📞 Calling window.postMessage() at 1764924276400...
webview.js:2 [ChatPanel] ✅ window.postMessage() completed (0ms)
webview.js:2 [ChatPanel] 💡 Message should now be picked up by ChatFooter listener
webview.js:2 [ChatPanel] 🔍 ChatPanel message handler registered: {hasHandler: true, handlerType: 'function'}
webview.js:2 [ChatFooter] 📨 Received postMessage: {command: 'sendWebSocketMessage', hasData: true, dataType: 'sendPrompt'}
webview.js:2 [ChatFooter] 🔍 Message data: {type: 'sendPrompt', tabId: 2, requestId: 'req-1764924276399', hasUserPrompt: true, userPromptLength: 5}
webview.js:2 [ChatFooter] 🔍 WebSocket state check: {hasWs: true, readyState: 1, expectedState: 1, stateMapping: {…}, actualStateText: 'OPEN'}
webview.js:2 [ChatFooter] 📦 Preparing to send message...
webview.js:2 [ChatFooter] 📊 Message details: {type: 'sendPrompt', requestId: 'req-1764924276399', tabId: 2, userPromptLength: 5, systemPromptLength: 0, …}
webview.js:2 [ChatFooter] 📞 Calling ws.send()...
webview.js:2 [ChatFooter] ✅ ws.send() completed (0ms)
webview.js:2 [ChatFooter] 📨 Message sent via WebSocket: {requestId: 'req-1764924276399', type: 'sendPrompt', messageLength: 166, timestamp: 1764924276409}
webview.js:2 [App] 📨 WebSocket message received: {port: 3554, dataLength: 328}
webview.js:2 [App] 🔍 Message parsed: {type: 'promptResponse', hasTimestamp: false, messageAge: 'N/A'}
webview.js:2 [App] 🔄 Forwarding message to child component: {type: 'promptResponse', hasChatPanelHandler: true, selectedTab: undefined}
webview.js:2 [App] 📤 Calling ChatPanel handler for type: promptResponse
webview.js:2 [ChatPanel] 📨 handleIncomingMessage called: {type: 'promptResponse', requestId: 'req-1764924276399', tabId: 2, success: false, hasResponse: false, …}
webview.js:2 [ChatPanel] ✅ Processing promptResponse: {requestId: 'req-1764924276399', tabId: 2, expectedTabId: 2, success: false}
webview.js:2 [ChatPanel] ⏱️ Timeout cleared - response received
webview.js:2 [ChatPanel] ❌ promptResponse failed: Failed to send prompt to DeepSeek tab
window.__chatPanelMessageHandler @ webview.js:2
e.onmessage @ webview.js:2
webview.js:2 [App] 💬 promptResponse received: {requestId: 'req-1764924276399', success: false, hasResponse: false, error: 'Failed to send prompt to DeepSeek tab'}
webview.js:2 [App] 📨 WebSocket message received: {port: 3554, dataLength: 217}
webview.js:2 [App] 🔍 Message parsed: {type: 'focusedTabsUpdate', hasTimestamp: true, messageAge: 1}
webview.js:2 [App] 🔄 Forwarding message to child component: {type: 'focusedTabsUpdate', hasChatPanelHandler: true, selectedTab: undefined}
webview.js:2 [App] 📤 Calling ChatPanel handler for type: focusedTabsUpdate
webview.js:2 [ChatPanel] 📨 handleIncomingMessage called: {type: 'focusedTabsUpdate', requestId: undefined, tabId: undefined, success: undefined, hasResponse: false, …}
webview.js:2 [App] 📋 Tabs update: {tabCount: 1}
webview.js:2 [ChatPanel] 🎧 Registering handleIncomingMessage for tab 2
webview.js:2 [App] 📨 WebSocket message received: {port: 3554, dataLength: 233}
webview.js:2 [App] 🔍 Message parsed: {type: 'focusedTabsUpdate', hasTimestamp: true, messageAge: 1}
webview.js:2 [App] 🔄 Forwarding message to child component: {type: 'focusedTabsUpdate', hasChatPanelHandler: true, selectedTab: undefined}
webview.js:2 [App] 📤 Calling ChatPanel handler for type: focusedTabsUpdate
webview.js:2 [ChatPanel] 📨 handleIncomingMessage called: {type: 'focusedTabsUpdate', requestId: undefined, tabId: undefined, success: undefined, hasResponse: false, …}
webview.js:2 [App] 📋 Tabs update: {tabCount: 1}
webview.js:2 [ChatPanel] 🎧 Registering handleIncomingMessage for tab 2
webview.js:2 [App] 📨 WebSocket message received: {port: 3554, dataLength: 41}
webview.js:2 [App] 🔍 Message parsed: {type: 'ping', hasTimestamp: true, messageAge: 0}
webview.js:2 [App] 🔄 Forwarding message to child component: {type: 'ping', hasChatPanelHandler: true, selectedTab: undefined}
webview.js:2 [App] 📤 Calling ChatPanel handler for type: ping
webview.js:2 [ChatPanel] 📨 handleIncomingMessage called: {type: 'ping', requestId: undefined, tabId: undefined, success: undefined, hasResponse: false, …}
webview.js:2 [App] 🏓 Ping received, sending pong
webview.js:2 [ChatPanel] 🎧 Registering handleIncomingMessage for tab 2
```

