// YouTube download requires the yt-dlp binary, which is only available when
// running the local Express backend (backend/server.js). Vercel serverless
// functions cannot run it, so the hosted demo politely declines.
export default function handler(req, res) {
  res.status(501).json({
    error: 'YouTube fetch is not available on the hosted demo. Download the video and upload the file directly — analysis works the same.',
  })
}
