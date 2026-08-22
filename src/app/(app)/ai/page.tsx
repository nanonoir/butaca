import { MovieAssistantScreen } from "@/features/chat/movie-assistant-screen";

/** No server data to seed: the assistant reaches movies through its tool, so
 * the conversation starts empty and fills from the recommender. */
export default function MovieAssistantPage() {
  return <MovieAssistantScreen />;
}
