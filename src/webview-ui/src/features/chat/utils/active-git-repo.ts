export interface ActiveGitRepo {
  path: string;
  branch: string;
}

const STORAGE_KEY = "zen_active_git_repo";

let activeGitRepo: ActiveGitRepo | null = null;

export const setActiveGitRepo = (repo: ActiveGitRepo | null) => {
  activeGitRepo = repo;
  try {
    if (repo) localStorage.setItem(STORAGE_KEY, JSON.stringify(repo));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
};

export const getActiveGitRepo = (): ActiveGitRepo | null => {
  if (activeGitRepo) return activeGitRepo;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) activeGitRepo = JSON.parse(raw) as ActiveGitRepo;
  } catch {}
  return activeGitRepo;
};