import { DiscoverResponseSchema } from "@/contracts/discover";
import { apiRequest } from "@/lib/api/client";

export async function fetchDiscoverBatch() {
  const { data } = await apiRequest("/api/discover", DiscoverResponseSchema);

  return data;
}
