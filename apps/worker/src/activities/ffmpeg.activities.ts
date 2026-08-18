import path from "path";
import fs from "fs/promises";
import ffmpeg from "fluent-ffmpeg";
import { config } from "../config";
import { Resolution } from "@adaptive-streaming/shared";

/**
 * Set the exact folder paths so fluent-ffmpeg knows where the actual software
 * is installed on the server. fluent-ffmpeg needs these paths to run the
 * programs in the background as Node.js child processes.
 *
 * ffmpeg  = The tool that edits, resizes, and chops the video into HLS segments.
 * ffprobe = The companion program automatically installed alongside FFmpeg. It
 *           does not modify or convert videos; it simply scans the file to
 *           read its hidden metadata (like duration, width, height, and bitrates).
 */
ffmpeg.setFfmpegPath(config.ffmpegPath);
ffmpeg.setFfprobePath(config.ffprobePath);

/**
 * Converts a relative media path to an absolute path on the server.
 * This is necessary because fluent-ffmpeg requires absolute paths to
 * the media files in order to process them correctly.
 *
 * @param relativePath - The relative path to the media file.
 * @returns The absolute path to the media file.
 */
function resolveMediaPath(relativePath: string): string {
  /**
   * Normalize the relative path ensuring it does not escapes out of the media root directory
   *
   * For example:
   * If the relative path is "//uploads/video.mp4", it will be normalized to "uploads/video.mp4".
   * resolvedAbsolutePath will be /Users/Sayan/Developer/netflix-adaptive-stream-media/uploads/video.mp4
   */
  const normalizedRelativePath = relativePath.replace(/^\/+/, "");
  const resolvedAbsolutePath = path.resolve(
    config.mediaRoot,
    normalizedRelativePath,
  );

  /**
   * CORNER CASE 1: ".." segments
   * For example:
   * If the relative path is "/../secret.txt", it will be normalized to "../secret.txt"
   * resolvedAbsolutePath will be /Users/Sayan/Developer/secret.txt
   * This escapes media root
   * Fix: the resolvedAbsolutePath should start with the rootPath, otherwise throw an error
   *
   * CORNER CASE 2:
   * Let, rootPath = /Users/Sayan/Developer/netflix-adaptive-stream-media
   * resolvedAbsolutePath = /Users/Sayan/Developer/netflix-adaptive-stream-media-test
   * This escapes media root
   *
   * CORNER CASE 3: rootPath is exactly the same as resolvedAbsolutePath
   * For our use case, we are assuming we need a seprate folder for media files.
   */
  const rootPath = path.resolve(config.mediaRoot);

  if (
    resolvedAbsolutePath === rootPath ||
    !resolvedAbsolutePath.startsWith(`${rootPath}${path.sep}`)
  ) {
    throw new Error(`Invalid media path ${relativePath}`);
  }

  return resolvedAbsolutePath;
}

/**
 * Transcodes a video file to a specific resolution and
 * generates HLS segments and playlist files.
 */
export async function transcodeResolution(
  inputRelativePath: string,
  outputRelativePath: string,
  resolution: Resolution,
) {
  // Get the absolute paths for the input and output media files
  const inputPath = resolveMediaPath(inputRelativePath);
  const outputPath = resolveMediaPath(outputRelativePath);

  /**
   * Inside the outputPath, we will create separate folders
   * for each resolution variant (e.g., 1080p, 720p, 480p)
   * to store the HLS segments and playlist files.
   */
  const variantOutput = `${outputPath}${path.sep}${resolution.label}`;
  const variantPlaylist = `${variantOutput}${path.sep}playlist.m3u8`;

  // Create the directory for the resolution variant if it doesn't exist
  await fs.mkdir(variantOutput, { recursive: true });

  /**
   * Since the whole transcoding process is asynchronous,
   * we wrap it in a Promise to handle completion and errors.
   */
  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      // Set the output options for the HLS transcoding process
      .outputOptions([
        `-vf scale=${resolution.width}:${resolution.height}`, // Scale the video to the specified resolution
        `-b:v ${resolution.bitRate}`, // Set the video bitrate
        `-codec:v libx264`, // Use the H.264 codec for video
        `-codec:a aac`, // Use the AAC codec for audio
        `-hls_time 10`, // Set the duration of each HLS segment to 10 seconds
        `-hls_playlist_type vod`, // Set the playlist type to VOD (Video on Demand)
        `-hls_segment_filename ${path.join(variantOutput, "segment-%05d.ts")}`, // Set the naming pattern for HLS segments
      ])
      .output(variantPlaylist) // Set the output playlist file path
      .on("end", () => {
        console.log(`Transcoded ${inputPath} to ${variantPlaylist}`);
        resolve(true);
      })
      .on("error", (err) => {
        console.error(`Error transcoding ${inputPath}: ${err}`);
        reject(err);
      })
      .run();
  });

  // This should be added to the master playlist file to reference this resolution variant
  return `#EXT-X-STREAM-INF:BANDWIDTH=${resolution.bitRate * 1000},RESOLUTION=${resolution.width}x${resolution.height}\n${resolution.label}/playlist.m3u8`;
}

/**
 * Writes the master playlist file (master.m3u8) that references all the resolution variants.
 */
export async function writeMasterPlaylist(
  outputRelativePath: string,
  resolutionEntries: string[],
) {
  // Get the safe, absolute path to the main video folder
  const outputPath = resolveMediaPath(outputRelativePath);

  // Define the path for the master playlist file
  const masterPlaylistPath = `${outputPath}${path.sep}master.m3u8`;

  // Create the directory for the master playlist if it doesn't exist
  await fs.mkdir(outputPath, { recursive: true });

  /**
   * Take the array of strings generated by the transcodeResolution activity,
   * join them together with a line break (\n) between each one, and save it
   * all into the master.m3u8 text file.
   */
  await fs.writeFile(masterPlaylistPath, resolutionEntries.join("\n"));

  // Return the relative path to the master playlist file
  return `${outputRelativePath}${path.sep}master.m3u8`;
}

/**
 * Deletes the source media file after transcoding is complete.
 * This is useful for cleaning up storage space on the server.
 */
export async function deleteSourceFile(inputRelativePath: string) {
  // Get the absolute path for the input media file
  const inputPath = resolveMediaPath(inputRelativePath);

  const exists = await fs
    .access(inputPath)
    .then(() => true)
    .catch(() => false);

  if (exists) {
    await fs.unlink(inputPath);
    console.log(`Deleted source file: ${inputPath}`);
  }
}

/**
 * Ensures that the output directory exists before starting the transcoding process.
 * If the directory does not exist, it will be created.
 */
export async function ensureOutputDirectoryExists(outputRelativePath: string) {
  // Get the absolute path for the output media directory
  const outputPath = resolveMediaPath(outputRelativePath);
  await fs.mkdir(outputPath, { recursive: true });
}
