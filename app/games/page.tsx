import type { Metadata } from "next";
import GameLab from "./game-lab";

export const metadata: Metadata = { title: "게임으로 배우기 | 해보기" };

export default function GamesPage() {
  return <GameLab />;
}
