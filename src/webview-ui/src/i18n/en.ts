export const en: {
  settings: {
    title: string;
    backendApiUrl: string;
    backendApiUrlHelp: string;
    language: string;
    languageHelp: string;
    permissionMode: string;
    permissionModeHelp: string;
    bypassPermissionsLabel: string;
    bypassPermissionsDesc: string;
    acceptEditsLabel: string;
    acceptEditsDesc: string;
    autoLabel: string;
    autoDesc: string;
    defaultLabel: string;
    defaultDesc: string;
    dontAskLabel: string;
    dontAskDesc: string;
    planLabel: string;
    planDesc: string;
  };
  chat: {
    connectionErrorPlaceholder: string;
  };
} = {
  settings: {
    title: "Settings",
    backendApiUrl: "Backend API URL",
    backendApiUrlHelp: "API address to fetch models and accounts.",
    language: "Language",
    languageHelp: "Interface and AI response language.",
    permissionMode: "Permission Mode",
    permissionModeHelp: "Determines how the agent executes tools.",
    bypassPermissionsLabel: "Full Access (Bypass)",
    bypassPermissionsDesc: "All tools execute automatically without prompting.",
    acceptEditsLabel: "Auto File Edits",
    acceptEditsDesc: "Reads and file writes execute automatically; commands/sub-agents require approval.",
    autoLabel: "Auto Reads",
    autoDesc: "Safe read-only tools execute automatically; file writes and commands require approval.",
    defaultLabel: "Ask Every Time",
    defaultDesc: "All tools require manual confirmation before running.",
    dontAskLabel: "Deny All (Silent)",
    dontAskDesc: "All tools are automatically blocked without prompting.",
    planLabel: "Read Only (Plan)",
    planDesc: "Safe reads execute automatically; file writes and commands are automatically blocked.",
  },
  chat: {
    connectionErrorPlaceholder: "Backend connection error...",
  },
};
