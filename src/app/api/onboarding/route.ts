import { CompleteOnboardingRequestSchema } from "@/contracts";
import { getOnboardingService } from "@/features/onboarding/onboarding-factory";
import {
  apiData,
  readJsonBody,
  requireViewer,
  runApiRoute,
} from "@/lib/api/route";

export async function POST(request: Request): Promise<Response> {
  return runApiRoute(async () => {
    const input = await readJsonBody(request, CompleteOnboardingRequestSchema);
    const viewer = await requireViewer();

    return apiData(await getOnboardingService().complete(viewer, input));
  });
}
