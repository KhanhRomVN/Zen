/**
 * ------------------------------------------------------------------
 * useChatProfile
 * ------------------------------------------------------------------
 * Hook đọc/ghi profile chatroom (userId, name, country, avatar) vào storage
 * của extension (globalStorage, key PROFILE_STORAGE_KEY).
 *
 * Main features:
 * - Load profile khi mở chatroom
 * - saveProfile() tạo userId mới nếu chưa có và lưu lại
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { extensionService } from "../../../services/ExtensionService";
import { PRESENCE_ID_KEY, PROFILE_STORAGE_KEY } from "../constants/config";
import type { ChatProfile } from "../types";

// ─── Types ──────────────────────────────────────────────────────────────
export interface ChatProfileInput {
  name: string;
  country: string;
  avatar?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────
const parseProfile = (raw: string): ChatProfile | null => {
  try {
    const p = JSON.parse(raw);
    if (p?.userId && p?.name && p?.country) return p as ChatProfile;
  } catch {}
  return null;
};

// ─── Hook ───────────────────────────────────────────────────────────────
export const useChatProfile = () => {
  // ── State ──
  const [profile, setProfile] = useState<ChatProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Effects ──
  useEffect(() => {
    let disposed = false;
    extensionService
      .getStorage()
      .get(PROFILE_STORAGE_KEY)
      .then((res: { value: string } | null) =>
        res ? parseProfile(res.value) : null,
      )
      .catch(() => null)
      .then((p: ChatProfile | null) => {
        if (disposed) return;
        setProfile(p);
        setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, []);

  // ── Callbacks ──
  const saveProfile = useCallback(
    async (input: ChatProfileInput) => {
      const presenceId = (
        await extensionService
          .getStorage()
          .get(PRESENCE_ID_KEY)
          .catch(() => null)
      )?.value;
      const next: ChatProfile = {
        userId: profile?.userId ?? presenceId ?? `zen-${uuidv4()}`,
        name: input.name,
        country: input.country,
        avatar: input.avatar,
      };
      await extensionService
        .getStorage()
        .set(PROFILE_STORAGE_KEY, JSON.stringify(next));
      setProfile(next);
    },
    [profile],
  );

  return { profile, loading, saveProfile };
};