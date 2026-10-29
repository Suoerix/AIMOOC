export async function getBiliVideo(url: string): Promise<string> {
  return `/api/bilibili/video?url=${encodeURIComponent(url)}`
}
