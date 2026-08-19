import { prisma } from "../lib/prisma";
import { ProcessingStatus } from "@adaptive-streaming/shared";

export function createVideoRecord(videoId: string, originalFileName?: string) {
  return prisma.video.create({
    data: {
      videoId,
      originalFileName,
      processingStatus: "PENDING",
    },
  });
}

export async function updateVideoStatus(
  videoId: string,
  processingStatus: ProcessingStatus,
) {
  return prisma.video.update({
    where: { videoId },
    data: { processingStatus },
  });
}

export async function listVideos() {
  return prisma.video.findMany({
    orderBy: {
      createAt: "desc",
    },
  });
}

export async function getVideoById(videoId: string) {
  return prisma.video.findUnique({
    where: { videoId },
  });
}
