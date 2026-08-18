import { prisma } from "../lib/prisma";
import { ProcessingStatus } from "@adaptive-streaming/shared";

export async function updateVideoStatus(
  videoId: string,
  status: ProcessingStatus,
) {
  await prisma.video.update({
    where: { videoId },
    data: { status },
  });
}
