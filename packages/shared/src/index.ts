export const TASK_QUEUE = "video-processing";
export const PROCESS_VIDEO_WORKFLOW = "processVideoWorkflow";

export interface ProcessVideoInput {
  videoId: string;
  inputRelativePath: string;
  outputRelativePath: string;
}

// The bitrate values will be in kbps (kilobits per second)
export interface Resolution {
  width: number; // e.g., 1920, 1280, 854
  height: number; // e.g., 1080, 720, 480
  bitRate: number; // e.g., 5000 (5000 kbps = 5 Mbps), 3000 (3000 kbps = 3 Mbps), 1000 (1000 kbps = 1 Mbps)
  label: string; // e.g., "1080p", "720p", "480p"
}

export type ProcessingStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export const RESOLUTIONS: Resolution[] = [
  { width: 1920, height: 1080, bitRate: 2000, label: "1080p" },
  { width: 1280, height: 720, bitRate: 1000, label: "720p" },
  { width: 960, height: 540, bitRate: 500, label: "480p" },
  { width: 640, height: 360, bitRate: 400, label: "360p" },
];
