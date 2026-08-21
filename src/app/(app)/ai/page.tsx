import { MovieAssistantScreen } from "@/features/chat/movie-assistant-screen";
import { CHAT_RECOMMENDATIONS_FIXTURE } from "@/fixtures/chat";

export default function MovieAssistantPage() {
  return (
    <MovieAssistantScreen
      recommendations={CHAT_RECOMMENDATIONS_FIXTURE.movies}
    />
  );
}
