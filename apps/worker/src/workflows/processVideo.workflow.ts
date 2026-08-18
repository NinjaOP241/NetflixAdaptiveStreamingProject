import { proxyActivities } from "@temporalio/workflow";
import { config } from "../config";
import type * as activities from "../activities";
import { ProcessVideoInput, RESOLUTIONS } from "@adaptive-streaming/shared";

const {
  transcodeResolution,
  writeMasterPlaylist,
  deleteSourceFile,
  updateVideoStatus,
  ensureOutputDirectoryExists,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: config.videoProcessingWorkflowTimeout,
  retry: {
    maximumAttempts: 3,
  },
});

export async function processVideoWorkflow(input: ProcessVideoInput) {
  const { videoId, inputRelativePath, outputRelativePath } = input;
  try {
    // Update video status to PROCESSING in the database
    await updateVideoStatus(input.videoId, "PROCESSING");

    // Ensure the output directory exists before starting the transcoding process
    await ensureOutputDirectoryExists(outputRelativePath);

    /**
     * Parallely trigger all the transcoding activities for different resolutions
     *
     * As of now, the transcoding is done in one single worker pod
     */
    const resolutionEntries = await Promise.all(
      RESOLUTIONS.map((resolution) =>
        transcodeResolution(inputRelativePath, outputRelativePath, resolution),
      ),
    );

    // Create the master playlist that references all the resolution-specific playlists
    const masterPlaylistRelativePath = await writeMasterPlaylist(
      outputRelativePath,
      resolutionEntries,
    );

    // Delete the source media file after transcoding is complete
    await deleteSourceFile(inputRelativePath);

    // Update video status to COMPLETED in the database
    await updateVideoStatus(input.videoId, "COMPLETED");

    return {
      videoId,
      masterPlaylistRelativePath,
      status: "COMPLETED",
    };
  } catch (error) {
    // Update video status to FAILED in the database
    await updateVideoStatus(input.videoId, "FAILED");
    throw error;
  }
}
