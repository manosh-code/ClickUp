import { useEffect, useState } from "react";
import { BoardView } from "./board/BoardView";
import { Home } from "./pages/Home";

function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    function onPop() {
      setPath(window.location.pathname);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function navigate(next: string) {
    window.history.pushState({}, "", next);
    setPath(next);
  }

  return { path, navigate };
}

export function App() {
  const { path, navigate } = useRoute();
  const boardId = /^\/b\/([^/]+)$/.exec(path)?.[1];

  if (boardId) {
    return <BoardView boardId={boardId} onHome={() => navigate("/")} />;
  }

  return <Home onOpen={(id) => navigate(`/b/${id}`)} />;
}
