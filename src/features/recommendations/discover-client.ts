import { DiscoverResponseSchema } from "@/contracts/discover";
import { apiRequest } from "@/lib/api/client";

export async function fetchDiscoverBatch(excludeMovieIds: number[] = []) {
  const { data } = await apiRequest("/api/discover", DiscoverResponseSchema, {
    method: "POST",
    body: JSON.stringify({ excludeMovieIds }),
  });

  return data;
}
