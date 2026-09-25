### `POST` https://claude.ai/api/v2/rum?ddsource=browser&dd-api-key=pub71869dceb5b70dba6123af9ca357d1f9&dd-evp-origin-version=7.6.0&dd-evp-origin=browser&dd-request-id=5551e601-e675-47d9-a1ae-115421d7ca7d&batch_time=1790240067049&_dd.api=beacon&build_ts=1790200925

| Status | Type |
|--------|------|
| 0 | other |

**Request Headers:**
```http
sec-ch-ua-platform: "Linux"
Referer: https://claude.ai/chat/41a6ed6a-b6ae-428e-839e-9633b2c8d07f
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
Content-Type: text/plain;charset=UTF-8
sec-ch-ua-mobile: ?0
```

**Response Headers:**
```http
X-Request-Status: Stale
```

**Request Body:**
```
{"type":"view","_dd":{"format_version":2,"drift":0,"configuration":{"session_sample_rate":100,"session_replay_sample_rate":0,"profiling_sample_rate":0,"trace_sample_rate":100,"start_session_replay_recording_manually":true},"sdk_name":"rum","page_states":[{"state":"active","start":-821800000},{"state":"passive","start":412800000},{"state":"active","start":7196200000},{"state":"passive","start":14332700000}],"document_version":7,"cls":{"device_pixel_ratio":1}},"application":{"id":"df447632-9210-4ee5-a49a-348e4fa17665"},"date":1790240050635,"source":"browser","view":{"url":"https://claude.ai/chat/{id}","referrer":"https://claude.ai/new","id":"05280068-7cd7-476a-9bbf-0b00d2bfbbae","name":"/chat/$uuid","action":{"count":52},"frustration":{"count":0},"cumulative_layout_shift":0.0975,"cumulative_layout_shift_time":6139400000,"cumulative_layout_shift_target_selector":"DIV[data-testid=\"chat-column\"]","error":{"count":0},"interaction_to_next_paint":64000000,"interaction_to_next_paint_time":13239400000,"interaction_to_next_paint_target_selector":"[id]>DIV>DIV>DIV>DIV>DIV>BUTTON","is_active":true,"loading_time":517000000,"loading_type":"route_change","long_task":{"count":7},"performance":{"cls":{"score":0.0975,"timestamp":6139400000,"target_selector":"DIV[data-testid=\"chat-column\"]","previous_rect":{"x":699,"y":56,"width":400,"height":846},"current_rect":{"x":296,"y":56,"width":793,"height":846}},"inp":{"duration":64000000,"timestamp":13239400000,"target_selector":"[id]>DIV>DIV>DIV>DIV>DIV>BUTTON","sub_parts":{"input_delay":1600000,"processing_duration":18600000,"presentation_delay":43800000}}},"resource":{"count":51},"time_spent":16404000000,"custom_timings":{"chat.create_round_trip":490000000,"page.surface_ready":397000000,"page.lazy_mount_wait":268800000,"chat.time_to_first_token":1649800000,"chat.perceived_time_to_first_token":1727400000,"chat.perceived_first_answer_token":7629000000,"chat.perceived_time_to_last_token":7867100000,"chat.highlight_worker_boot":471000000}},"feature_flags":{"claudified_upgrade_pill_dismiss_cooldown":"0"},"session":{"id":"a8031349-6a7a-40d4-8f48-2c456c35ae2d","type":"user","sampled_for_replay":false},"connectivity":{"status":"connected","effective_type":"4g"},"tab":{"id":"8a396082-abc5-4010-8adc-9c7d8f9059e0"},"context":{"entry_cache_policy":"revalidate","entry_served_at_age_ms":3483,"react_compiler":{"arm":"off","source":"edge"},"compile_hints":"on","compile_hints_match":0.668,"static_composer_rendered":true,"entry_pathname":"/new","early_hints":"none","entry_js_delivery":"cache","hidden_at_load":false,"is_automation":false,"nav_entry_type":"reload","nav_delivery_type":"other","visibility_at_nav_start":"visible","prerendered":false,"activation_start_ms":null,"chat_host":"classic","browse_lists_early_fetch":"adopted","static_critical_css":true,"document_variant":"full","static_composer_ready_ms":590,"composer_autofocused":true,"root_path_rewritten":false,"login_path_rewritten":false,"entry_hash_kind":"none","code_sidebar_live_latched":false,"rq_cache_retention_arm":"extended","rq_cache_tree_max_age_d":7,"conversation_store":"on","reduced_motion_app":false,"entry_css_initiator":"link","entry_js_initiator":"script","ua_form":"reduced","ua_client_hints":"match","screen_equals_viewport":false,"device_memory_gb":8,"hardware_concurrency":8,"network_effective_type":"4g","network_downlink_mbps":10,"network_rtt_ms":50,"network_save_data":false,"screen_short_side_px":1080,"screen_long_side_px":1920,"device_pixel_ratio":1,"client_utc_offset_min":420,"client_tz":"Asia/Saigon","max_touch_points":10,"prefers_reduced_motion":true,"device_year_class":2017,"same_path_load_streak":0,"had_focus":true,"rum_worker_mode":"worker","ua_architecture":"x86","ua_bitness":"64","i18n_messages_seed":"complete","i18n_messages_late_writes":1,"gb_payload_at_mount":"persisted","gb_payload_age_min_at_mount":1127,"gb_transcript_flags_changed":false,"gb_transcript_flags_changed_count":0,"gb_transcript_flags_after_usable":false,"hub_delivery":"absent","hub_delivery_entitled":false,"hub_sidebar_first_look":"classic","hub_boot_host_hint":"classic","rq_restore_verdict":"hydrated","rq_restore_mode":"sync_hydrate","bootstrap_cached_at_mount":true,"bootstrap_cached_fresh_at_mount":false,"code_switcher_latch":"1","sidebar_header_memory":"not_needed","idle_queue_boot_latch_source":"composer","chat_backend_latch":{"eligible":"off","hub_default":"off","hub_default_awaited_payload":false,"hub_default_settled_without_flags":false},"gb_payload_replaced_ms":10190,"font_load_cycles":3,"fonts_last_load_ms":274732,"fonts_ready_ms":12391,"code_sidebar_live_entitled":false,"rum_event_main_ms":25.7,"platform":"web","build_ts":1790200925,"ui_locale":"en-US","conversation_size_bucket":"1-9","entry_document":"app"},"usr":{"id":"9eced4d7-840e-4b24-b0a5-ab45dacdae01","organization_id":"f173b116-171f-4e54-ae94-96abb14fd273","plan":"default_claude_ai","org_type":"claude_free","anonymous_id":"32aa21c7-00f8-4a1c-844b-24954c8805fa"},"display":{"viewport":{"width":1920,"height":902},"scroll":{"max_depth":902,"max_depth_scroll_top":0,"max_scroll_height":902,"max_scroll_height_time":1351700000}},"service":"claude-ai","version":"deb3f0da2d","privacy":{"replay_level":"mask"},"device":{"locale":"en-US","locales":["en-US","en"],"time_zone":"Asia/Saigon"},"ddtags":"sdk_version:7.6.0,env:production,service:claude-ai,version:deb3f0da2d"}
{"type":"view","_dd":{"format_version":2,"drift":0,"configuration":{"session_sample_rate":100,"session_replay_sample_rate":0,"profiling_sample_rate":0,"trace_sample_rate":100,"start_session_replay_recording_manually":true},"sdk_name":"rum","page_states":[{"state":"active","start":0},{"state":"passive","start":15531100000},{"state":"active","start":229010500000},{"state":"passive","start":261362900000},{"state":"active","start":261684000000},{"state":"passive","start":262028200000},{"state":"active","start":264179100000},{"state":"passive","start":265314400000},{"state":"active","start":266078300000}],"document_version":23},"application":{"id":"df447632-9210-4ee5-a49a-348e4fa17665"},"date":1790239783735,"source":"browser","view":{"url":"https://claude.ai/new","referrer":"","id":"1813502e-5023-4db6-9d6e-7f41fd729b91","name":"/new","action":{"count":48},"frustration":{"count":0},"cumulative_layout_shift":0,"first_byte":205300000,"dom_complete":12325400000,"dom_content_loaded":3772700000,"dom_interactive":602300000,"error":{"count":0},"first_contentful_paint":620000000,"interaction_to_next_paint":48000000,"interaction_to_next_paint_time":229005300000,"is_active":false,"largest_contentful_paint":620000000,"largest_contentful_paint_target_selector":"[id]","load_event":12336900000,"loading_time":15811000000,"loading_type":"initial_load","long_task":{"count":24},"performance":{"cls":{"score":0},"fcp":{"timestamp":620000000},"inp":{"duration":48000000,"timestamp":229005300000,"sub_parts":{"input_delay":12400000,"processing_duration":600000,"presentation_delay":35000000}},"lcp":{"timestamp":620000000,"target_selector":"[id]","sub_parts":{"load_delay":0,"load_time":0,"render_delay":414700000}}},"resource":{"count":375},"time_spent":266900000000,"custom_timings":{"app.bootstrap_ready":3793800000,"app.conversation_list_prefetch_ready":12789100000,"page.rq_cache_restore":3841400000,"page.new_chat_input_ready":8891100000,"page.sidebar_recents_settled":6764000000,"page.sidebar_recents_painted":74404000000,"page.new_below_fold_mounted":67030000000,"page.lazy_mount_wait":2014900000,"claudeai.chat.message_queue.auto_sent":0}},"feature_flags":{"cai_bubbly_creek":"1","cardinal":"1"},"session":{"id":"a8031349-6a7a-40d4-8f48-2c456c35ae2d","type":"user","sampled_for_replay":false},"connectivity":{"status":"connected","effective_type":"4g"},"tab":{"id":"8a396082-abc5-4010-8adc-9c7d8f9059e0"},"context":{"entry_cache_policy":"revalidate","entry_served_at_age_ms":3483,"react_compiler":{"arm":"off","source":"edge"},"compile_hints":"on","compile_hints_match":0.668,"static_composer_rendered":true,"entry_pathname":"/new","early_hints":"none","entry_js_delivery":"cache","hidden_at_load":false,"is_automation":false,"nav_entry_type":"reload","nav_delivery_type":"other","visibility_at_nav_start":"visible","prerendered":false,"activation_start_ms":null,"chat_host":"classic","browse_lists_early_fetch":"adopted","static_critical_css":true,"document_variant":"full","static_composer_ready_ms":590,"composer_autofocused":true,"root_path_rewritten":false,"login_path_rewritten":false,"entry_hash_kind":"none","code_sidebar_live_latched":false,"rq_cache_retention_arm":"extended","rq_cache_tree_max_age_d":7,"conversation_store":"on","reduced_motion_app":false,"entry_css_initiator":"link","entry_js_initiator":"script","ua_form":"reduced","ua_client_hints":"match","screen_equals_viewport":false,"device_memory_gb":8,"hardware_concurrency":8,"network_effective_type":"4g","network_downlink_mbps":10,"network_rtt_ms":50,"network_save_data":false,"screen_short_side_px":1080,"screen_long_side_px":1920,"device_pixel_ratio":1,"client_utc_offset_min":420,"client_tz":"Asia/Saigon","max_touch_points":10,"prefers_reduced_motion":true,"device_year_class":2017,"same_path_load_streak":0,"had_focus":true,"rum_worker_mode":"worker","ua_architecture":"x86","ua_bitness":"64","i18n_messages_seed":"complete","i18n_messages_late_writes":1,"gb_payload_at_mount":"persisted","gb_payload_age_min_at_mount":1127,"gb_transcript_flags_changed":false,"gb_transcript_flags_changed_count":0,"gb_transcript_flags_after_usable":false,"hub_delivery":"absent","hub_delivery_entitled":false,"hub_sidebar_first_look":"classic","hub_boot_host_hint":"classic","rq_restore_verdict":"hydrated","rq_restore_mode":"sync_hydrate","bootstrap_cached_at_mount":true,"bootstrap_cached_fresh_at_mount":false,"code_switcher_latch":"1","sidebar_header_memory":"not_needed","idle_queue_boot_latch_source":"composer","chat_backend_latch":{"eligible":"off","hub_default":"off","hub_default_awaited_payload":false,"hub_default_settled_without_flags":false},"gb_payload_replaced_ms":10190,"font_load_cycles":3,"fonts_last_load_ms":274732,"fonts_ready_ms":12391,"code_sidebar_live_entitled":false,"rum_event_main_ms":17.7,"platform":"web","build_ts":1790200925,"ui_locale":"en-US","conversation_size_bucket":"1-9","was_discarded":false,"cs_60s":{"transcript_msgs_bucket":null,"streamed":false,"composer_blocks_bucket":"lt_4","composer_doc_size_bucket":"lt_200","rows_held_bucket":null,"live_block_size_bucket":null,"live_citations_bucket":null,"tool_json_bucket":null,"reply_chars_bucket":null},"entry_document":"app"},"usr":{"id":"9eced4d7-840e-4b24-b0a5-ab45dacdae01","organization_id":"f173b116-171f-4e54-ae94-96abb14fd273","plan":"default_claude_ai","org_type":"claude_free","anonymous_id":"32aa21c7-00f8-4a1c-844b-24954c8805fa"},"display":{"viewport":{"width":1920,"height":902},"scroll":{"max_depth":902,"max_depth_scroll_top":0,"max_scroll_height":902,"max_scroll_height_time":75066200000}},"service":"claude-ai","version":"deb3f0da2d","privacy":{"replay_level":"mask"},"device":{"locale":"en-US","locales":["en-US","en"],"time_zone":"Asia/Saigon"},"ddtags":"sdk_version:7.6.0,env:production,service:claude-ai,version:deb3f0da2d"}
```

**Response Body:**
*(No body)*


---

### `POST` https://claude.ai/api/v2/rum?ddsource=browser&dd-api-key=pub71869dceb5b70dba6123af9ca357d1f9&dd-evp-origin-version=7.6.0&dd-evp-origin=browser&dd-request-id=01cfa2ec-6f7b-4233-b0c6-180bdf7b1811&dd-evp-encoding=deflate&batch_time=1790240067048&_dd.api=beacon&build_ts=1790200925

| Status | Type |
|--------|------|
| 0 | other |

**Request Headers:**
```http
sec-ch-ua-platform: "Linux"
Referer: https://claude.ai/chat/41a6ed6a-b6ae-428e-839e-9633b2c8d07f
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
Content-Type: text/plain
sec-ch-ua-mobile: ?0
```

**Response Headers:**
```http
X-Request-Status: Stale
```

**Request Body:**
*(No body)*

**Response Body:**
*(No body)*


---

### `POST` https://claude.ai/api/event_logging/v2/batch

| Status | Type |
|--------|------|
| 200 | fetch |

**Request Headers:**
```http
sec-ch-ua-platform: "Linux"
Referer: https://claude.ai/chat/41a6ed6a-b6ae-428e-839e-9633b2c8d07f
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
x-organization-uuid: f173b116-171f-4e54-ae94-96abb14fd273
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Content-Type: application/json
x-service-name: claude_ai_web
```

**Response Headers:**
```http
Transfer-Encoding: chunked
X-Robots-Tag: none
Content-Encoding: br
cf-cache-status: DYNAMIC
Connection: keep-alive
access-control-allow-credentials: true
request-id: req_011CfMyy639VU19hmEZibPSS
CF-RAY: a400905dfdd1cdf2-SIN
server-timing: x-originResponse;dur=15
alt-svc: h3=":443"; ma=86400
accept-encoding: zstd,gzip
Date: Thu, 24 Sep 2026 08:54:21 GMT
Content-Type: application/json
vary: Accept-Encoding
Server: cloudflare
```

**Request Body:**
```json
{
  "events": [
    {
      "event_type": "HealthMetricEvent",
      "event_data": {
        "event_id": "3db6baf1-b481-49f3-88c3-6a83525df35a",
        "event_timestamp": "2026-09-24T08:54:10.947Z",
        "action": "chat.conversation_open",
        "surface": "chat",
        "outcome": "success",
        "variant": "creation_redirect",
        "product_surface": "chat",
        "app_version": "deb3f0da2d",
        "platform": "web",
        "first_party_host": true,
        "is_automation": false,
        "ua_form": "reduced",
        "ua_client_hints": "match",
        "screen_equals_viewport": false,
        "conversation_id": "41a6ed6a-b6ae-428e-839e-9633b2c8d07f"
      }
    },
    {
      "event_type": "HealthMetricEvent",
      "event_data": {
        "event_id": "13d5e03e-ea80-4176-a9f1-800ddc0781be",
        "event_timestamp": "2026-09-24T08:54:12.184Z",
        "action": "chat.conversation_create",
        "surface": "chat",
        "outcome": "success",
        "variant": "inline",
        "model": "claude-sonnet-5",
        "app_version": "deb3f0da2d",
        "platform": "web",
        "first_party_host": true,
        "is_automation": false,
        "ua_form": "reduced",
        "ua_client_hints": "match",
        "screen_equals_viewport": false,
        "conversation_id": "41a6ed6a-b6ae-428e-839e-9633b2c8d07f"
      }
    },
    {
      "event_type": "HealthMetricEvent",
      "event_data": {
        "event_id": "cbeb8b75-7b58-457c-a05d-2b8304261a7b",
        "event_timestamp": "2026-09-24T08:54:12.186Z",
        "action": "chat.message_send",
        "surface": "chat",
        "outcome": "success",
        "model": "claude-sonnet-5",
        "app_version": "deb3f0da2d",
        "platform": "web",
        "first_party_host": true,
        "is_automation": false,
        "ua_form": "reduced",
        "ua_client_hints": "match",
        "screen_equals_viewport": false,
        "conversation_id": "41a6ed6a-b6ae-428e-839e-9633b2c8d07f"
      }
    },
    {
      "event_type": "HealthMetricEvent",
      "event_data": {
        "event_id": "a785bbe2-89db-4e53-894f-d2933dcf81df",
        "event_timestamp": "2026-09-24T08:54:18.179Z",
        "action": "chat.message_stream_complete",
        "surface": "chat",
        "outcome": "success",
        "variant": "sse",
        "model": "claude-sonnet-5",
        "app_version": "deb3f0da2d",
        "platform": "web",
        "first_party_host": true,
        "is_automation": false,
        "ua_form": "reduced",
        "ua_client_hints": "match",
        "screen_equals_viewport": false,
        "conversation_id": "41a6ed6a-b6ae-428e-839e-9633b2c8d07f"
      }
    }
  ]
}
```

**Response Body:**
```json
{
  "accepted_count": 4,
  "rejected_count": 0
}
```


---

### `GET` https://claude.ai/api/organizations/f173b116-171f-4e54-ae94-96abb14fd273/conversations/41a6ed6a-b6ae-428e-839e-9633b2c8d07f/wiggle/download-file?path=%2Fmnt%2Fuser-data%2Foutputs%2Ftest.js

| Status | Type |
|--------|------|
| 200 | fetch |

**Request Headers:**
```http
anthropic-anonymous-id: claudeai.v1.6e346c59-fb65-49a1-9be4-b80c8cf2b003
x-activity-session-id: f78aa7cc-c857-463e-a169-9e51e0fb7daf
x-datadog-parent-id: 1045004497155875504
sec-ch-ua-platform: "Linux"
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
anthropic-client-sha: deb3f0da2df1715abe98bd8c2f32f8eb6d85c27d
x-datadog-trace-id: 4060965908798637490
traceparent: 00-0000000000000000385b72fa66ea05b2-0e809a0db1a962b0-01
anthropic-client-build: 1790200925
content-type: application/json
anthropic-client-capabilities: mfa_sms_v1
anthropic-client-platform: web_claude_ai
tracestate: dd=s:1;o:rum
x-datadog-origin: rum
anthropic-device-id: 6c9e5798-0d9c-4bb2-957f-4bd743a94370
Referer: https://claude.ai/chat/41a6ed6a-b6ae-428e-839e-9633b2c8d07f
accept-language: en-US, en;q=0.9
anthropic-client-version: 1.0.0
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
x-datadog-sampling-priority: 1
```

**Response Headers:**
```http
strict-transport-security: max-age=31536000; includeSubDomains; preload
X-Robots-Tag: none
Cache-Control: private, no-cache
cf-cache-status: DYNAMIC
etag: "0c6b5790e885dc16172c7d4b2931637c"
request-id: req_011CfMyy4ug799CnAeBEWDEX
CF-RAY: a400905c2da4f8f8-SIN
server-timing: x-originResponse;dur=707
alt-svc: h3=":443"; ma=86400
Content-Length: 64
Date: Thu, 24 Sep 2026 08:54:21 GMT
Content-Type: application/octet-stream
vary: Accept-Encoding
Server: cloudflare
content-disposition: attachment; filename*=utf-8''test.js
```

**Request Body:**
*(No body)*

**Response Body:**
```
ZnVuY3Rpb24gYWRkKGEsIGIpIHsKICByZXR1cm4gYSArIGI7Cn0KCmNvbnNvbGUubG9nKGFkZCgyLCAzKSk7Cg==
```


---

### `POST` https://claude.ai/api/event_logging/v2/batch

| Status | Type |
|--------|------|
| 200 | fetch |

**Request Headers:**
```http
sec-ch-ua-platform: "Linux"
Referer: https://claude.ai/chat/41a6ed6a-b6ae-428e-839e-9633b2c8d07f
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
x-organization-uuid: f173b116-171f-4e54-ae94-96abb14fd273
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
content-type: application/json
x-service-name: claude_ai_web
```

**Response Headers:**
```http
Transfer-Encoding: chunked
X-Robots-Tag: none
Content-Encoding: br
cf-cache-status: DYNAMIC
Connection: keep-alive
access-control-allow-credentials: true
request-id: req_011CfMyy4aazsTh4H8GqLtHR
CF-RAY: a400905bbf24fe03-SIN
server-timing: x-originResponse;dur=75
alt-svc: h3=":443"; ma=86400
accept-encoding: zstd,gzip
Date: Thu, 24 Sep 2026 08:54:21 GMT
Content-Type: application/json
vary: Accept-Encoding
Server: cloudflare
```

**Request Body:**
```json
{
  "events": [
    {
      "event_type": "GrowthbookExperimentEvent",
      "event_data": {
        "device_id": "6c9e5798-0d9c-4bb2-957f-4bd743a94370",
        "anonymous_id": "claudeai.v1.6e346c59-fb65-49a1-9be4-b80c8cf2b003",
        "timestamp": "2026-09-24T08:54:10.700Z",
        "experiment_id": "claudified_upgrade_pill_dismiss_cooldown",
        "variation_id": 0,
        "environment": "production"
      },
      "organization_uuid": "f173b116-171f-4e54-ae94-96abb14fd273"
    }
  ]
}
```

**Response Body:**
```json
{
  "accepted_count": 1,
  "rejected_count": 0
}
```


---

### `GET` https://claude.ai/images/install-hub/claude_code_desktop-icon-dark.svg

| Status | Type |
|--------|------|
| 200 | img |

**Request Headers:**
```http
sec-ch-ua-platform: "Linux"
Referer: https://claude.ai/chat/41a6ed6a-b6ae-428e-839e-9633b2c8d07f
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
```

**Response Headers:**
```http
X-Robots-Tag: none
Content-Encoding: br
CF-Cache-Status: HIT
ETag: W/"b800dcd0a5084e1b26d72e177a4ebffe"
X-Content-Type-Options: nosniff
alt-svc: h3=":443"; ma=86400
Date: Thu, 24 Sep 2026 08:54:18 GMT
Content-Type: image/svg+xml
Vary: accept-encoding
X-Frame-Options: DENY
Transfer-Encoding: chunked
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Cache-Control: public, max-age=86400, stale-while-revalidate=604800
Cross-Origin-Opener-Policy: same-origin-allow-popups
x-ion-version: 54bbc40c-77c8-4b64-85ab-b8c58bcdf174
Connection: keep-alive
Cross-Origin-Resource-Policy: same-origin
Referrer-Policy: strict-origin-when-cross-origin
CF-RAY: a400904e6b80cdf2-SIN
Permissions-Policy: accelerometer=self, attribution-reporting=*, autoplay=(self "https://www.youtube-nocookie.com"), bluetooth=self, browsing-topics=*, camera=(self "https://*.claudemcpcontent.com"), clipboard-read=self, clipboard-write=(self "https://*.claudemcpcontent.com"), compute-pressure=self, display-capture=self, encrypted-media=self, fullscreen=(self "https://www.youtube-nocookie.com"), gamepad=self, geolocation=(self "https://*.claudemcpcontent.com"), gyroscope=self, hid=self, identity-credentials-get=self, idle-detection=self, local-fonts=self, magnetometer=self, microphone=(self "https://*.claudemcpcontent.com"), midi=self, otp-credentials=self, picture-in-picture=*, publickey-credentials-create=self, publickey-credentials-get=self, screen-wake-lock=self, serial=self, storage-access=*, unload=(), usb=self, web-share=self, window-management=self, xr-spatial-tracking=self
X-XSS-Protection: 1; mode=block
Server: cloudflare
```

**Request Body:**
*(No body)*

**Response Body:**
```
PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgc3Ryb2tlPSIjQzNDMkI3IiBzdHJva2Utd2lkdGg9IjEuMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KPHBhdGggZD0iTTEzLjc1IDEzLjVMMTcuMjUgMTBMMTMuNzUgNi41Ii8+CjxsaW5lIHgxPSI5IiB5MT0iMTYiIHgyPSIxMSIgeTI9IjQiLz4KPHBhdGggZD0iTTYuMjUgMTMuNUwyLjc1IDEwTDYuMjUgNi41Ii8+CjwvZz4KPC9zdmc+Cg==
```


---

### `GET` https://claude.ai/images/install-hub/claude_code_desktop-icon.svg

| Status | Type |
|--------|------|
| 200 | img |

**Request Headers:**
```http
sec-ch-ua-platform: "Linux"
Referer: https://claude.ai/chat/41a6ed6a-b6ae-428e-839e-9633b2c8d07f
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
```

**Response Headers:**
```http
X-Robots-Tag: none
Content-Encoding: br
CF-Cache-Status: HIT
ETag: W/"a28b0662a21e360c809bb120747695d9"
X-Content-Type-Options: nosniff
alt-svc: h3=":443"; ma=86400
Date: Thu, 24 Sep 2026 08:54:18 GMT
Content-Type: image/svg+xml
Vary: accept-encoding
X-Frame-Options: DENY
Transfer-Encoding: chunked
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Cache-Control: public, max-age=86400, stale-while-revalidate=604800
Cross-Origin-Opener-Policy: same-origin-allow-popups
x-ion-version: 54bbc40c-77c8-4b64-85ab-b8c58bcdf174
Connection: keep-alive
Cross-Origin-Resource-Policy: same-origin
Referrer-Policy: strict-origin-when-cross-origin
CF-RAY: a400904e6bfbf838-SIN
Permissions-Policy: accelerometer=self, attribution-reporting=*, autoplay=(self "https://www.youtube-nocookie.com"), bluetooth=self, browsing-topics=*, camera=(self "https://*.claudemcpcontent.com"), clipboard-read=self, clipboard-write=(self "https://*.claudemcpcontent.com"), compute-pressure=self, display-capture=self, encrypted-media=self, fullscreen=(self "https://www.youtube-nocookie.com"), gamepad=self, geolocation=(self "https://*.claudemcpcontent.com"), gyroscope=self, hid=self, identity-credentials-get=self, idle-detection=self, local-fonts=self, magnetometer=self, microphone=(self "https://*.claudemcpcontent.com"), midi=self, otp-credentials=self, picture-in-picture=*, publickey-credentials-create=self, publickey-credentials-get=self, screen-wake-lock=self, serial=self, storage-access=*, unload=(), usb=self, web-share=self, window-management=self, xr-spatial-tracking=self
X-XSS-Protection: 1; mode=block
Server: cloudflare
```

**Request Body:**
*(No body)*

**Response Body:**
```
PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgc3Ryb2tlPSIjNTI1MTRFIiBzdHJva2Utd2lkdGg9IjEuMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KPHBhdGggZD0iTTEzLjc1IDEzLjVMMTcuMjUgMTBMMTMuNzUgNi41Ii8+CjxsaW5lIHgxPSI5IiB5MT0iMTYiIHgyPSIxMSIgeTI9IjQiLz4KPHBhdGggZD0iTTYuMjUgMTMuNUwyLjc1IDEwTDYuMjUgNi41Ii8+CjwvZz4KPC9zdmc+Cg==
```


---

### `POST` https://claude.ai/api/v2/rum?ddsource=browser&dd-api-key=pub71869dceb5b70dba6123af9ca357d1f9&dd-evp-origin-version=7.6.0&dd-evp-origin=browser&dd-request-id=43a2904a-b09f-4ead-b483-5af2f4858d3f&dd-evp-encoding=deflate&batch_time=1790240058536&_dd.api=fetch&build_ts=1790200925

| Status | Type |
|--------|------|
| 202 | fetch |

**Request Headers:**
```http
sec-ch-ua-platform: "Linux"
Referer: https://claude.ai/chat/41a6ed6a-b6ae-428e-839e-9633b2c8d07f
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
Content-Type: text/plain
sec-ch-ua-mobile: ?0
```

**Response Headers:**
```http
X-Robots-Tag: none
Content-Encoding: br
cf-cache-status: DYNAMIC
x-content-type-options: nosniff
request-id: req_011CfMyxuUeScJq6HqTS361R
server-timing: x-originResponse;dur=105
alt-svc: h3=":443"; ma=86400
accept-encoding: identity,gzip,x-gzip,deflate,x-deflate,zstd
Date: Thu, 24 Sep 2026 08:54:18 GMT
Content-Type: application/json
vary: Accept-Encoding
dd-request-id: 43a2904a-b09f-4ead-b483-5af2f4858d3f
Transfer-Encoding: chunked
strict-transport-security: max-age=31536000; includeSubDomains; preload
Connection: keep-alive
cross-origin-resource-policy: cross-origin
CF-RAY: a400904e3fc8f8f8-SIN
access-control-allow-origin: *
Server: cloudflare
```

**Request Body:**
*(No body)*

**Response Body:**
```json
{
  "request_id": "43a2904a-b09f-4ead-b483-5af2f4858d3f"
}
```


---

### `GET` https://claude.ai/api/organizations/f173b116-171f-4e54-ae94-96abb14fd273/chat_conversations/41a6ed6a-b6ae-428e-839e-9633b2c8d07f?tree=True&rendering_mode=messages&render_all_tools=true&include_inline_comparison=true&consistency=eventual

| Status | Type |
|--------|------|
| 200 | fetch |

**Request Headers:**
```http
anthropic-anonymous-id: claudeai.v1.6e346c59-fb65-49a1-9be4-b80c8cf2b003
x-activity-session-id: f78aa7cc-c857-463e-a169-9e51e0fb7daf
x-datadog-parent-id: 3931732453596252748
sec-ch-ua-platform: "Linux"
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
anthropic-client-sha: deb3f0da2df1715abe98bd8c2f32f8eb6d85c27d
x-datadog-trace-id: 2825831502890208204
traceparent: 00-000000000000000027375ec7ace10bcc-369051d5d87aca4c-01
anthropic-client-build: 1790200925
content-type: application/json
anthropic-client-capabilities: mfa_sms_v1
anthropic-client-platform: web_claude_ai
tracestate: dd=s:1;o:rum
x-datadog-origin: rum
anthropic-device-id: 6c9e5798-0d9c-4bb2-957f-4bd743a94370
Referer: https://claude.ai/chat/41a6ed6a-b6ae-428e-839e-9633b2c8d07f
accept-language: en-US, en;q=0.9
anthropic-client-version: 1.0.0
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
x-datadog-sampling-priority: 1
```

**Response Headers:**
```http
X-Robots-Tag: none
Content-Encoding: br
cf-cache-status: DYNAMIC
server-timing: x-originResponse;dur=186
alt-svc: h3=":443"; ma=86400
Date: Thu, 24 Sep 2026 08:54:19 GMT
Content-Type: application/json
vary: Accept-Encoding
strict-transport-security: max-age=31536000; includeSubDomains; preload
Cache-Control: no-store, no-cache, must-revalidate
pragma: no-cache
Connection: keep-alive
CF-RAY: a400904deeb6fe03-SIN
Content-Length: 2042
Server: cloudflare
x-upstream-request-id: req_011CfMyxuCH9o6xyfuSMyDqW
```

**Request Body:**
*(No body)*

**Response Body:**
```json
{
  "uuid": "41a6ed6a-b6ae-428e-839e-9633b2c8d07f",
  "name": "Tạo file JavaScript cộng hai số",
  "summary": "",
  "model": "claude-sonnet-5",
  "created_at": "2026-09-24T08:54:10.879020Z",
  "updated_at": "2026-09-24T08:54:17.878389Z",
  "settings": {
    "enabled_web_search": true,
    "enabled_monkeys_in_a_barrel": true,
    "enabled_saffron": true,
    "tool_search_mode": "auto",
    "thinking_mode": "auto",
    "effort_level": "low",
    "chat_memory_mode": "enabled",
    "preview_feature_uses_artifacts": true,
    "enabled_turmeric": true
  },
  "is_starred": false,
  "is_archived": false,
  "is_temporary": false,
  "workspace_upgraded": false,
  "platform": "CLAUDE_AI",
  "is_wiggle_enabled": true,
  "effective_thinking_mode": "auto",
  "current_leaf_message_uuid": "01a0d29f-4d78-7128-a9b6-8bfd0e0ba79a",
  "chat_messages": [
    {
      "uuid": "01a0d29f-4d78-79e1-8c3f-8d15218afc3b",
      "text": "",
      "content": [
        {
          "start_timestamp": "2026-09-24T08:54:11.944885Z",
          "stop_timestamp": "2026-09-24T08:54:11.944885Z",
          "type": "text",
          "text": "tạo 1 file test.js với nội dung là hàm công  2 số nguyên. có dòng chạy hàm với 2 prop là 2 với 3. sau đó chạy file lấy result",
          "citations": []
        }
      ],
      "sender": "human",
      "index": 0,
      "created_at": "2026-09-24T08:54:11.945165Z",
      "updated_at": "2026-09-24T08:54:11.945165Z",
      "truncated": false,
      "attachments": [],
      "files": [],
      "sync_sources": [],
      "parent_message_uuid": "00000000-0000-4000-8000-000000000000"
    },
    {
      "uuid": "01a0d29f-4d78-7128-a9b6-8bfd0e0ba79a",
      "text": "",
      "content": [
        {
          "start_timestamp": "2026-09-24T08:54:11.939896Z",
          "stop_timestamp": "2026-09-24T08:54:12.797814Z",
          "type": "tool_use",
          "id": "toolu_01N975bE6UWNjbjyiQL5jZSF",
          "name": "create_file",
          "input": {
            "path": "/mnt/user-data/outputs/test.js",
            "file_text": "function add(a, b) {\n  return a + b;\n}\n\nconsole.log(add(2, 3));\n",
            "description": "Tạo file test.js với hàm cộng 2 số nguyên và dòng gọi hàm"
          },
          "message": "Tạo file test.js với hàm cộng 2 số nguyên và dòng gọi hàm",
          "integration_name": "File Creation",
          "icon_name": "file",
          "display_content": {
            "type": "json_block",
            "json_block": "{\"language\": \"javascript\", \"code\": \"function add(a, b) {\\n  return a + b;\\n}\\n\\nconsole.log(add(2, 3));\\n\", \"filename\": \"/mnt/user-data/outputs/test.js\"}"
          },
          "tool_origin": "first_party"
        },
        {
          "start_timestamp": "2026-09-24T08:54:13.895062Z",
          "stop_timestamp": "2026-09-24T08:54:13.895095Z",
          "type": "tool_result",
          "tool_use_id": "toolu_01N975bE6UWNjbjyiQL5jZSF",
          "name": "create_file",
          "content": [
            {
              "type": "text",
              "text": "File created successfully: /mnt/user-data/outputs/test.js",
              "uuid": "97f60744-9cc8-445f-870c-5f0b9e7d48a8"
            }
          ],
          "is_error": false,
          "meta": {
            "output_format_category": "other"
          },
          "integration_name": "File Creation",
          "icon_name": "file",
          "display_content": {
            "type": "text",
            "text": "File created successfully: /mnt/user-data/outputs/test.js"
          },
          "tool_origin": "first_party"
        },
        {
          "start_timestamp": "2026-09-24T08:54:14.661787Z",
          "stop_timestamp": "2026-09-24T08:54:15.057402Z",
          "type": "tool_use",
          "id": "toolu_01RjV2yfpG33QFc4fAagLRfw",
          "name": "bash_tool",
          "input": {
            "command": "node /mnt/user-data/outputs/test.js",
            "description": "Chạy file test.js để lấy kết quả"
          },
          "message": "Chạy file test.js để lấy kết quả",
          "integration_name": "File Creation",
          "icon_name": "commandLinePrompt",
          "display_content": {
            "type": "json_block",
            "json_block": "{\"language\": \"bash\", \"code\": \"node /mnt/user-data/outputs/test.js\"}"
          },
          "tool_origin": "first_party"
        },
        {
          "start_timestamp": "2026-09-24T08:54:15.429421Z",
          "stop_timestamp": "2026-09-24T08:54:15.429460Z",
          "type": "tool_result",
          "tool_use_id": "toolu_01RjV2yfpG33QFc4fAagLRfw",
          "name": "bash_tool",
          "content": [
            {
              "type": "text",
              "text": "{\"returncode\":0,\"stdout\":\"5\\n\",\"stderr\":\"\"}",
              "uuid": "fa7c028e-b68e-44ba-94c3-bb287badf4a4"
            }
          ],
          "is_error": false,
          "meta": {
            "output_format_category": "none"
          },
          "integration_name": "File Creation",
          "icon_name": "commandLinePrompt",
          "display_content": {
            "type": "json_block",
            "json_block": "{\"returncode\":0,\"stdout\":\"5\\n\",\"stderr\":\"\"}"
          },
          "tool_origin": "first_party"
        },
        {
          "start_timestamp": "2026-09-24T08:54:16.155880Z",
          "stop_timestamp": "2026-09-24T08:54:16.455729Z",
          "type": "tool_use",
          "id": "toolu_01X5FzhwE7WJx7hmNJQrQNxV",
          "name": "present_files",
          "input": {
            "filepaths": [
              "/mnt/user-data/outputs/test.js"
            ]
          },
          "message": "Presenting file(s)...",
          "integration_name": "File Creation",
          "icon_name": "file",
          "display_content": {
            "type": "table",
            "table": [
              [
                "filepaths",
                "['/mnt/user-data/outputs/test.js']"
              ]
            ]
          },
          "tool_origin": "first_party"
        },
        {
          "start_timestamp": "2026-09-24T08:54:16.479080Z",
          "stop_timestamp": "2026-09-24T08:54:16.479105Z",
          "type": "tool_result",
          "tool_use_id": "toolu_01X5FzhwE7WJx7hmNJQrQNxV",
          "name": "present_files",
          "content": [
            {
              "type": "local_resource",
              "file_path": "/mnt/user-data/outputs/test.js",
              "name": "test",
              "mime_type": "text/javascript",
              "artifact_publishable": false,
              "uuid": "a91d6672-5cad-4ac8-a2c1-dabe9f3585bb"
            },
            {
              "type": "text",
              "text": "The file cards appear at the end of your reply if it ends with text, otherwise under this step; say they are below only if you finish the reply with text.",
              "uuid": "ca91cd1e-769d-41fa-a076-bdf59f5dfde5"
            }
          ],
          "is_error": false,
          "meta": {
            "output_format_category": "other"
          },
          "message": "Presented file",
          "integration_name": "File Creation",
          "icon_name": "file",
          "tool_origin": "first_party"
        },
        {
          "start_timestamp": "2026-09-24T08:54:17.849303Z",
          "stop_timestamp": "2026-09-24T08:54:17.861779Z",
          "type": "text",
          "text": "Mình đã tạo file `test.js` và chạy thử. Kết quả là **5**.\n\n```js\nfunction add(a, b) {\n  return a + b;\n}\n\nconsole.log(add(2, 3));\n```\n\nFile đính kèm ở bên dưới.",
          "citations": []
        }
      ],
      "sender": "assistant",
      "index": 1,
      "created_at": "2026-09-24T08:54:17.878389Z",
      "updated_at": "2026-09-24T08:54:17.878389Z",
      "truncated": false,
      "stop_reason": "end_turn",
      "attachments": [],
      "files": [],
      "sync_sources": [],
      "parent_message_uuid": "01a0d29f-4d78-79e1-8c3f-8d15218afc3b"
    }
  ]
}
```


---

### `GET` https://claude.ai/api/organizations/f173b116-171f-4e54-ae94-96abb14fd273/conversations/41a6ed6a-b6ae-428e-839e-9633b2c8d07f/wiggle/download-file?path=%2Fmnt%2Fuser-data%2Foutputs%2Ftest.js

| Status | Type |
|--------|------|
| 200 | fetch |

**Request Headers:**
```http
anthropic-anonymous-id: claudeai.v1.6e346c59-fb65-49a1-9be4-b80c8cf2b003
x-activity-session-id: f78aa7cc-c857-463e-a169-9e51e0fb7daf
x-datadog-parent-id: 4413557960983988289
sec-ch-ua-platform: "Linux"
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
anthropic-client-sha: deb3f0da2df1715abe98bd8c2f32f8eb6d85c27d
x-datadog-trace-id: 10187806052318417732
traceparent: 00-00000000000000008d625ba095039344-3d401b94dc0c4841-01
anthropic-client-build: 1790200925
content-type: application/json
anthropic-client-capabilities: mfa_sms_v1
anthropic-client-platform: web_claude_ai
tracestate: dd=s:1;o:rum
x-datadog-origin: rum
anthropic-device-id: 6c9e5798-0d9c-4bb2-957f-4bd743a94370
Referer: https://claude.ai/chat/41a6ed6a-b6ae-428e-839e-9633b2c8d07f
accept-language: en-US, en;q=0.9
anthropic-client-version: 1.0.0
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
x-datadog-sampling-priority: 1
```

**Response Headers:**
```http
strict-transport-security: max-age=31536000; includeSubDomains; preload
X-Robots-Tag: none
Cache-Control: private, no-cache
cf-cache-status: DYNAMIC
etag: "0c6b5790e885dc16172c7d4b2931637c"
Connection: keep-alive
request-id: req_011CfMyxne8YinrcaEvEwJkb
CF-RAY: a40090431864fe03-SIN
server-timing: x-originResponse;dur=972
alt-svc: h3=":443"; ma=86400
Content-Length: 64
Date: Thu, 24 Sep 2026 08:54:18 GMT
Content-Type: application/octet-stream
content-disposition: attachment; filename*=utf-8''test.js
Server: cloudflare
```

**Request Body:**
*(No body)*

**Response Body:**
```
ZnVuY3Rpb24gYWRkKGEsIGIpIHsKICByZXR1cm4gYSArIGI7Cn0KCmNvbnNvbGUubG9nKGFkZCgyLCAzKSk7Cg==
```


---

### `GET` https://claude.ai/api/account/raven_eligible

| Status | Type |
|--------|------|
| 200 | fetch |

**Request Headers:**
```http
anthropic-anonymous-id: claudeai.v1.6e346c59-fb65-49a1-9be4-b80c8cf2b003
x-activity-session-id: f78aa7cc-c857-463e-a169-9e51e0fb7daf
x-datadog-parent-id: 7610875639456109655
sec-ch-ua-platform: "Linux"
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
anthropic-client-sha: deb3f0da2df1715abe98bd8c2f32f8eb6d85c27d
x-datadog-trace-id: 16308763320226506974
traceparent: 00-0000000000000000e2545dd50c0568de-699f4311e7749457-01
anthropic-client-build: 1790200925
content-type: application/json
anthropic-client-capabilities: mfa_sms_v1
anthropic-client-platform: web_claude_ai
tracestate: dd=s:1;o:rum
x-datadog-origin: rum
anthropic-device-id: 6c9e5798-0d9c-4bb2-957f-4bd743a94370
Referer: https://claude.ai/chat/41a6ed6a-b6ae-428e-839e-9633b2c8d07f
accept-language: en-US, en;q=0.9
anthropic-client-version: 1.0.0
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
x-datadog-sampling-priority: 1
```

**Response Headers:**
```http
Transfer-Encoding: chunked
strict-transport-security: max-age=31536000; includeSubDomains; preload
X-Robots-Tag: none
Content-Encoding: br
cf-cache-status: DYNAMIC
Connection: keep-alive
request-id: req_011CfMyxmcNbej8DPkbF7vQr
CF-RAY: a40090431e66f838-SIN
server-timing: x-originResponse;dur=94
alt-svc: h3=":443"; ma=86400
Date: Thu, 24 Sep 2026 08:54:17 GMT
Content-Type: application/json
vary: Accept-Encoding
Server: cloudflare
```

**Request Body:**
*(No body)*

**Response Body:**
```json
{
  "eligible": false,
  "reason_code": "public_email_blocked",
  "parent_organization_name": null
}
```


---

### `GET` https://claude.ai/api/organizations/f173b116-171f-4e54-ae94-96abb14fd273/notification/preferences

| Status | Type |
|--------|------|
| 200 | fetch |

**Request Headers:**
```http
anthropic-anonymous-id: claudeai.v1.6e346c59-fb65-49a1-9be4-b80c8cf2b003
x-activity-session-id: f78aa7cc-c857-463e-a169-9e51e0fb7daf
x-datadog-parent-id: 8068122644898567721
sec-ch-ua-platform: "Linux"
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
anthropic-client-sha: deb3f0da2df1715abe98bd8c2f32f8eb6d85c27d
x-datadog-trace-id: 16663263604667994954
traceparent: 00-0000000000000000e73fcdf672ee534a-6ff7bacc7d76d629-01
anthropic-client-build: 1790200925
content-type: application/json
anthropic-client-capabilities: mfa_sms_v1
anthropic-client-platform: web_claude_ai
tracestate: dd=s:1;o:rum
x-datadog-origin: rum
anthropic-device-id: 6c9e5798-0d9c-4bb2-957f-4bd743a94370
Referer: https://claude.ai/chat/41a6ed6a-b6ae-428e-839e-9633b2c8d07f
accept-language: en-US, en;q=0.9
anthropic-client-version: 1.0.0
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
x-datadog-sampling-priority: 1
```

**Response Headers:**
```http
Transfer-Encoding: chunked
strict-transport-security: max-age=31536000; includeSubDomains; preload
X-Robots-Tag: none
Content-Encoding: br
cf-cache-status: DYNAMIC
Connection: keep-alive
request-id: req_011CfMyxezkhjsxyofA9X7tT
CF-RAY: a40090395cc0f838-SIN
server-timing: x-originResponse;dur=112
alt-svc: h3=":443"; ma=86400
Date: Thu, 24 Sep 2026 08:54:15 GMT
Content-Type: application/json
vary: Accept-Encoding
Server: cloudflare
```

**Request Body:**
*(No body)*

**Response Body:**
```json
{
  "account_id": 63494967,
  "organization_id": 63981736,
  "preferences": {
    "feature_preference": {
      "compass": {
        "enable_email": null,
        "enable_push": null
      },
      "bogosort": {
        "enable_email": null,
        "enable_push": null
      },
      "code_requires_action": {
        "enable_email": null,
        "enable_push": null
      },
      "code_security_scan": {
        "enable_email": null,
        "enable_push": null
      },
      "academy": {
        "enable_email": null,
        "enable_push": null
      },
      "completion": {
        "enable_email": null,
        "enable_push": null
      },
      "tool_notification": {
        "enable_email": null,
        "enable_push": null
      },
      "project_sharing": {
        "enable_email": null,
        "enable_push": null
      },
      "frame_access_request": {
        "enable_email": null,
        "enable_push": null
      },
      "frame_access_request_approved": {
        "enable_email": null,
        "enable_push": null
      },
      "frame_access_request_digest": {
        "enable_email": null,
        "enable_push": null
      },
      "frame_invite": {
        "enable_email": null,
        "enable_push": null
      },
      "frame_invite_owner_notice": {
        "enable_email": null,
        "enable_push": null
      },
      "frame_access_change_owner_notice": {
        "enable_email": null,
        "enable_push": null
      },
      "frame_shared": {
        "enable_email": null,
        "enable_push": null
      },
      "frame_comment_mention": {
        "enable_email": null,
        "enable_push": null
      },
      "frame_artifact_mention": {
        "enable_email": null,
        "enable_push": null
      },
      "frame_comment_reply": {
        "enable_email": null,
        "enable_push": null
      },
      "frame_artifact_notification": {
        "enable_email": null,
        "enable_push": null
      },
      "frame_storage_quota": {
        "enable_email": null,
        "enable_push": null
      },
      "chat_share_invite": {
        "enable_email": null,
        "enable_push": null
      },
      "artifact_shared": {
        "enable_email": null,
        "enable_push": null
      },
      "orbit_insight": {
        "enable_email": null,
        "enable_push": null
      },
      "orbit_widget_refresh": {
        "enable_email": null,
        "enable_push": null
      },
      "dispatch": {
        "enable_email": null,
        "enable_push": null
      },
      "assist": {
        "enable_email": null,
        "enable_push": null
      },
      "marketing": {
        "enable_email": null,
        "enable_push": null
      },
      "admin_spend_alerts": {
        "enable_email": null,
        "enable_push": null
      },
      "routines": {
        "enable_email": null,
        "enable_push": null
      },
      "sleepsort": {
        "enable_email": null,
        "enable_push": null
      },
      "slowsort": {
        "enable_email": null,
        "enable_push": null
      },
      "beadsort": {
        "enable_email": null,
        "enable_push": null
      },
      "hearth_session_mentioned": {
        "enable_email": null,
        "enable_push": null
      },
      "hearth_project": {
        "enable_email": null,
        "enable_push": null
      }
    }
  },
  "effective_preferences": {
    "compass": {
      "enable_push": false,
      "push_source": "unset",
      "enable_email": false,
      "email_source": "unset"
    },
    "bogosort": {
      "enable_push": false,
      "push_source": "unset",
      "enable_email": false,
      "email_source": "unset"
    },
    "code_requires_action": {
      "enable_push": false,
      "push_source": "unset",
      "enable_email": false,
      "email_source": "unset"
    },
    "code_security_scan": {
      "enable_push": false,
      "push_source": "unset",
      "enable_email": false,
      "email_source": "unset"
    },
    "academy": {
      "enable_push": true,
      "push_source": "always",
      "enable_email": true,
      "email_source": "always"
    },
    "completion": {
      "enable_push": false,
      "push_source": "unset",
      "enable_email": false,
      "email_source": "unset"
    },
    "tool_notification": {
      "enable_push": false,
      "push_source": "unset",
      "enable_email": false,
      "email_source": "unset"
    },
    "project_sharing": {
      "enable_push": true,
      "push_source": "always",
      "enable_email": true,
      "email_source": "always"
    },
    "frame_access_request": {
      "enable_push": true,
      "push_source": "always",
      "enable_email": true,
      "email_source": "always"
    },
    "frame_access_request_approved": {
      "enable_push": true,
      "push_source": "always",
      "enable_email": true,
      "email_source": "always"
    },
    "frame_access_request_digest": {
      "enable_push": true,
      "push_source": "always",
      "enable_email": true,
      "email_source": "always"
    },
    "frame_comment_mention": {
      "enable_push": true,
      "push_source": "always",
      "enable_email": true,
      "email_source": "always"
    },
    "frame_artifact_mention": {
      "enable_push": true,
      "push_source": "always",
      "enable_email": true,
      "email_source": "always"
    },
    "frame_comment_reply": {
      "enable_push": true,
      "push_source": "always",
      "enable_email": true,
      "email_source": "always"
    },
    "frame_artifact_notification": {
      "enable_push": true,
      "push_source": "always",
      "enable_email": true,
      "email_source": "always"
    },
    "chat_share_invite": {
      "enable_push": true,
      "push_source": "always",
      "enable_email": true,
      "email_source": "always"
    },
    "artifact_shared": {
      "enable_push": false,
      "push_source": "unset",
      "enable_email": false,
      "email_source": "unset"
    },
    "frame_invite": {
      "enable_push": true,
      "push_source": "always",
      "enable_email": true,
      "email_source": "always"
    },
    "frame_invite_owner_notice": {
      "enable_push": true,
      "push_source": "always",
      "enable_email": true,
      "email_source": "always"
    },
    "frame_access_change_owner_notice": {
      "enable_push": true,
      "push_source": "always",
      "enable_email": true,
      "email_source": "always"
    },
    "frame_shared": {
      "enable_push": true,
      "push_source": "always",
      "enable_email": true,
      "email_source": "always"
    },
    "frame_storage_quota": {
      "enable_push": true,
      "push_source": "always",
      "enable_email": true,
      "email_source": "always"
    },
    "orbit_insight": {
      "enable_push": false,
      "push_source": "unset",
      "enable_email": false,
      "email_source": "unset"
    },
    "orbit_widget_refresh": {
      "enable_push": false,
      "push_source": "unset",
      "enable_email": false,
      "email_source": "unset"
    },
    "dispatch": {
      "enable_push": false,
      "push_source": "unset",
      "enable_email": false,
      "email_source": "unset"
    },
    "assist": {
      "enable_push": false,
      "push_source": "unset",
      "enable_email": false,
      "email_source": "unset"
    },
    "marketing": {
      "enable_push": false,
      "push_source": "unset",
      "enable_email": false,
      "email_source": "unset"
    },
    "admin_spend_alerts": {
      "enable_push": false,
      "push_source": "unset",
      "enable_email": true,
      "email_source": "default"
    },
    "routines": {
      "enable_push": true,
      "push_source": "default",
      "enable_email": false,
      "email_source": "unset"
    },
    "sleepsort": {
      "enable_push": true,
      "push_source": "default",
      "enable_email": false,
      "email_source": "unset"
    },
    "slowsort": {
      "enable_push": false,
      "push_source": "unset",
      "enable_email": true,
      "email_source": "default"
    },
    "beadsort": {
      "enable_push": false,
      "push_source": "unset",
      "enable_email": true,
      "email_source": "default"
    },
    "hearth_session_mentioned": {
      "enable_push": false,
      "push_source": "unset",
      "enable_email": false,
      "email_source": "unset"
    },
    "hearth_project": {
      "enable_push": false,
      "push_source": "unset",
      "enable_email": false,
      "email_source": "unset"
    }
  },
  "push_reachability": {
    "has_active_channel": false,
    "platforms": [],
    "most_recent_token_refresh": null
  }
}
```


---

### `POST` https://claude.ai/api/v2/rum?ddsource=browser&dd-api-key=pub71869dceb5b70dba6123af9ca357d1f9&dd-evp-origin-version=7.6.0&dd-evp-origin=browser&dd-request-id=52c3ba07-2323-4b73-8c88-45e9d09afd7b&dd-evp-encoding=deflate&batch_time=1790240052313&_dd.api=fetch&build_ts=1790200925

| Status | Type |
|--------|------|
| 202 | fetch |

**Request Headers:**
```http
sec-ch-ua-platform: "Linux"
Referer: https://claude.ai/chat/41a6ed6a-b6ae-428e-839e-9633b2c8d07f
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
Content-Type: text/plain
sec-ch-ua-mobile: ?0
```

**Response Headers:**
```http
X-Robots-Tag: none
Content-Encoding: br
cf-cache-status: DYNAMIC
x-content-type-options: nosniff
request-id: req_011CfMyxTHYx7pKjoKz46Q7w
server-timing: x-originResponse;dur=104
alt-svc: h3=":443"; ma=86400
accept-encoding: identity,gzip,x-gzip,deflate,x-deflate,zstd
Date: Thu, 24 Sep 2026 08:54:12 GMT
Content-Type: application/json
vary: Accept-Encoding
dd-request-id: 52c3ba07-2323-4b73-8c88-45e9d09afd7b
Transfer-Encoding: chunked
strict-transport-security: max-age=31536000; includeSubDomains; preload
Connection: keep-alive
cross-origin-resource-policy: cross-origin
CF-RAY: a4009027faa4fe03-SIN
access-control-allow-origin: *
Server: cloudflare
```

**Request Body:**
*(No body)*

**Response Body:**
```json
{
  "request_id": "52c3ba07-2323-4b73-8c88-45e9d09afd7b"
}
```


---

### `POST` https://claude.ai/api/organizations/f173b116-171f-4e54-ae94-96abb14fd273/chat_conversations/41a6ed6a-b6ae-428e-839e-9633b2c8d07f/title

| Status | Type |
|--------|------|
| 200 | fetch |

**Request Headers:**
```http
anthropic-anonymous-id: claudeai.v1.6e346c59-fb65-49a1-9be4-b80c8cf2b003
x-activity-session-id: f78aa7cc-c857-463e-a169-9e51e0fb7daf
x-datadog-parent-id: 8336409566698792048
sec-ch-ua-platform: "Linux"
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
anthropic-client-sha: deb3f0da2df1715abe98bd8c2f32f8eb6d85c27d
x-datadog-trace-id: 12955305494949348054
traceparent: 00-0000000000000000b3ca7db51f1f42d6-73b0e0552d3fe470-01
anthropic-client-build: 1790200925
content-type: application/json
anthropic-client-capabilities: mfa_sms_v1
anthropic-client-platform: web_claude_ai
tracestate: dd=s:1;o:rum
x-datadog-origin: rum
anthropic-device-id: 6c9e5798-0d9c-4bb2-957f-4bd743a94370
Referer: https://claude.ai/chat/41a6ed6a-b6ae-428e-839e-9633b2c8d07f
accept-language: en-US, en;q=0.9
anthropic-client-version: 1.0.0
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
x-datadog-sampling-priority: 1
```

**Response Headers:**
```http
X-Robots-Tag: none
Content-Encoding: br
cf-cache-status: DYNAMIC
request-id: req_011CfMyxSYttZYenxJEdKNeY
server-timing: x-originResponse;dur=739
alt-svc: h3=":443"; ma=86400
Date: Thu, 24 Sep 2026 08:54:13 GMT
Content-Type: application/json
vary: Origin, Accept-Encoding
Transfer-Encoding: chunked
strict-transport-security: max-age=31536000; includeSubDomains; preload
Connection: keep-alive
access-control-allow-credentials: true
CF-RAY: a40090271d91f838-SIN
access-control-allow-origin: https://claude.ai
Server: cloudflare
```

**Request Body:**
```json
{
  "message_content": "tạo 1 file test.js với nội dung là hàm công  2 số nguyên. có dòng chạy hàm với 2 prop là 2 với 3. sau đó chạy file lấy result",
  "recent_titles": []
}
```

**Response Body:**
```json
{
  "title": "Tạo file JavaScript cộng hai số"
}
```


---

### `GET` https://claude.ai/api/organizations/f173b116-171f-4e54-ae94-96abb14fd273/artifacts/41a6ed6a-b6ae-428e-839e-9633b2c8d07f/versions?source=w

| Status | Type |
|--------|------|
| 200 | fetch |

**Request Headers:**
```http
anthropic-anonymous-id: claudeai.v1.6e346c59-fb65-49a1-9be4-b80c8cf2b003
x-activity-session-id: f78aa7cc-c857-463e-a169-9e51e0fb7daf
x-datadog-parent-id: 6285408279148561063
sec-ch-ua-platform: "Linux"
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
anthropic-client-sha: deb3f0da2df1715abe98bd8c2f32f8eb6d85c27d
x-datadog-trace-id: 16069481649803937234
traceparent: 00-0000000000000000df02446bb538c5d2-573a418742f302a7-01
anthropic-client-build: 1790200925
content-type: application/json
anthropic-client-capabilities: mfa_sms_v1
anthropic-client-platform: web_claude_ai
tracestate: dd=s:1;o:rum
x-datadog-origin: rum
anthropic-device-id: 6c9e5798-0d9c-4bb2-957f-4bd743a94370
Referer: https://claude.ai/chat/41a6ed6a-b6ae-428e-839e-9633b2c8d07f
accept-language: en-US, en;q=0.9
anthropic-client-version: 1.0.0
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
x-datadog-sampling-priority: 1
```

**Response Headers:**
```http
strict-transport-security: max-age=31536000; includeSubDomains; preload
X-Robots-Tag: none
cf-cache-status: DYNAMIC
Connection: keep-alive
request-id: req_011CfMyxSSCZxMTpwxFZME81
CF-RAY: a4009026ecedcdf2-SIN
server-timing: x-originResponse;dur=174
alt-svc: h3=":443"; ma=86400
Content-Length: 24
Date: Thu, 24 Sep 2026 08:54:12 GMT
Content-Type: application/json
Server: cloudflare
```

**Request Body:**
*(No body)*

**Response Body:**
```json
{
  "artifact_versions": []
}
```


---

### `GET` https://claude.ai/api/organizations/f173b116-171f-4e54-ae94-96abb14fd273/chat_conversations/41a6ed6a-b6ae-428e-839e-9633b2c8d07f/composer_notices

| Status | Type |
|--------|------|
| 200 | fetch |

**Request Headers:**
```http
anthropic-anonymous-id: claudeai.v1.6e346c59-fb65-49a1-9be4-b80c8cf2b003
x-activity-session-id: f78aa7cc-c857-463e-a169-9e51e0fb7daf
x-datadog-parent-id: 2454962876316566006
sec-ch-ua-platform: "Linux"
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
anthropic-client-sha: deb3f0da2df1715abe98bd8c2f32f8eb6d85c27d
x-datadog-trace-id: 12174758613899796419
traceparent: 00-0000000000000000a8f56e74679fdfc3-2211c7baa39ec1f6-01
anthropic-client-build: 1790200925
content-type: application/json
anthropic-client-capabilities: mfa_sms_v1
anthropic-client-platform: web_claude_ai
tracestate: dd=s:1;o:rum
x-datadog-origin: rum
anthropic-device-id: 6c9e5798-0d9c-4bb2-957f-4bd743a94370
Referer: https://claude.ai/chat/41a6ed6a-b6ae-428e-839e-9633b2c8d07f
accept-language: en-US, en;q=0.9
anthropic-client-version: 1.0.0
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
x-datadog-sampling-priority: 1
```

**Response Headers:**
```http
strict-transport-security: max-age=31536000; includeSubDomains; preload
X-Robots-Tag: none
cf-cache-status: DYNAMIC
Connection: keep-alive
request-id: req_011CfMyxLuZwMFbVagpijcs8
CF-RAY: a400901ecebdf838-SIN
server-timing: x-originResponse;dur=64
alt-svc: h3=":443"; ma=86400
Content-Length: 15
Date: Thu, 24 Sep 2026 08:54:11 GMT
Content-Type: application/json
Server: cloudflare
```

**Request Body:**
*(No body)*

**Response Body:**
```json
{
  "notices": []
}
```


---

### `GET` https://claude.ai/api/organizations/f173b116-171f-4e54-ae94-96abb14fd273

| Status | Type |
|--------|------|
| 200 | fetch |

**Request Headers:**
```http
anthropic-anonymous-id: claudeai.v1.6e346c59-fb65-49a1-9be4-b80c8cf2b003
x-activity-session-id: f78aa7cc-c857-463e-a169-9e51e0fb7daf
x-datadog-parent-id: 8464104417971597602
sec-ch-ua-platform: "Linux"
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
anthropic-client-sha: deb3f0da2df1715abe98bd8c2f32f8eb6d85c27d
x-datadog-trace-id: 1461400510825758845
traceparent: 00-00000000000000001447f0059258007d-75768a1f9702f122-01
anthropic-client-build: 1790200925
content-type: application/json
anthropic-client-capabilities: mfa_sms_v1
anthropic-client-platform: web_claude_ai
tracestate: dd=s:1;o:rum
x-datadog-origin: rum
anthropic-device-id: 6c9e5798-0d9c-4bb2-957f-4bd743a94370
Referer: https://claude.ai/chat/41a6ed6a-b6ae-428e-839e-9633b2c8d07f
accept-language: en-US, en;q=0.9
anthropic-client-version: 1.0.0
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
x-datadog-sampling-priority: 1
```

**Response Headers:**
```http
Transfer-Encoding: chunked
strict-transport-security: max-age=31536000; includeSubDomains; preload
X-Robots-Tag: none
Content-Encoding: br
cf-cache-status: DYNAMIC
Connection: keep-alive
request-id: req_011CfMyxLhvFJu5yNnUCJYmM
CF-RAY: a400901e9a34cdf2-SIN
server-timing: x-originResponse;dur=141
alt-svc: h3=":443"; ma=86400
Date: Thu, 24 Sep 2026 08:54:11 GMT
Content-Type: application/json
vary: Accept-Encoding
Server: cloudflare
```

**Request Body:**
*(No body)*

**Response Body:**
```json
{
  "id": 63981736,
  "uuid": "f173b116-171f-4e54-ae94-96abb14fd273",
  "name": "lechivn13579@gmail.com's Organization",
  "settings": {
    "claude_console_privacy": "default_private",
    "allowed_invite_domains": null,
    "workbench_completion_feedback_enabled": null,
    "claude_ai_completion_feedback_enabled": true,
    "claude_code_metrics_logging_enabled": true,
    "claude_code_github_analytics_enabled": null,
    "claude_code_remote_control_enabled": null,
    "claude_code_remote_control_default_enabled": null,
    "claude_code_routines_enabled": null,
    "claude_code_workflows_enabled": null,
    "claude_code_trusted_devices_required": null,
    "claude_code_penguin_mode_enabled": false,
    "claude_code_quick_web_setup_enabled": null,
    "claude_code_hide_managed_environments": null,
    "claude_code_disable_anthropic_compute": null,
    "claude_code_allow_session_pool_moves": null,
    "claude_code_default_worker_environment_id": null,
    "claude_code_default_worker_pool_id": null,
    "managed_agents_enabled": true,
    "files_api_enabled": true,
    "skills_api_enabled": true,
    "oc_overage_credit_claimed": null,
    "inline_visualizations_enabled": null,
    "claude_ai_omelette_enabled": null,
    "claude_academy_inference_enabled": null,
    "claude_academy_personalization_enabled": null,
    "claude_ai_skill_plugins_scanning_enabled": null,
    "claude_ai_operon_enabled": null,
    "frontier_services_data_use_enabled": null,
    "lti_course_projects_enabled": null,
    "claude_ai_integration_sharing_enabled": true,
    "claude_ai_chat_sharing_enabled": true,
    "claude_ai_chat_external_sharing_enabled": false,
    "claude_ai_ccr_sharing_enabled": true,
    "claude_ai_skill_sharing_enabled": null,
    "claude_ai_skill_sharing_org_enabled": null,
    "claude_ai_skill_sharing_group_enabled": null,
    "claude_ai_skill_creation_enabled": null,
    "claude_ai_skill_publish_policy": null,
    "claude_ai_skill_publish_policy_effective": "off",
    "claude_ai_skill_publish_open_available": true,
    "connector_social_proof": null,
    "batches_download_ui_visibility": "all",
    "batches_download_ui_enabled_workspace_ids": [],
    "default_workspace_settings": {
      "enable_api_keys": true
    },
    "api_key_creation_enabled": null,
    "sampling_restriction": null,
    "work_across_apps_enabled": null,
    "dramatic_shrimp_enabled": null,
    "cobalt_plinth_enabled": null,
    "pewter_finch_enabled": null,
    "is_desktop_extension_allowlist_enabled": false,
    "account_session_duration_seconds": null,
    "vcs_connections": null,
    "disabled_admin_request_types": null,
    "member_usage_dashboard_visible": null,
    "system_preferences_prompt": null
  },
  "capabilities": [
    "chat"
  ],
  "parent_organization_uuid": null,
  "rate_limit_tier": "default_claude_ai",
  "billing_type": null,
  "free_credits_status": null,
  "data_retention": "default",
  "api_disabled_reason": null,
  "api_disabled_until": null,
  "created_at": "2025-08-17T23:26:20.240684Z",
  "billable_usage_paused_until": null,
  "raven_type": null,
  "rate_limit_upsell": null,
  "merchant_of_record": "anthropic",
  "claude_ai_bootstrap_models_config": null,
  "has_icon": false,
  "monitoring_notice": null,
  "is_workbench_cmek_blocked": false,
  "external_mapping": null,
  "visibility_status": null,
  "is_internal_org": false,
  "home_stripe_account_region": null,
  "subscription_pause": null,
  "billing_issue": null,
  "analytics_subscription_plan": "claude_free",
  "access_block": null,
  "subscription_management": null,
  "updated_at": "2025-08-17T23:26:20.240684Z",
  "active_flags": [],
  "data_retention_periods": null,
  "member_file_deletion_blocked_by_retention": false,
  "data_retention_min_duration_days": null
}
```


---

### `POST` https://claude.ai/api/organizations/f173b116-171f-4e54-ae94-96abb14fd273/chat_conversations/41a6ed6a-b6ae-428e-839e-9633b2c8d07f/completion

| Status | Type |
|--------|------|
| 0 | fetch |

**Request Headers:**
```http
x-datadog-parent-id: 2377781112674449423
sec-ch-ua-platform: "Linux"
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
x-datadog-trace-id: 13882611186599338534
traceparent: 00-0000000000000000c0a8f1522c1e2226-20ff9352ee97f80f-01
accept: text/event-stream
Content-Type: application/json
anthropic-client-platform: web_claude_ai
tracestate: dd=s:1;o:rum
x-datadog-origin: rum
anthropic-device-id: 6c9e5798-0d9c-4bb2-957f-4bd743a94370
Referer: https://claude.ai/new
Accept-Language: en-US, en;q=0.9
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
x-datadog-sampling-priority: 1
```

**Response Headers:**
```http
X-Request-Status: Failed
X-Error: net::ERR_ABORTED
```

**Request Body:**
```json
{
  "prompt": "tạo 1 file test.js với nội dung là hàm công  2 số nguyên. có dòng chạy hàm với 2 prop là 2 với 3. sau đó chạy file lấy result",
  "timezone": "Asia/Saigon",
  "locale": "en-US",
  "model": "claude-sonnet-5",
  "effort": "low",
  "thinking_mode": "auto",
  "tools": [
    {
      "name": "read_me",
      "description": "Returns required context for show_widget (CSS variables, colors, typography, layout rules, examples). Call before your first show_widget call. Call again later if you need a different module. Do NOT mention or narrate this call to the user — it is an internal setup step. Call it silently and proceed directly to the visualization in your response.",
      "input_schema": {
        "type": "object",
        "properties": {
          "modules": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "diagram",
                "mockup",
                "interactive",
                "data_viz",
                "art",
                "chart",
                "elicitation"
              ]
            },
            "description": "Which module(s) to load. Pick all that fit."
          },
          "platform": {
            "type": "string",
            "enum": [
              "mobile",
              "desktop",
              "unknown"
            ],
            "description": "The client platform the widget will render on. Pass 'mobile' when your system prompt indicates a mobile client (narrow ~380px viewport) so SVG viewBox and layout guidance are sized accordingly; otherwise pass 'desktop'. Defaults to 'unknown' (desktop sizing)."
          }
        }
      },
      "integration_name": "visualize",
      "mcp_server_uuid": "6f616b42-0ed8-571e-823f-ee4aca6b7ce9",
      "mcp_server_url": "https://sandbox.claudemcpcontent.com/imagine_mcp",
      "needs_approval": false,
      "backend_execution": true,
      "read_only_hint": true,
      "is_mcp_app": false
    },
    {
      "name": "show_widget",
      "description": "Show visual content — SVG graphics, diagrams, charts, or interactive HTML widgets — that renders inline alongside your text response. Use for flowcharts, architecture diagrams, dashboards, forms, calculators, data tables, games, illustrations, or any visual content. The code is auto-detected: starts with <svg = SVG mode, otherwise HTML mode. A global sendPrompt(text) function is available — it sends a message to chat as if the user typed it. IMPORTANT: Call read_me before your first show_widget call. Do NOT narrate or mention the read_me call to the user — call it silently, then respond as if you went straight to building the visualization.",
      "input_schema": {
        "type": "object",
        "properties": {
          "loading_messages": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "minItems": 1,
            "maxItems": 4,
            "description": "1–4 loading messages shown to the user while the visual renders, each roughly 5 words long. Write them in the same language the user is using. Use 1 for simple visuals, more for complex ones. If the topic is serious — illness, disease, pandemics, death, grief, war, conflict, poverty, disaster, trauma, abuse, addiction, medical decisions, politically charged subjects, or anything where the reader might be personally affected — keep these BORING: describe what the code is doing in the dullest generic way, no jargon-as-drama, no evocative terms. Pandemic growth model — NOT ['Simulating patient zero', 'Modeling the curve'] (documentary-narrator voice), YES ['Setting up the model', 'Running the calculation']. Cancer timeline — NOT ['Charting the battle ahead'], YES ['Laying out the stages']. If you have to ask whether it's serious, it is. Otherwise, have fun — reach for alliteration, puns, personification, wordplay, whatever lands in that language. Playful examples — revenue chart: ['Bribing bars to stand taller', 'Asking Q4 where it went']; kanban: ['Herding cards into columns', 'Dragging, dropping, not stopping']."
          },
          "title": {
            "type": "string",
            "description": "Short snake_case identifier for this visual. Must be specific and disambiguating — if the conversation has multiple visuals, this title alone should tell you which one is being referenced (e.g. 'q4_revenue_by_product_line' not 'chart', 'oauth_login_flow' not 'diagram'). Also used as the download filename, so no spaces or special characters."
          },
          "widget_code": {
            "type": "string",
            "description": "SVG or HTML code to render. For SVG: raw SVG code starting with <svg> tag, must use CSS variables for colors. Example: <svg viewBox=\"0 0 700 400\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>. For HTML: raw HTML content to render, do NOT include DOCTYPE, <html>, <head>, or <body> tags. Use CSS variables for theming. Keep background transparent and avoid top-level padding. Scripts are supported but execute after streaming completes."
          }
        },
        "required": [
          "loading_messages",
          "title",
          "widget_code"
        ]
      },
      "integration_name": "visualize",
      "mcp_server_uuid": "6f616b42-0ed8-571e-823f-ee4aca6b7ce9",
      "mcp_server_url": "https://sandbox.claudemcpcontent.com/imagine_mcp",
      "needs_approval": false,
      "backend_execution": true,
      "read_only_hint": true,
      "is_mcp_app": true
    },
    {
      "type": "web_search_v0",
      "name": "web_search"
    },
    {
      "type": "artifacts_v0",
      "name": "artifacts"
    },
    {
      "type": "repl_v0",
      "name": "repl"
    },
    {
      "type": "widget",
      "name": "weather_fetch"
    },
    {
      "type": "widget",
      "name": "recipe_display_v0"
    },
    {
      "type": "widget",
      "name": "places_map_display_v0"
    },
    {
      "type": "widget",
      "name": "message_compose_v1"
    },
    {
      "type": "widget",
      "name": "ask_user_input_v0"
    },
    {
      "type": "widget",
      "name": "recommend_claude_apps"
    },
    {
      "type": "widget",
      "name": "show_recommendation_cards"
    },
    {
      "type": "widget",
      "name": "chart_display_v0"
    },
    {
      "type": "widget",
      "name": "places_search"
    },
    {
      "type": "widget",
      "name": "fetch_sports_data"
    },
    {
      "type": "widget",
      "name": "options_card_display_v0"
    },
    {
      "type": "widget",
      "name": "step_card_display_v0"
    },
    {
      "type": "widget",
      "name": "itinerary_display_v0"
    },
    {
      "type": "widget",
      "name": "translation_display_v0"
    },
    {
      "type": "widget",
      "name": "comparison_card_display_v0"
    },
    {
      "type": "widget",
      "name": "featured_card_display_v0"
    },
    {
      "type": "widget",
      "name": "product_carousel_display_v0"
    },
    {
      "type": "widget",
      "name": "link_preview_display_v0"
    },
    {
      "type": "widget",
      "name": "places_list_display_v0"
    },
    {
      "type": "widget",
      "name": "quiz_display_v0"
    }
  ],
  "turn_message_uuids": {
    "human_message_uuid": "01a0d29f-4d78-79e1-8c3f-8d15218afc3b",
    "assistant_message_uuid": "01a0d29f-4d78-7128-a9b6-8bfd0e0ba79a"
  },
  "attachments": [],
  "files": [],
  "sync_sources": [],
  "completion_request_id": "5c932d38-1a3c-4c5a-acb7-681db92355f4",
  "rendering_mode": "messages",
  "create_conversation_params": {
    "name": "",
    "model": "claude-sonnet-5",
    "include_conversation_preferences": true,
    "paprika_mode": null,
    "compass_mode": null,
    "tool_search_mode": "auto",
    "is_temporary": false,
    "chat_memory_mode": "enabled",
    "enabled_imagine": true
  }
}
```

**Response Body:**
*(No body)*

