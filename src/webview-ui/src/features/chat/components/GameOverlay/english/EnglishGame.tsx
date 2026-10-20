import React, { useEffect, useState } from "react";
import HomeScreen from "./HomeScreen";
import PlayScreen from "./PlayScreen";
import ResultScreen from "./ResultScreen";
import { buildSession, mergeStats, summarizeSession } from "./engine";
import { loadEnglishState, saveEnglishState } from "./storage";
import { ActiveSession, EnglishPersist, GameConfig } from "./types";

const restore = (): EnglishPersist => {
  const s = loadEnglishState();
  const timed = s.session !== null && s.session.deadline !== null;
  if (s.screen === "playing" && (!s.session || timed)) {
    return { ...s, screen: "home", session: null };
  }
  if (s.screen === "result" && !s.summary) {
    return { ...s, screen: "home" };
  }
  return s;
};

const EnglishGame: React.FC = () => {
  const [state, setState] = useState<EnglishPersist>(restore);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    saveEnglishState(state);
  }, [state]);

  const setConfig = (config: GameConfig) => setState((s) => ({ ...s, config }));

  const start = () => {
    const session = buildSession(state.config, state.stats);
    if (!session) {
      setNotice("No questions match the selected settings.");
      return;
    }
    setNotice(null);
    setState((s) => ({ ...s, screen: "playing", session, summary: null }));
  };

  const progress = (session: ActiveSession) =>
    setState((s) => ({ ...s, session }));

  const finish = (session: ActiveSession) =>
    setState((s) => {
      const summary = summarizeSession(session);
      return {
        ...s,
        screen: "result",
        session: null,
        summary,
        stats: mergeStats(s.stats, session, summary),
      };
    });

  const goHome = () =>
    setState((s) => ({ ...s, screen: "home", session: null }));

  if (state.screen === "playing" && state.session) {
    return (
      <PlayScreen
        session={state.session}
        config={state.config}
        onProgress={progress}
        onFinish={finish}
        onQuit={goHome}
      />
    );
  }

  if (state.screen === "result" && state.summary) {
    return <ResultScreen summary={state.summary} onReplay={start} onHome={goHome} />;
  }

  return (
    <HomeScreen
      stats={state.stats}
      config={state.config}
      notice={notice}
      onConfigChange={setConfig}
      onStart={start}
    />
  );
};

export default EnglishGame;